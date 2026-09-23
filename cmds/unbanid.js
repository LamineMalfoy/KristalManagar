const vk = require('../vkInstance.js');
const { query } = require('../filedb.js');
const util = require('util');
const databaseQuery = util.promisify(query);
const { checkSysAccess, getAccessLevelName } = require('./sysadmin.js');

module.exports = {
  command: '/unbanid',
  aliases: ['/анбанид'],
  description: 'Разблокировать чат в боте. Использование: /unbanid [ID чата]',
  async execute(context) {
    try {
      // Проверяем права системного администратора (минимум зам основателя - уровень 3)
      const userAccess = await checkSysAccess(context.senderId);
      
      if (userAccess < 3) {
        await context.reply('❌ У вас нет прав для использования этой команды. Доступна с роли заместителя основателя.');
        return;
      }
      
      // Парсим аргументы команды
      const args = context.text.split(' ').slice(1);
      
      if (args.length === 0) {
        await context.reply('❌ Использование: /unbanid [ID чата]\n\nПример: /unbanid 2000000001');
        return;
      }
      
      let chatId = args[0];
      
      // Парсим ID чата из различных форматов
      if (chatId.startsWith('20000000')) {
        chatId = parseInt(chatId);
      } else if (/^\d+$/.test(chatId)) {
        chatId = parseInt(chatId);
      } else {
        await context.reply('❌ Неверный формат ID чата. Используйте peer_id беседы (например: 2000000001)');
        return;
      }
      
      // Проверяем, заблокирован ли этот чат
      const existingBan = await databaseQuery(
        'SELECT * FROM chat_bans WHERE chat_id = ?',
        [chatId]
      );
      
      if (!existingBan || existingBan.length === 0) {
        await context.reply('⚠️ Этот чат не заблокирован в боте.');
        return;
      }
      
      const banInfo = existingBan[0];
      
      // Получаем информацию о сотруднике, который заблокировал
      let bannedByName = `[id${banInfo.banned_by}|Сотрудник]`;
      try {
        const userInfo = await vk.api.users.get({
          user_ids: banInfo.banned_by,
          fields: 'first_name,last_name'
        });
        if (userInfo && userInfo[0]) {
          bannedByName = `[id${banInfo.banned_by}|${userInfo[0].first_name} ${userInfo[0].last_name}]`;
        }
      } catch (e) {}
      
      // Получаем информацию о том, кто разблокировал
      let unbannedByName = `[id${context.senderId}|Сотрудник]`;
      try {
        const userInfo = await vk.api.users.get({
          user_ids: context.senderId,
          fields: 'first_name,last_name'
        });
        if (userInfo && userInfo[0]) {
          unbannedByName = `[id${context.senderId}|${userInfo[0].first_name} ${userInfo[0].last_name}]`;
        }
      } catch (e) {}
      
      // Удаляем чат из списка заблокированных
      await databaseQuery(
        'DELETE FROM chat_bans WHERE chat_id = ?',
        [chatId]
      );
      
      const roleName = getAccessLevelName(userAccess);
      
      // Получаем уровень доступа того, кто заблокировал
      let bannedByAccess = 0;
      try {
        bannedByAccess = await checkSysAccess(banInfo.banned_by);
      } catch (e) {}
      const bannedByRoleName = getAccessLevelName(bannedByAccess);
      
      // Форматируем дату блокировки
      function formatDate(dateInput) {
        let date;
        
        if (!dateInput) {
          date = new Date();
        } else if (dateInput instanceof Date) {
          date = dateInput;
        } else if (typeof dateInput === 'string') {
          // Пробуем разные варианты парсинга
          date = new Date(dateInput);
          
          // Если не получилось, пробуем заменить пробел на T
          if (isNaN(date.getTime())) {
            date = new Date(dateInput.replace(' ', 'T'));
          }
        } else if (typeof dateInput === 'number') {
          date = new Date(dateInput);
        } else {
          date = new Date();
        }
        
        const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
        const month = months[date.getMonth()];
        const day = date.getDate();
        const year = date.getFullYear();
        let hours = date.getHours();
        let minutes = date.getMinutes();
        if (minutes < 10) minutes = '0' + minutes;
        return `${day} ${month} ${year} года в ${hours}:${minutes} по GMT+3`;
      }
      const banDate = formatDate(banInfo.banned_at);
      const currentDate = formatDate(new Date());
      
      let unbanMessage = `✅ Чат ${chatId} разблокирован в боте.\n\n`;
      unbanMessage += `Был заблокирован сотрудником ${bannedByName} (${bannedByRoleName}).\n`;
      unbanMessage += `Время блокировки: ${banDate}.\n\n`;
      unbanMessage += `Решение о разблокировке принял сотрудник ${unbannedByName} (${roleName}).\n`;
      unbanMessage += `Время разблокировки: ${currentDate}.`;
      
      await context.reply(unbanMessage);
      
      console.log(`[UNBANID] Чат ${chatId} разблокирован сотрудником ${context.senderId} (${roleName})`);
      
    } catch (error) {
      console.error('Ошибка в команде /unbanid:', error);
      await context.reply(`❌ Ошибка: ${error.message}`);
    }
  }
};
