const database = require('../databases.js');
const { hasCommandAccess, getAccessDeniedMessage } = require('../utils/commandAccess.js');
const vk = require('../vkInstance.js');
const util = require('util');
const databaseQuery = util.promisify(database.query);

module.exports = {
  command: '/rbanlist',
  aliases: [],
  description: 'Получить список пользователей, заблокированных в системе репортов',
  async execute(context) {
    try {
      // Проверяем права доступа
      const hasAccess = await hasCommandAccess(context.senderId, 'rbanlist');
      if (!hasAccess) {
        return context.reply(getAccessDeniedMessage('rbanlist'));
      }

      // Получаем список заблокированных пользователей
      const selectQuery = `
        SELECT rb.user_id, rb.banned_by, rb.reason, rb.banned_at
        FROM report_banned rb
        ORDER BY rb.banned_at DESC
      `;

      const bannedUsers = await databaseQuery(selectQuery);

      if (!bannedUsers || bannedUsers.length === 0) {
        return context.reply('✅ Нет блокировок | В системе репортов нет заблокированных пользователей');
      }

      // Собираем все ID пользователей для получения информации
      const userIds = [];
      for (const ban of bannedUsers) {
        userIds.push(ban.user_id);
        userIds.push(ban.banned_by);
      }

      // Получаем информацию о пользователях
      let userInfos;
      try {
        userInfos = await vk.api.users.get({ user_ids: [...new Set(userIds)] });
      } catch (error) {
        console.error('Ошибка при получении информации о пользователях:', error);
        userInfos = [];
      }

      // Создаем карту пользователей для быстрого доступа
      const userMap = {};
      for (const user of userInfos) {
        userMap[user.id] = user;
      }

      // Формируем сообщение
      let message = `⛔️ Список пользователей, заблокированных в системе репортов\n\n`;

      for (let i = 0; i < bannedUsers.length; i++) {
        const ban = bannedUsers[i];
        const user = userMap[ban.user_id] || { first_name: 'Пользователь', last_name: ban.user_id };
        const admin = userMap[ban.banned_by] || { first_name: 'Администратор', last_name: ban.banned_by };
        
        // Форматируем дату
        let formattedDate = 'Дата не указана';
        if (ban.banned_at) {
          try {
            // Проверяем, является ли banned_at числом (timestamp) или строкой
            const banDate = typeof ban.banned_at === 'number' ? 
                          new Date(ban.banned_at * 1000) : // Если timestamp в секундах
                          new Date(ban.banned_at);         // Если строка даты
            
            // Проверяем валидность даты
            if (!isNaN(banDate.getTime())) {
              formattedDate = banDate.toLocaleDateString('ru-RU') + ' ' + 
                             banDate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
            }
          } catch (error) {
            console.error('Ошибка форматирования даты:', error);
          }
        }
        
        message += `${i + 1}. [id${ban.user_id}|${user.first_name} ${user.last_name}]\n`;
        message += `— Заблокирован: ${formattedDate}\n`;
        message += `— Администратор: [id${ban.banned_by}|${admin.first_name} ${admin.last_name}]\n`;
        if (ban.reason) {
          message += `— Причина: ${ban.reason}\n`;
        }
        message += `\n`;
      }

      // Отправляем сообщение
      context.reply({ message: message, disable_mentions: true });

    } catch (error) {
      console.error('Ошибка при выполнении команды rbanlist:', error);
      context.reply('❌ Произошла ошибка при выполнении команды');
    }
  }
};