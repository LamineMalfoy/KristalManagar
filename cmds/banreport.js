const database = require('../databases.js');
const { checkSysAccess, isSysBanned } = require('./sysadmin.js');
const { hasCommandAccess, getAccessDeniedMessage } = require('../utils/commandAccess.js');
const { extractNumericId } = require('./ban.js');
const vk = require('../vkInstance.js');
const util = require('util');
const databaseQuery = util.promisify(database.query);

module.exports = {
  command: '/banreport',
  aliases: [],
  description: 'Блокировка возможности создания тикетов пользователем',
  async execute(context) {
    try {
      // Проверяем права доступа
      const hasAccess = await hasCommandAccess(context.senderId, 'banreport');
      if (!hasAccess) {
        return context.reply(getAccessDeniedMessage('banreport'));
      }

      // Парсим аргументы
      const args = context.text.split(' ');
      if (args.length < 2) {
        return context.reply('❌ Ошибка синтаксиса | Используйте: /banreport [ID пользователя/упоминание] [причина]');
      }

      // Получаем ID пользователя
      const targetId = await extractNumericId(args[1]);
      if (!targetId) {
        return context.reply('❌ Ошибка | Не удалось определить ID пользователя');
      }

      // Проверяем, не пытается ли пользователь заблокировать сам себя
      if (targetId === context.senderId) {
        return context.reply('❌ Ошибка | Вы не можете заблокировать сами себя');
      }

      // Проверяем, не пытается ли пользователь заблокировать бота
      if (targetId === global.botId) {
        return context.reply('❌ Ошибка | Вы не можете заблокировать бота');
      }
      
      // Проверяем, не заблокирован ли пользователь в системе бота
      const sysBanInfo = await isSysBanned(targetId);
      if (sysBanInfo) {
        return context.reply('❌ Ошибка | Этот пользователь уже заблокирован в системе бота');
      }

      // Проверяем, не заблокирован ли пользователь уже
      const checkQuery = 'SELECT * FROM report_banned WHERE user_id = ?';
      const existingBans = await databaseQuery(checkQuery, [targetId]);
      
      if (existingBans && existingBans.length > 0) {
        return context.reply('❌ Ошибка | Этот пользователь уже заблокирован в системе репортов');
      }

      // Получаем причину блокировки
      const reason = args.slice(2).join(' ') || 'Не указана';

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

      // Добавляем запись о блокировке
      // Используем текущий timestamp в секундах вместо NOW()
      const currentTimestamp = Math.floor(Date.now() / 1000);
      const insertQuery = 'INSERT INTO report_banned (user_id, banned_by, reason, banned_at) VALUES (?, ?, ?, ?)';
      await databaseQuery(insertQuery, [targetId, context.senderId, reason, currentTimestamp]);

      // Отправляем сообщение о блокировке
      const banMessage = `✅ Заблокирован в системе репортов пользователь: [id${targetId}|${userInfo[0].first_name} ${userInfo[0].last_name}]\n` +
                        `Администратор: [id${context.senderId}|${adminInfo[0].first_name} ${adminInfo[0].last_name}]\n` +
                        `❓ Причина: ${reason}`;

      context.reply(banMessage);

      // Отправляем уведомление пользователю
      try {
        await vk.api.messages.send({
          peer_id: targetId,
          message: `❗ Внимание! Вы заблокированы в системе репортов.\n` +
                  `📝 Причина: ${reason}`,
          random_id: Math.floor(Math.random() * 1000000)
        });
      } catch (error) {
        console.error(`Ошибка при отправке уведомления пользователю ${targetId}:`, error);
      }

    } catch (error) {
      console.error('Ошибка при выполнении команды banreport:', error);
      context.reply('❌ Произошла ошибка при выполнении команды');
    }
  }
};