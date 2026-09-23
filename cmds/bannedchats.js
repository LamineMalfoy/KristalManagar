const vk = require('../vkInstance.js');
const { query } = require('../filedb.js');
const util = require('util');
const databaseQuery = util.promisify(query);
const { checkSysAccess, getAccessLevelName } = require('./sysadmin.js');

module.exports = {
  command: '/bannedchats',
  aliases: ['/забаненныечаты', '/списокбанов'],
  description: 'Показать список заблокированных чатов. Использование: /bannedchats',
  async execute(context) {
    try {
      // Проверяем права системного администратора (минимум зам основателя - уровень 3)
      const userAccess = await checkSysAccess(context.senderId);
      
      if (userAccess < 3) {
        await context.reply('❌ У вас нет прав для использования этой команды. Доступна с роли заместителя основателя.');
        return;
      }
      
      // Получаем список всех заблокированных чатов
      const bannedChats = await databaseQuery(
        'SELECT * FROM chat_bans ORDER BY banned_at DESC'
      );
      
      if (!bannedChats || bannedChats.length === 0) {
        await context.reply('✅ В данный момент нет заблокированных чатов.');
        return;
      }
      
      let message = `🚫 Список заблокированных чатов (${bannedChats.length}):\n\n`;
      
      for (let i = 0; i < bannedChats.length; i++) {
        const ban = bannedChats[i];
        const num = i + 1;
        
        // Получаем информацию о чате
        let chatTitle = 'Неизвестный чат';
        try {
          const chatInfo = await vk.api.messages.getConversationsById({
            peer_ids: ban.chat_id
          });
          if (chatInfo.items && chatInfo.items.length > 0) {
            chatTitle = chatInfo.items[0].chat_settings?.title || 'Без названия';
          }
        } catch (e) {
          chatTitle = 'Чат не найден';
        }
        
        // Получаем информацию о сотруднике
        let staffName = `[id${ban.banned_by}|Сотрудник]`;
        let staffAccess = 0;
        try {
          staffAccess = await checkSysAccess(ban.banned_by);
          const userInfo = await vk.api.users.get({
            user_ids: ban.banned_by,
            fields: 'first_name,last_name'
          });
          if (userInfo && userInfo[0]) {
            staffName = `[id${ban.banned_by}|${userInfo[0].first_name} ${userInfo[0].last_name}]`;
          }
        } catch (e) {}
        
        const roleName = getAccessLevelName(staffAccess);
        
        // Форматируем дату
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
        const banDate = formatDate(ban.banned_at);
        
        message += `${num}. ${chatTitle}\n`;
        message += `   🆔 ID: ${ban.chat_id}\n`;
        message += `   🔒 Заблокировал: ${staffName} (${roleName})\n`;
        message += `   📅 Время: ${banDate}\n`;
        
        if (ban.reason && ban.reason !== 'Не указана') {
          message += `   📋 Причина: ${ban.reason}\n\n`;
        } else {
          message += `   📋 Причина не указана\n\n`;
        }
      }
      
      message += `ℹ️ Используйте /unbanid [ID] для разблокировки чата.`;
      
      await context.reply(message);
      
    } catch (error) {
      console.error('Ошибка в команде /bannedchats:', error);
      await context.reply(`❌ Ошибка: ${error.message}`);
    }
  }
};
