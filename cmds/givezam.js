const { query } = require('../filedb.js');
const { checkSysAccess, getAccessLevelName } = require('./sysadmin.js');
const { vk } = require('../index.js');
const { hasCommandAccess } = require('../utils/commandAccess.js');
const { extractNumericId } = require('./ban.js');
const util = require('util');
const databaseQuery = util.promisify(query);

module.exports = {
  command: '/givezam',
  description: 'Выдача статуса заместителя основателя',
  async execute(context) {
    try {
       
      const hasAccess = await hasCommandAccess(context.senderId, 'givezam');
      if (!hasAccess) {
        return context.reply('⛔ Доступ запрещен | У вас недостаточно прав для выдачи статуса заместителя основателя\n👑 Требуется: доступ к команде выдачи прав заместителя');
      }

      const args = context.text.split(' ');
      const replyMessage = context.replyMessage;
      let userId;
      if (replyMessage && replyMessage.senderId) {
        userId = Number(replyMessage.senderId);
      } else {
        if (args.length < 2) {
          return context.reply('❌ Ошибка синтаксиса | Используйте: /givezam [ID] или ответьте на сообщение командой /givezam');
        }
        userId = await extractNumericId(args[1]);
      }
      if (!Number.isFinite(userId) || userId === 0) {
        return context.reply('❌ Ошибка | Некорректный пользователь');
      }

      const targetAccess = await checkSysAccess(userId);
      
      if (targetAccess >= 3) {
        return context.reply(`❌ Ошибка | Пользователь уже имеет уровень доступа "${getAccessLevelName(targetAccess)}"`);
      }

      // Выдача статуса заместителя основателя
      // Сначала проверим, есть ли уже запись
      const checkQuery = `SELECT * FROM sysadmins WHERE userid = ?`;
      const existing = await databaseQuery(checkQuery, [userId]);
      
      if (existing.length > 0) {
        // Обновляем существующую запись
        const updateQuery = `UPDATE sysadmins SET access = 3 WHERE userid = ?`;
        await databaseQuery(updateQuery, [userId]);
      } else {
        // Создаем новую запись
        const insertQuery = `INSERT INTO sysadmins (userid, access) VALUES (?, ?)`;
        await databaseQuery(insertQuery, [userId, 3]);
      }

       
      let userInfo;
      try {
        userInfo = await vk.api.users.get({ user_ids: userId });
      } catch (error) {
        console.error('Ошибка при получении информации о пользователе:', error);
        userInfo = [{ first_name: 'Пользователь', last_name: userId }];
      }

       
      context.send({
        message: `✅ Пользователю [id${userId}|${userInfo[0].first_name} ${userInfo[0].last_name}] выдан статус заместителя основателя`,
        disable_mentions: true
      });

       
      try {
        await vk.api.messages.send({
          peer_id: userId,
          message: `✅ Вам выдан статус заместителя основателя бота\n👤 Выдал: [id${context.senderId}|${(await vk.api.users.get({ user_ids: context.senderId }))[0].first_name}]`,
          disable_mentions: true,
          random_id: Math.floor(Math.random() * 1000000)
        });
      } catch (error) {
        console.error(`Ошибка при отправке уведомления пользователю ${userId}:`, error);
      }
    } catch (error) {
      console.error('Ошибка при выполнении команды givezam:', error);
      context.reply('❌ Произошла ошибка при выполнении команды');
    }
  },
}; 