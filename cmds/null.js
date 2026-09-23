const { query } = require('../filedb.js');
const { checkSysAccess, getAccessLevelName, canManageAccess } = require('./sysadmin.js');
const { extractNumericId } = require('./ban.js');
const { vk } = require('../index.js');
const { hasCommandAccess } = require('../utils/commandAccess.js');
const util = require('util');
const databaseQuery = util.promisify(query);

module.exports = {
  command: '/null',
  description: 'Снятие прав доступа к системе бота',
  async execute(context) {
    try {
       
      const hasAccess = await hasCommandAccess(context.senderId, 'null');
      if (!hasAccess) {
        return context.reply('⛔ Доступ запрещен | У вас недостаточно прав для снятия прав доступа\n👑 Требуется: доступ к команде снятия прав');
      }

       
      const args = context.text.split(' ');
      if (args.length < 2) {
        return context.reply('❌ Ошибка синтаксиса | Используйте: /null [ID пользователя]');
      }

       
      const userId = await extractNumericId(args[1]);
      if (!userId) {
        return context.reply('❌ Ошибка | Некорректный ID пользователя');
      }

       
      if (userId === context.senderId) {
        return context.reply('❌ Ошибка | Вы не можете снять права у самого себя');
      }

       
      const targetAccess = await checkSysAccess(userId);
      
       
      if (targetAccess === 0) {
        return context.reply('❌ Ошибка | У пользователя нет прав доступа к системе бота');
      }

       
      const senderAccess = await checkSysAccess(context.senderId);
      if (!canManageAccess(senderAccess, targetAccess)) {
        return context.reply(`❌ Ошибка | Вы не можете снять права у пользователя с уровнем доступа "${getAccessLevelName(targetAccess)}"`);
      }

       
      const query = 'DELETE FROM sysadmins WHERE userid = ?';
      await databaseQuery(query, [userId]);

       
      let userInfo;
      try {
        userInfo = await vk.api.users.get({ user_ids: userId });
      } catch (error) {
        console.error('Ошибка при получении информации о пользователе:', error);
        userInfo = [{ first_name: 'Пользователь', last_name: userId }];
      }

       
      context.send({
        message: `✅ У пользователя [id${userId}|${userInfo[0].first_name} ${userInfo[0].last_name}] сняты права доступа к системе бота`,
        disable_mentions: true
      });

       
      try {
        await vk.api.messages.send({
          peer_id: userId,
          message: `⚠️ У вас сняты права доступа к системе бота\n👤 Снял: [id${context.senderId}|${(await vk.api.users.get({ user_ids: context.senderId }))[0].first_name}]`,
          disable_mentions: true,
          random_id: Math.floor(Math.random() * 1000000)
        });
      } catch (error) {
        console.error(`Ошибка при отправке уведомления пользователю ${userId}:`, error);
      }
    } catch (error) {
      console.error('Ошибка при выполнении команды null:', error);
      context.reply('❌ Произошла ошибка при выполнении команды');
    }
  },
}; 