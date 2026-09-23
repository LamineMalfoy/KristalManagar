const database = require('../databases.js');
const { checkUserRole, checkIfTableExists, getUserRole, getRoleName } = require('./roles.js');
const { extractNumericId } = require('./ban.js');
const { getUsername, getlink } = require('../util.js');
const { addLog } = require('../utils/logs.js');
const { checkCommandPriority } = require('./editcmd.js');
const { Keyboard } = require('vk-io');
const vk = require('../vkInstance.js');

module.exports = {
  command: '/mute',
  aliases: ['/мут', '!мут', '!mute'],
  description: 'Выдача блокировки чата пользователю',
  async execute(context) {
    const { peerId, senderId, text, replyMessage } = context;

    if (!await checkIfTableExists(`roles_${peerId}`)) {
      return context.send('⚠️ Беседа не активирована | Для активации используйте команду /start');
    }

    // Проверяем приоритет команды
    const hasPermission = await checkCommandPriority(peerId, senderId, '/mute');
    if (!hasPermission) {
      const { getCommandPriorities } = require('./editcmd.js');
      const priorities = await getCommandPriorities(peerId);
      const requiredRole = priorities['/mute'] || 20;
      const requiredRoleName = await getRoleName(peerId, requiredRole);
      const senderRole = await getUserRole(peerId, context.senderId);
      const senderRoleName = await getRoleName(peerId, senderRole);
      return context.reply(`⛔ Доступ запрещён | Для использования команды /mute требуется приоритет ${requiredRole} или выше\n👤 Ваша роль: ${senderRoleName} (приоритет ${senderRole})`);
    }

    const senderUserRole = await getUserRole(peerId, context.senderId);

    let target;
    let muteMinutes;
    let reason;
    let numericId;

    if (replyMessage) {
      const parts = text.split(' ');
      target = replyMessage.senderId;
      numericId = replyMessage.senderId;
      muteMinutes = parseInt(parts[1]) || 1;
      reason = parts.slice(2).join(' ') || 'Не указана';
    } else {
      const parts = text.split(' ');
      target = parts[1];
      numericId = await extractNumericId(parts[1]);  
      muteMinutes = parseInt(parts[2]) || 1;
      reason = parts.slice(3).join(' ') || 'Не указана';
    }

    if (!target) {
      return context.reply(`❓ Аргументы введены неверно. Необходимо указать пользователя и время блокировки в минутах.
        
❓ Примеры использования:
/mute @user 60 причина
/mute @user 60
/mute - ответом на сообщение`);
    }

    if (!numericId) {
      return context.reply('❌ Не удалось определить ID пользователя. Проверьте правильность указания пользователя.');
    }

    // Проверка, что numericId является числом
    if (isNaN(parseInt(numericId))) {
      return context.reply('❌ Указан некорректный ID пользователя.');
    }

    const targetUserRole = await getUserRole(peerId, numericId);

    if (senderUserRole <= targetUserRole) {
      return context.reply('⛔ Доступ запрещён | Вы не можете ограничить пользователя с равной или более высокой ролью');
    }



    // Проверка присутствия пользователя отключена для огромных бесед (6к+ участников)
    // VK API не может вернуть всех участников, поэтому полагаемся на ответ API при муте
    console.log(`Пропускаем проверку присутствия для пользователя ${numericId} в беседе ${peerId} (огромная беседа)`);
    // Если пользователя нет в беседе, VK API вернет ошибку при попытке мута

    // Переводим минуты в миллисекунды для даты и в секунды для VK API
    const currentDate = new Date();
    const muteUntil = new Date(currentDate.getTime() + muteMinutes * 60 * 1000);
    const muteSeconds = muteMinutes * 60;
    
    const muteInfo = {
      muted_user_id: numericId,
      muted_by: senderId,
      mute_until: muteUntil,
      reason: reason,
    };
    
    if (!global.mutedUsersInfo) global.mutedUsersInfo = {};
    if (!global.mutedUsersInfo[peerId]) {
      global.mutedUsersInfo[peerId] = {};
    }
    
    global.mutedUsersInfo[peerId][numericId] = muteInfo;
    
    try {
      await vk.api.messages.changeConversationMemberRestrictions({ 
        peer_id: context.peerId, 
        member_ids: [parseInt(numericId)], // Передаем как массив с числовым значением
        for: muteSeconds, 
        action: "ro" 
      });
      
      function formatDate(date) {
        const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
        const month = months[date.getMonth()];
        const day = date.getDate();
        const year = date.getFullYear();
        let hours = date.getHours();
        let minutes = date.getMinutes();
        if (minutes < 10) minutes = '0' + minutes;
        return `${day} ${month} ${year} г. ${hours}:${minutes} МСК`;
      }
      
      const formattedDate = formatDate(muteUntil);
      
      // Получаем имя пользователя для сообщения
      let userName = 'Пользователь';
      try {
        const userInfo = await vk.api.users.get({ user_ids: numericId });
        if (userInfo && userInfo[0]) {
          userName = `${userInfo[0].first_name} ${userInfo[0].last_name}`;
        }
      } catch (nameError) {
        console.error('Ошибка при получении имени пользователя:', nameError);
      }
      
      // Добавляем запись в журнал действий
      addLog(peerId, senderId, numericId, 'mute', `Причина: ${reason}. Срок: ${muteMinutes} минут`)
        .catch(err => console.error('Ошибка при логировании мута:', err));
      
      // Создаем кнопку для снятия мута
      const unmuteButtonPayload = {
        target_user_id: numericId,
        muted_by: senderId,
        reason: reason,
        event_id: 6914
      };

      const keyboard = Keyboard.builder()
        .callbackButton({
          label: '🔴 Снять мут',
          payload: JSON.stringify(unmuteButtonPayload),
          inline: true,
          color: Keyboard.PRIMARY_COLOR, // Белая кнопка
        })
        .inline();
      
      // Получаем красивую ссылку на пользователя
      const userLink = await getlink(numericId);
      context.reply({ 
        message: `🔇 ${userLink} был замучен до ${formattedDate}.\n❓ Причина: ${reason}`,
        keyboard: keyboard
      });
    } catch (error) {
      console.error('Ошибка при выдаче мута:', error);
      context.reply(`❌ Ошибка при выдаче мута: ${error.message || 'Неизвестная ошибка'}`);
    }
  },
};
