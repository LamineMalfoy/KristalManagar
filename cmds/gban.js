const { checkCommandPriority, getCommandPriorities } = require('./editcmd.js');
const { getRoleName, getUserRole, checkIfTableExists } = require('./roles.js');
const database = require('../databases.js');
const util = require('util');
const databaseQuery = util.promisify(database.query);
const { banUser, extractNumericId } = require('./ban.js');
const { vk } = require('../index.js');
const { getlink } = require('../util.js');

function safeParsePeerIds(pool_peerIds) {
  if (!pool_peerIds) return [];
  try {
    const arr = typeof pool_peerIds === 'string'
      ? JSON.parse(pool_peerIds)
      : pool_peerIds;
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

module.exports = {
  command: '/gban',
  description: 'Глобальный бан пользователя во всех беседах пулла',
  async execute(context) {
    const { peerId, senderId, replyMessage } = context;
    const messageText = context.text;
    const parts = messageText.split(' ');
    const senderRoleId = await getUserRole(peerId, context.senderId);
    
    if (!(await checkIfTableExists(`roles_${peerId}`))) {
      return context.reply('❌ Таблица ролей не существует');
    }

    // Новая проверка приоритета
    const hasPermission = await checkCommandPriority(peerId, senderId, '/gban');
    if (!hasPermission) {
      const priorities = await getCommandPriorities(peerId);
      const requiredRole = priorities['/gban'] || 100;
      const senderRole = await getUserRole(peerId, context.senderId);
      const senderRoleName = await getRoleName(peerId, senderRole);
      return context.reply(`⛔ Доступ запрещён | Для использования команды /gban требуется приоритет ${requiredRole} или выше\n👤 Ваша роль: ${senderRoleName} (приоритет ${senderRole})`);
    }

    const target = replyMessage ? replyMessage.senderId : parts[1];
    if (!target) {
      return context.reply(`❓ Аргументы введены неверно. Необходимо указать пользователя, время блокировки в днях и причину.
      
❓ Примеры использования:
/gban @user 31 причина
/gban @user 30
/gban - ответом на сообщение`);
    }

    const userId = target || (replyMessage ? replyMessage.senderId : senderId);
    let label = await extractNumericId(userId);
    
    // Если extractNumericId вернул null, пытаемся использовать userId напрямую
    if (!label) {
      if (typeof userId === 'number') {
        label = userId;
      } else if (typeof userId === 'string' && /^\d+$/.test(userId)) {
        label = parseInt(userId, 10);
      } else {
        return context.reply(`❌ Не удалось определить ID пользователя из: ${userId}`);
      }
    }

    // Проверяем, что нельзя банить бота
    if (global.botId && Number(label) === Number(global.botId)) {
      return context.reply('🤖 Нельзя банить бота! Я же ваш помощник 😅');
    }

    // Извлекаем время бана и причину из аргументов
    let banDays, reason;
    if (replyMessage) {
      // Для ответа на сообщение: /gban [дни] [причина]
      const banDaysArg = parseInt(parts[1]);
      banDays = !isNaN(banDaysArg) && banDaysArg > 0 ? banDaysArg : 7; // По умолчанию 7 дней
      reason = parts.slice(isNaN(banDaysArg) ? 1 : 2).join(' ') || 'Нарушение правил';
    } else {
      // Для прямого указания: /gban @user [дни] [причина]
      const banDaysArg = parseInt(parts[2]);
      banDays = !isNaN(banDaysArg) && banDaysArg > 0 ? banDaysArg : 7; // По умолчанию 7 дней
      reason = parts.slice(isNaN(banDaysArg) ? 2 : 3).join(' ') || 'Нарушение правил';
    }

    // Поиск всех пуллов, где состоит этот peerId
    const fs = require('fs');
    const path = require('path');
    const poolsDir = path.join(__dirname, '../data/pools');
    const poolFiles = fs.readdirSync(poolsDir);
    let pools = [];
    for (const file of poolFiles) {
      const data = JSON.parse(fs.readFileSync(path.join(poolsDir, file), 'utf8'));
      if (Array.isArray(data.pool_peerids) && data.pool_peerids.includes(String(peerId))) {
        pools.push(data);
      }
    }
    if (!pools.length) {
      return context.reply('❌ Пуллы не найдены.');
    }
    let totalBanCount = 0;
    let failReasons = [];
    for (const pool of pools) {
      const creatorId = pool.creator_id;
      if (parseInt(label) === parseInt(creatorId)) {
        failReasons.push(`В пулле ${pool.pool_name}: нельзя забанить создателя.`);
        continue;
      }
      const poolPeerIds = safeParsePeerIds(pool.pool_peerids);
      if (!Array.isArray(poolPeerIds) || poolPeerIds.length === 0) {
        failReasons.push(`В пулле ${pool.pool_name}: нет ни одной беседы.`);
        continue;
      }
      for (const poolPeerId of poolPeerIds) {
        try {
          const senderRoleInChat = await getUserRole(poolPeerId, senderId);
          const targetRoleInChat = await getUserRole(poolPeerId, label);
          if (senderRoleInChat < 60) {
            failReasons.push(`В беседе ${poolPeerId}: недостаточно прав (ваша роль < 60)`);
            continue;
          }
          if (senderRoleInChat <= targetRoleInChat) {
            failReasons.push(`В беседе ${poolPeerId}: ваша роль не выше роли цели`);
            continue;
          }
          // Записываем бан в базу с корректным временем
          const banResult = await banUser(poolPeerId, label, reason, senderId, banDays);
          if (banResult === true) {
            totalBanCount++;
          }
        } catch (error) {
          // Подавляем ошибки "пользователь не в чате", но логируем другие
          if (!error.message || !error.message.includes('not in chat')) {
            console.error(`Ошибка при бане в чате ${poolPeerId}:`, error);
          }
          // Все равно пытаемся записать бан в базу с корректным временем
          try {
            const banResult = await banUser(poolPeerId, label, reason, senderId, banDays);
            if (banResult === true) {
              totalBanCount++;
            }
          } catch (banError) {
            console.error(`Ошибка при записи бана в базу для чата ${poolPeerId}:`, banError);
          }
        }
      }
    }
    
    // Всегда добавляем в глобальный банлист
    // fs и path уже объявлены выше
    const banlistDir = path.join(__dirname, '../data/banlist');
    if (!fs.existsSync(banlistDir)) {
      fs.mkdirSync(banlistDir, { recursive: true });
    }
    const banlistFile = path.join(banlistDir, `${peerId}.json`);
    let banlist = {};
    if (fs.existsSync(banlistFile)) {
      try {
        banlist = JSON.parse(fs.readFileSync(banlistFile, 'utf8'));
      } catch {}
    }
    banlist[label] = {
      reason: reason,
      banned_by: senderId,
      banned_at: new Date().toISOString()
    };
    fs.writeFileSync(banlistFile, JSON.stringify(banlist, null, 2));
    
    // Получаем ссылку на пользователя
    let userLink;
    try {
      userLink = await getlink(label);
      if (!userLink) {
        userLink = `[https://vk.com/id${label}|Пользователь] (ID: ${label})`;
      }
    } catch (error) {
      console.error('Ошибка при получении ссылки на пользователя в gban:', error);
      userLink = `[https://vk.com/id${label}|Пользователь] (ID: ${label})`;
    }
    
    // Форматируем дату окончания бана (используем корректное значение banDays)
    const blockUntil = new Date();
    blockUntil.setDate(blockUntil.getDate() + banDays);
    
    function formatDate(date) {
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      return `${day}.${month}.${year} г. ${hours}:${minutes} МСК`;
    }
    const formattedDate = formatDate(blockUntil);
    
    // Создаем клавиатуру с кнопкой снятия глобального бана
    const { Keyboard } = require('vk-io');
    const keyboard = Keyboard.builder()
      .callbackButton({
        label: '🔴 Снять глобальную блокировку',
        payload: {
          button: label,
          banned_by: senderId,
          event_id: 6911, // Новый event_id для глобального разбана
          global_unban: true
        },
        color: Keyboard.NEGATIVE_COLOR
      })
      .inline();

    // Получаем ссылку на администратора
    let adminLink;
    try {
      adminLink = await getlink(senderId);
      if (!adminLink) {
        adminLink = `[https://vk.com/id${senderId}|Администратор] (ID: ${senderId})`;
      }
    } catch (error) {
      console.error('Ошибка при получении ссылки на администратора в gban:', error);
      adminLink = `[https://vk.com/id${senderId}|Администратор] (ID: ${senderId})`;
    }

    // Формируем сообщение о глобальном бане по новому шаблону
    let banMessage = `🚷 Пользователь ${userLink} заблокирован в связанных чатах до ${formattedDate}.\n\n`;

    if (reason && reason !== 'Нарушение правил') {
      banMessage += `Причина: ${reason}.\n`;
    } else {
      banMessage += `Причина блокировки не указана.\n`;
    }

    banMessage += `Решение принял администратор ${adminLink}.`;

    context.reply({
      message: banMessage,
      keyboard: keyboard
    });
    return;
  }
};
