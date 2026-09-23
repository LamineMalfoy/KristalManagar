const database = require('../databases.js');
const { checkSysAccess, getAccessLevelName } = require('./sysadmin.js');
const { hasCommandAccess, getAccessDeniedMessage } = require('../utils/commandAccess.js');
const { extractNumericId } = require('./ban.js');
const vk = require('../vkInstance.js');
const util = require('util');
const databaseQuery = util.promisify(database.query);

module.exports = {
  command: '/sysban',
  description: 'Блокировка пользователя в системе бота',
  async execute(context) {
    try {
       
      const hasAccess = await hasCommandAccess(context.senderId, 'sysban');
      if (!hasAccess) {
        return context.reply(getAccessDeniedMessage('sysban'));
      }
      
      const senderAccess = await checkSysAccess(context.senderId);

       
      const args = context.text.split(' ');
      if (args.length < 3) {
        return context.reply('❌ Ошибка синтаксиса | Используйте: /sysban [ID пользователя] [время в днях/0 - навсегда] [причина - опционально]');
      }

       
      const userId = await extractNumericId(args[1]);
      if (!userId) {
        return context.reply('❌ Ошибка | Некорректный ID пользователя');
      }
      console.log('DEBUG: Final parsed userId:', userId);

       
      if (userId === context.senderId) {
        return context.reply('❌ Ошибка | Вы не можете заблокировать самого себя');
      }

      // Проверяем, что нельзя банить бота
      if (global.botId && Number(userId) === Number(global.botId)) {
        return context.reply('🤖 Нельзя банить бота! Я же ваш помощник 😅');
      }

       
      const targetAccess = await checkSysAccess(userId);
      if (targetAccess >= senderAccess && targetAccess > 0) {
        return context.reply(`❌ Ошибка | Вы не можете заблокировать пользователя с уровнем доступа "${getAccessLevelName(targetAccess)}"`);
      }

       
      const banDays = parseInt(args[2]);
      if (isNaN(banDays) || banDays < 0) {
        return context.reply('❌ Ошибка | Некорректное время блокировки');
      }

       
      let reason = 'Не указана';
      if (args.length > 3) {
        reason = args.slice(3).join(' ');
      }

       
       
      const currentTime = Math.floor(Date.now() / 1000);
      const endTime = banDays === 0 ? 0 : currentTime + (banDays * 86400);

       
      const query = `
        INSERT INTO sysbanned (userid, time, reason, who)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE time = ?, reason = ?, who = ?
      `;
      await databaseQuery(query, [userId, endTime, reason, context.senderId, endTime, reason, context.senderId]);

      // Получаем информацию о пользователе
      console.log('DEBUG: Processing userId:', userId, 'type:', typeof userId);
      
      let userDisplay = `@id${userId} (Пользователь ${userId})`;
      let adminName = 'Администратор';
      
      try {
        console.log('DEBUG: Calling VK API with userId:', userId);
        const userInfo = await vk.api.users.get({ user_ids: [userId] });
        console.log('DEBUG: VK API response:', JSON.stringify(userInfo, null, 2));
        
        if (userInfo && userInfo.length > 0 && userInfo[0]) {
          const user = userInfo[0];
          console.log('DEBUG: User object:', JSON.stringify(user, null, 2));
          
          if (user.first_name && user.last_name) {
            const userName = `${user.first_name} ${user.last_name}`;
            userDisplay = `[id${userId}|${userName}]`;
            console.log('DEBUG: Final userDisplay:', userDisplay);
          }
        }
      } catch (error) {
        console.error('Ошибка при получении информации о пользователе:', error);
        console.error('UserID:', userId);
      }
      
      try {
        const adminInfo = await vk.api.users.get({ user_ids: [context.senderId] });
        if (adminInfo && adminInfo.length > 0 && adminInfo[0]) {
          const admin = adminInfo[0];
          if (admin.first_name && admin.last_name) {
            adminName = `${admin.first_name} ${admin.last_name}`;
          }
        }
      } catch (error) {
        console.error('Ошибка при получении информации об администраторе:', error);
      }

      // Формируем сообщение об успешной блокировке
      let banMessage = `🚫 ${userDisplay} заблокирован в системе бота\n\n`;
      
      if (banDays === 0) {
        banMessage += `🕒 Срок блокировки: навсегда\n`;
      } else if (banDays === 1) {
        banMessage += `🕒 Срок блокировки: 1 день\n`;
      } else {
        banMessage += `🕒 Срок блокировки: ${banDays} дней\n`;
      }
      
      banMessage += `📝 Причина: ${reason}`;

      context.send({ message: banMessage, disable_mentions: true });
      
       
      try {
        let banNotification = `⛔ Вы были заблокированы в системе бота\n`;
        
        if (banDays === 0) {
          banNotification += `🕒 Срок блокировки: навсегда\n`;
        } else if (banDays === 1) {
          banNotification += `🕒 Срок блокировки: 1 день\n`;
        } else {
          banNotification += `🕒 Срок блокировки: ${banDays} дней\n`;
        }
        
        banNotification += `📝 Причина: ${reason}\n`;
        banNotification += `👤 Заблокировал: [id${context.senderId}|${(await vk.api.users.get({ user_ids: context.senderId }))[0].first_name}]`;
        
        await vk.api.messages.send({
          peer_id: userId,
          message: banNotification,
          disable_mentions: true,
          random_id: Math.floor(Math.random() * 1000000)
        });
      } catch (error) {
        console.error(`Ошибка при отправке уведомления пользователю ${userId}:`, error);
      }
    } catch (error) {
      console.error('Ошибка при выполнении команды sysban:', error);
      context.reply('❌ Произошла ошибка при выполнении команды');
    }
  },
};
