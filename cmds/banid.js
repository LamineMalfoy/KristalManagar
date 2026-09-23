const vk = require('../vkInstance.js');
const { query } = require('../filedb.js');
const util = require('util');
const databaseQuery = util.promisify(query);
const { checkSysAccess, getAccessLevelName } = require('./sysadmin.js');

module.exports = {
  command: '/banid',
  aliases: ['/банид'],
  description: 'Заблокировать чат в боте. Использование: /banid [ID чата]',
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
        await context.reply('❌ Использование: /banid [ID чата]\n\nПример: /banid 2000000001');
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
      
      // Проверяем, существует ли чат
      try {
        const chatInfo = await vk.api.messages.getConversationsById({
          peer_ids: chatId
        });
        
        if (!chatInfo.items || chatInfo.items.length === 0) {
          await context.reply('❌ Чат с таким ID не найден.');
          return;
        }
      } catch (error) {
        await context.reply('❌ Не удалось найти чат с таким ID.');
        return;
      }
      
      // Проверяем, не заблокирован ли уже этот чат
      const existingBan = await databaseQuery(
        'SELECT * FROM chat_bans WHERE chat_id = ?',
        [chatId]
      );
      
      if (existingBan && existingBan.length > 0) {
        await context.reply('⚠️ Этот чат уже заблокирован в боте.');
        return;
      }
      
      // Создаем таблицу chat_bans, если её нет
      await databaseQuery(`
        CREATE TABLE IF NOT EXISTS chat_bans (
          chat_id BIGINT PRIMARY KEY,
          banned_by INT NOT NULL,
          banned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          reason VARCHAR(500) DEFAULT 'Не указана'
        )
      `);
      
      // Получаем причину блокировки (если указана)
      const reason = args.slice(1).join(' ') || 'Не указана';
      
      // Получаем текущую дату в формате MySQL DATETIME
      const currentDate = new Date();
      const mysqlDate = currentDate.toISOString().slice(0, 19).replace('T', ' ');
      
      // Добавляем чат в список заблокированных
      await databaseQuery(
        'INSERT INTO chat_bans (chat_id, banned_by, banned_at, reason) VALUES (?, ?, ?, ?)',
        [chatId, context.senderId, mysqlDate, reason]
      );
      
      // Получаем информацию о сотруднике
      let staffName = `[id${context.senderId}|Сотрудник]`;
      try {
        const userInfo = await vk.api.users.get({
          user_ids: context.senderId,
          fields: 'first_name,last_name'
        });
        if (userInfo && userInfo[0]) {
          staffName = `[id${context.senderId}|${userInfo[0].first_name} ${userInfo[0].last_name}]`;
        }
      } catch (e) {}
      
      const roleName = getAccessLevelName(userAccess);
      
      // Форматируем дату
      function formatDate(date) {
        const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
        const month = months[date.getMonth()];
        const day = date.getDate();
        const year = date.getFullYear();
        let hours = date.getHours();
        let minutes = date.getMinutes();
        if (minutes < 10) minutes = '0' + minutes;
        return `${day} ${month} ${year} года в ${hours}:${minutes} по GMT+3`;
      }
      const formattedDate = formatDate(currentDate);
      
      let banMessage = `🚫 Чат ${chatId} заблокирован в боте.\n\n`;
      
      if (reason && reason !== 'Не указана') {
        banMessage += `Причина: ${reason}.\n`;
      } else {
        banMessage += `Причина блокировки не указана.\n`;
      }
      
      banMessage += `Решение принял сотрудник ${staffName} (${roleName}).\n`;
      banMessage += `Время блокировки: ${formattedDate}.`;
      
      await context.reply(banMessage);
      
      console.log(`[BANID] Чат ${chatId} заблокирован сотрудником ${context.senderId} (${roleName})`);
      
    } catch (error) {
      console.error('Ошибка в команде /banid:', error);
      await context.reply(`❌ Ошибка: ${error.message}`);
    }
  }
};
