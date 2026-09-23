const database = require('../databases.js');
const { checkSysAccess } = require('./sysadmin.js');
const { hasCommandAccess, getAccessDeniedMessage } = require('../utils/commandAccess.js');
const { extractNumericId } = require('./ban.js');
const vk = require('../vkInstance.js');
const util = require('util');
const databaseQuery = util.promisify(database.query);

module.exports = {
  command: '/unbanreport',
  aliases: [],
  description: 'Разблокировка возможности создания тикетов пользователем',
  async execute(context) {
    try {
      // Проверяем права доступа
      const hasAccess = await hasCommandAccess(context.senderId, 'unbanreport');
      if (!hasAccess) {
        return context.reply(getAccessDeniedMessage('unbanreport'));
      }

      // Парсим аргументы
      const args = context.text.split(' ');
      if (args.length < 2) {
        return context.reply('❌ Ошибка синтаксиса | Используйте: /unbanreport [ID пользователя/упоминание]');
      }

      // Получаем ID пользователя
      const targetId = await extractNumericId(args[1]);
      if (!targetId) {
        return context.reply('❌ Ошибка | Не удалось определить ID пользователя');
      }

      // Проверяем, заблокирован ли пользователь
      const checkQuery = 'SELECT * FROM report_banned WHERE user_id = ?';
      const existingBans = await databaseQuery(checkQuery, [targetId]);
      
      if (!existingBans || existingBans.length === 0) {
        return context.reply('❌ Ошибка | Этот пользователь не заблокирован в системе репортов');
      }

      // Получаем информацию о пользователе
      let userInfo;
      try {
        userInfo = await vk.api.users.get({ user_ids: targetId });
      } catch (error) {
        console.error('Ошибка при получении информации о пользователе:', error);
        userInfo = [{ first_name: 'Пользователь', last_name: targetId }];
      }

      // Получаем информацию об администраторе
      let adminInfo;
      try {
        adminInfo = await vk.api.users.get({ user_ids: context.senderId });
      } catch (error) {
        console.error('Ошибка при получении информации об администраторе:', error);
        adminInfo = [{ first_name: 'Администратор', last_name: context.senderId }];
      }

      // Удаляем запись о блокировке
      const deleteQuery = 'DELETE FROM report_banned WHERE user_id = ?';
      await databaseQuery(deleteQuery, [targetId]);

      // Отправляем сообщение о разблокировке
      const unbanMessage = `✅ [id${targetId}|${userInfo[0].first_name} ${userInfo[0].last_name}] снова может пользоваться системой репортов.\n` +
                          `💬 Администратор: [id${context.senderId}|${adminInfo[0].first_name} ${adminInfo[0].last_name}]`;

      context.reply(unbanMessage);

      // Отправляем уведомление пользователю
      try {
        await vk.api.messages.send({
          peer_id: targetId,
          message: `✅ Вы снова можете пользоваться системой репортов.\n` +
                  `💬 Администратор: [id${context.senderId}|${adminInfo[0].first_name} ${adminInfo[0].last_name}]`,
          random_id: Math.floor(Math.random() * 1000000)
        });
      } catch (error) {
        console.error(`Ошибка при отправке уведомления пользователю ${targetId}:`, error);
      }

    } catch (error) {
      console.error('Ошибка при выполнении команды unbanreport:', error);
      context.reply('❌ Произошла ошибка при выполнении команды');
    }
  }
};