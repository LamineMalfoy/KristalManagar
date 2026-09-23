const database = require('../databases.js');
const { checkSysAccess } = require('./sysadmin.js');
const { hasCommandAccess, getAccessDeniedMessage } = require('../utils/commandAccess.js');
const util = require('util');
const databaseQuery = util.promisify(database.query);

module.exports = {
  command: '/notif',
  description: 'Отправка уведомления по всем чатам',
  async execute(context) {
    try {
       
      const hasAccess = await hasCommandAccess(context.senderId, 'notif');
      if (!hasAccess) {
        return context.reply(getAccessDeniedMessage('notif'));
      }

       
      const args = context.text.split(' ');
      if (args.length < 2) {
        return context.reply('❌ Ошибка синтаксиса | Используйте: /notif [сообщение]');
      }

       
      const message = args.slice(1).join(' ');

       
      const query = 'SHOW TABLES LIKE "conference_%"';
      const results = await databaseQuery(query);
      
      if (!results || results.length === 0) {
        return context.reply('❌ Ошибка | Активные беседы не найдены');
      }

       
      let userInfo;
      try {
        userInfo = await vk.api.users.get({ user_ids: context.senderId });
      } catch (error) {
        console.error('Ошибка при получении информации о пользователе:', error);
        userInfo = [{ first_name: 'Администратор', last_name: 'бота' }];
      }

       
      const notificationMessage = `📢 Важное уведомление от администрации бота\n` +
                                 `👤 Отправитель: [id${context.senderId}|${userInfo[0].first_name} ${userInfo[0].last_name}]\n\n` +
                                 `${message}`;

       
      let sentCount = 0;
      let errorCount = 0;

       
      for (const table of results) {
        const tableName = table[Object.keys(table)[0]];
        const peerId = parseInt(tableName.replace('conference_', ''));
        
        if (isNaN(peerId)) continue;
        
        try {
          await vk.api.messages.send({
            peer_id: peerId,
            message: notificationMessage,
            disable_mentions: true,
            random_id: Math.floor(Math.random() * 1000000)
          });
          sentCount++;
        } catch (error) {
          console.error(`Ошибка при отправке уведомления в беседу ${peerId}:`, error);
          errorCount++;
        }
      }

       
      context.reply(`✅ Уведомление отправлено\n` +
                   `📊 Статистика:\n` +
                   `✓ Успешно отправлено: ${sentCount}\n` +
                   `❌ Ошибок: ${errorCount}`);
    } catch (error) {
      console.error('Ошибка при выполнении команды notif:', error);
      context.reply('❌ Произошла ошибка при выполнении команды');
    }
  },
}; 