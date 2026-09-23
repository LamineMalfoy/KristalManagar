const { getUserRole, getRoleName, checkIfTableExists } = require('./roles.js');
const { checkCommandPriority, getCommandPriorities } = require('./editcmd.js');
const { getlink } = require('../util.js');
const fs = require('fs');
const path = require('path');

module.exports = {
  command: '/pullinfo',
  description: 'Получение информации о пулле',
  async execute(context) {
    const { peerId, senderId } = context;

    // Сначала проверяем таблицу
    if (!await checkIfTableExists(`nicknames_${peerId}`)) {
      console.error('Таблица никнеймов не существует');
      return context.send('❌ Ваша беседа не зарегистрирована!');
    }

    // Затем проверяем права через checkCommandPriority
    const hasPermission = await checkCommandPriority(peerId, context.senderId, '/pullinfo');
    if (!hasPermission) {
      const priorities = await getCommandPriorities(peerId);
      const requiredRole = priorities['/pullinfo'] || 80;
      const senderRole = await getUserRole(peerId, context.senderId);
      const senderRoleName = await getRoleName(peerId, senderRole);
      return context.reply(`⛔ Доступ запрещён | Для использования команды /pullinfo требуется приоритет ${requiredRole} или выше\n👤 Ваша роль: ${senderRoleName} (приоритет ${senderRole})`);
    }

    const { safeParsePeerIds } = require('../utils/pool.js');
    const poolsDir = path.join(__dirname, '../data/pools');
    let poolFiles;
    try {
      poolFiles = fs.readdirSync(poolsDir);
    } catch (err) {
      return context.reply('❌ Не удалось прочитать пуллы.');
    }
    let foundPools = [];
    for (const file of poolFiles) {
      if (!file.endsWith('.json')) continue;
      let data;
      try {
        data = JSON.parse(fs.readFileSync(path.join(poolsDir, file), 'utf8'));
      } catch (e) { continue; }
      const poolPeerIds = safeParsePeerIds(data.pool_peerids);
      if (Array.isArray(poolPeerIds) && poolPeerIds.includes(String(peerId))) {
        foundPools.push(data);
      }
    }
    if (!foundPools.length) {
      return context.reply('❌ Объединения для данной беседы не найдено.');
    }
    console.log(`[pullinfo] Найдено пуллов: ${foundPools.length}. Ключи: ${foundPools.map(p=>p.pool_key).join(', ')}`);
    let replyText = `ℹ️ Найдено пуллов: ${foundPools.length}\n`;
    for (const pool of foundPools) {
      const poolName = pool.pool_name;
      const poolKey = pool.pool_key;
      const creatorId = pool.creator_id;
      const createdAt = pool.created_at;
      const creatorLink = await getlink(creatorId);
      const poolPeerIds = safeParsePeerIds(pool.pool_peerids);
      let chatNames = {};
      if (Array.isArray(poolPeerIds) && poolPeerIds.length > 0) {
        try {
          chatNames = await getChatNames(poolPeerIds);
        } catch {
          chatNames = {};
        }
      }
      const chatList = Object.entries(chatNames)
        .sort(([peerIdA], [peerIdB]) => Number(peerIdA) - Number(peerIdB))
        .map(([peerId, chatName], index) => `${index + 1}. Чат: ${chatName}`)
        .join('\n');
      let formattedTime = 'неизвестна';
      if (createdAt) {
        try {
          const currentDate = new Date(createdAt);
          formattedTime = currentDate.toLocaleString('ru', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          });
        } catch {}
      }
      // Форматируем список чатов по новому образцу
      const formattedChatList = Object.entries(chatNames)
        .sort(([peerIdA], [peerIdB]) => Number(peerIdA) - Number(peerIdB))
        .map(([peerId, chatName]) => `→ ${chatName}`)
        .join('\n');
      
      // Форматируем дату в более простой вид
      let simpleDate = 'неизвестна';
      if (createdAt) {
        try {
          const date = new Date(createdAt);
          const day = date.getDate();
          const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
          const month = months[date.getMonth()];
          const year = date.getFullYear();
          const hours = date.getHours();
          const minutes = date.getMinutes().toString().padStart(2, '0');
          simpleDate = `${day} ${month} ${year} в ${hours}:${minutes}`;
        } catch {}
      }
      
      replyText += `\n🌀 Информация о пуле 🌀\n\n🗒 Название: ${poolName}\n👑 Хозяин: ${creatorLink}\n🔒 Код доступа: #${poolKey}\n📆 Зарегистрирован: ${simpleDate}\n\n📜 Чаты пула:\n${formattedChatList || '→ нет чатов'}\n`;
    }
    return context.reply(replyText);
  },
};

async function getChatNames(peerIds) {
  const chatNames = {};

  for (const peerId of peerIds) {
    try {
      const chatInfo = await vk.api.messages.getConversationsById({ peer_ids: peerId });

      if (chatInfo.items && chatInfo.items.length > 0) {
        const chat = chatInfo.items[0];
        const title = chat.chat_settings ? chat.chat_settings.title : 'Неизвестно';
        chatNames[peerId] = title;
      }
    } catch (error) {
      console.error(`Ошибка при получении названия чата для peerId ${peerId}:`, error);
      chatNames[peerId] = 'Ошибка';
    }
  }

  return chatNames;
}
