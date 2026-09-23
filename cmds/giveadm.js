const database = require('../databases.js');
const { checkSysAccess, getAccessLevelName } = require('./sysadmin.js');
const { extractNumericId } = require('./ban.js');
const { hasCommandAccess } = require('../utils/commandAccess.js');
const { vk } = require('../index.js');
const util = require('util');
const databaseQuery = util.promisify(database.query);

module.exports = {
  command: '/giveadm',
  description: 'Выдача статуса администрации бота',
  async execute(context) {
    try {
       
      const hasAccess = await hasCommandAccess(context.senderId, 'giveadm');
      if (!hasAccess) {
        return context.reply('⛔ Доступ запрещен | У вас недостаточно прав для выдачи статуса администрации бота\n👑 Требуется: доступ к команде выдачи прав администратора');
      }

       const args = context.text.split(' ');
      const replyMessage = context.replyMessage;
      let userId;
      if (replyMessage && replyMessage.senderId) {
        userId = Number(replyMessage.senderId);
      } else {
        if (args.length < 2) {
          return context.reply('❌ Ошибка синтаксиса | Используйте: /giveadm [ID] или ответьте на сообщение командой /giveadm');
        }
        userId = await extractNumericId(args[1]);
      }
      if (!Number.isFinite(userId) || userId === 0) {
        return context.reply('❌ Ошибка | Некорректный пользователь');
      }

       
      const targetAccess = await checkSysAccess(userId);
      
       
      if (targetAccess >= 2) {
        return context.reply(`❌ Ошибка | Пользователь уже имеет уровень доступа "${getAccessLevelName(targetAccess)}"`);
      }

       
      const query = `
        INSERT INTO sysadmins (userid, access)
        VALUES (?, 2)
        ON DUPLICATE KEY UPDATE access = 2
      `;
      await databaseQuery(query, [userId, 2]);

       
      let userInfo;
      try {
        userInfo = await vk.api.users.get({ user_ids: userId });
      } catch (error) {
        console.error('Ошибка при получении информации о пользователе:', error);
        userInfo = [{ first_name: 'Пользователь', last_name: userId }];
      }

       
      context.send({
        message: `✅ Пользователю [id${userId}|${userInfo[0].first_name} ${userInfo[0].last_name}] выдан статус администрации бота`,
        disable_mentions: true
      });

       
      try {
        await vk.api.messages.send({
          peer_id: userId,
          message: `✅ Вам выдан статус администрации бота\n👤 Выдал: [id${context.senderId}|${(await vk.api.users.get({ user_ids: context.senderId }))[0].first_name}]`,
          disable_mentions: true,
          random_id: Math.floor(Math.random() * 1000000)
        });
      } catch (error) {
        console.error(`Ошибка при отправке уведомления пользователю ${userId}:`, error);
      }
    } catch (error) {
      console.error('Ошибка при выполнении команды giveadm:', error);
      context.reply('❌ Произошла ошибка при выполнении команды');
    }
  },
}; 