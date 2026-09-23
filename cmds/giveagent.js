const database = require('../databases.js');
const { checkSysAccess, getAccessLevelName } = require('./sysadmin.js');
const { extractNumericId } = require('./ban.js');
const { hasCommandAccess } = require('../utils/commandAccess.js');
const { vk } = require('../index.js');
const util = require('util');
const databaseQuery = util.promisify(database.query);

module.exports = {
  command: '/giveagent',
  description: 'Выдача статуса агента поддержки',
  async execute(context) {
    try {
       
      const hasAccess = await hasCommandAccess(context.senderId, 'giveagent');
      if (!hasAccess) {
        return context.reply('⛔ Доступ запрещен | У вас недостаточно прав для выдачи статуса агента поддержки\n👑 Требуется: доступ к команде выдачи прав агента');
      }

       const args = context.text.split(' ');
      const replyMessage = context.replyMessage;
      let userId;
      if (replyMessage && replyMessage.senderId) {
        userId = Number(replyMessage.senderId);
      } else {
        if (args.length < 2) {
          return context.reply('❌ Ошибка синтаксиса | Используйте: /giveagent [ID] или ответьте на сообщение командой /giveagent');
        }
        userId = await extractNumericId(args[1]);
      }
      if (!Number.isFinite(userId) || userId === 0) {
        return context.reply('❌ Ошибка | Некорректный пользователь');
      }

       
      const targetAccess = await checkSysAccess(userId);
      
       
      if (targetAccess >= 1) {
        return context.reply(`❌ Ошибка | Пользователь уже имеет уровень доступа "${getAccessLevelName(targetAccess)}"`);
      }

      // Назначение статуса агента поддержки с уровнем доступа 1
      const query = `
        INSERT INTO sysadmins (userid, access)
        VALUES (?, 1)
        ON DUPLICATE KEY UPDATE access = 1
      `;
      await databaseQuery(query, [userId, 1]);

       
      let userInfo;
      try {
        userInfo = await vk.api.users.get({ user_ids: userId });
      } catch (error) {
        console.error('Ошибка при получении информации о пользователе:', error);
        userInfo = [{ first_name: 'Пользователь', last_name: userId }];
      }

       
      context.send({
        message: `✅ Пользователю [id${userId}|${userInfo[0].first_name} ${userInfo[0].last_name}] выдан статус агента поддержки`,
        disable_mentions: true
      });

       
      try {
        await vk.api.messages.send({
          peer_id: userId,
          message: `✅ Вам выдан статус агента поддержки бота\n👤 Выдал: [id${context.senderId}|${(await vk.api.users.get({ user_ids: context.senderId }))[0].first_name}]`,
          disable_mentions: true,
          random_id: Math.floor(Math.random() * 1000000)
        });
      } catch (error) {
        console.error(`Ошибка при отправке уведомления пользователю ${userId}:`, error);
      }
    } catch (error) {
      console.error('Ошибка при выполнении команды giveagent:', error);
      context.reply('❌ Произошла ошибка при выполнении команды');
    }
  },
}; 