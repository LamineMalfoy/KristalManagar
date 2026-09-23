const database = require('../databases.js');
const { checkSysAccess, getAccessLevelName, isSysBanned } = require('./sysadmin.js');
const { hasCommandAccess, getAccessDeniedMessage } = require('../utils/commandAccess.js');
const { extractNumericId } = require('./ban.js');
const vk = require('../vkInstance.js');
const util = require('util');
const databaseQuery = util.promisify(database.query);

module.exports = {
  command: '/unsysban',
  description: 'Разблокировка пользователя в системе бота',
  async execute(context) {
    try {
       
      const hasAccess = await hasCommandAccess(context.senderId, 'unsysban');
      if (!hasAccess) {
        return context.reply(getAccessDeniedMessage('unsysban'));
      }
      
      const senderAccess = await checkSysAccess(context.senderId);

       
      const args = context.text.split(' ');
      if (args.length < 2) {
        return context.reply('❌ Ошибка синтаксиса | Используйте: /unsysban [ID пользователя]');
      }

      // Используем async extractNumericId для поддержки всех форматов VK
      const userId = await extractNumericId(args[1]);
      if (!userId) {
        return context.reply('❌ Ошибка | Некорректный ID пользователя');
      }
      
      console.log('DEBUG: Final parsed userId:', userId);

       
      const banInfo = await isSysBanned(userId);
      if (!banInfo) {
        return context.reply('❌ Ошибка | Указанный пользователь не заблокирован в системе');
      }

       
      if (banInfo.who !== context.senderId) {
        const bannerAccess = await checkSysAccess(banInfo.who);
        if (senderAccess <= bannerAccess && bannerAccess > 0) {
          return context.reply(`❌ Ошибка | Вы не можете разблокировать пользователя, заблокированного администратором с уровнем доступа "${getAccessLevelName(bannerAccess)}"`);
        }
      }

       
      await databaseQuery('DELETE FROM sysbanned WHERE userid = ?', [userId]);

      // Получаем информацию о пользователе для уведомления
      let userDisplay = `@id${userId} (Пользователь ${userId})`;
      
      try {
        const userInfo = await vk.api.users.get({ user_ids: [userId] });
        if (userInfo && userInfo.length > 0 && userInfo[0]) {
          const user = userInfo[0];
          if (user.first_name && user.last_name) {
            const userName = `${user.first_name} ${user.last_name}`;
            userDisplay = `[id${userId}|${userName}]`;
          }
        }
      } catch (error) {
        console.error('Ошибка при получении информации о пользователе:', error);
        console.error('UserID:', userId);
      }

      // Отправляем уведомление об успешной разблокировке
      const unbanMessage = `✅ ${userDisplay} разблокирован в системе бота`;
      context.send({ message: unbanMessage, disable_mentions: true });
    } catch (error) {
      console.error('Ошибка при выполнении команды unsysban:', error);
      context.reply('❌ Произошла ошибка при выполнении команды');
    }
  },
}; 