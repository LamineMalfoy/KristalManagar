const { query } = require('../filedb.js');
const { checkSysAccess, getAccessLevelName } = require('./sysadmin.js');
const { vk } = require('../index.js');
const { hasCommandAccess } = require('../utils/commandAccess.js');
const { extractNumericId } = require('./ban.js');
const util = require('util');
const databaseQuery = util.promisify(query);

module.exports = {
  command: '/giveowner',
  description: 'Выдача статуса основателя',
  async execute(context) {
    try {
      // Проверка прав доступа
      const hasAccess = await hasCommandAccess(context.senderId, 'giveowner');
      if (!hasAccess) {
        return context.reply('⛔ Доступ запрещен | У вас недостаточно прав для выдачи статуса основателя\n👑 Требуется: доступ к команде выдачи прав основателя');
      }

      // Определение целевого пользователя: по ответу или из аргумента
      const args = context.text.split(' ');
      const replyMessage = context.replyMessage;
      let userId;
      if (replyMessage && replyMessage.senderId) {
        userId = Number(replyMessage.senderId);
      } else {
        if (args.length < 2) {
          return context.reply('❌ Ошибка синтаксиса | Используйте: /giveowner [ID] или ответьте на сообщение командой /giveowner');
        }
        userId = await extractNumericId(args[1]);
      }
      if (!Number.isFinite(userId) || userId === 0) {
        return context.reply('❌ Ошибка | Некорректный пользователь');
      }

      // Проверка текущего уровня доступа пользователя
      const targetAccess = await checkSysAccess(userId);
      
      // Проверка, не имеет ли пользователь уже статус основателя или выше
      if (targetAccess >= 4) {
        return context.reply(`❌ Ошибка | Пользователь уже имеет уровень доступа "${getAccessLevelName(targetAccess)}"`);
      }

      // Выдача статуса основателя
      // Сначала проверим, есть ли уже запись
      const checkQuery = `SELECT * FROM sysadmins WHERE userid = ?`;
      const existing = await databaseQuery(checkQuery, [userId]);
      
      if (existing.length > 0) {
        // Обновляем существующую запись
        const updateQuery = `UPDATE sysadmins SET access = 4, assigned_by = ?, assigned_date = ? WHERE userid = ?`;
        const currentDate = new Date().toISOString();
        await databaseQuery(updateQuery, [context.senderId, currentDate, userId]);
      } else {
        // Создаем новую запись
        const insertQuery = `INSERT INTO sysadmins (userid, access, assigned_by, assigned_date) VALUES (?, ?, ?, ?)`;
        const currentDate = new Date().toISOString();
        await databaseQuery(insertQuery, [userId, 4, context.senderId, currentDate]);
      }

      // Получение информации о пользователе
      let userInfo;
      try {
        userInfo = await vk.api.users.get({ user_ids: userId });
      } catch (error) {
        console.error('Ошибка при получении информации о пользователе:', error);
        userInfo = [{ first_name: 'Пользователь', last_name: userId }];
      }

      // Отправка подтверждения
      context.send({
        message: `✅ Пользователю [id${userId}|${userInfo[0].first_name} ${userInfo[0].last_name}] выдан статус основателя`,
        disable_mentions: true
      });

      // Уведомление пользователя
      try {
        await vk.api.messages.send({
          peer_id: userId,
          message: `✅ Вам выдан статус основателя бота\n👤 Выдал: [id${context.senderId}|${(await vk.api.users.get({ user_ids: context.senderId }))[0].first_name}]`,
          disable_mentions: true,
          random_id: Math.floor(Math.random() * 1000000)
        });
      } catch (error) {
        console.error(`Ошибка при отправке уведомления пользователю ${userId}:`, error);
      }
    } catch (error) {
      console.error('Ошибка при выполнении команды giveowner:', error);
      context.reply('❌ Произошла ошибка при выполнении команды');
    }
  },
};