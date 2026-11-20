const database = require('../databases.js');
const { checkSysAccess, getAccessLevelName } = require('./sysadmin.js');
const util = require('util');
const databaseQuery = util.promisify(database.query);

module.exports = {
  command: '/checkmyaccess',
  description: 'Проверка ваших прав доступа в системе бота',
  async execute(context) {
    try {
      const userId = context.senderId;
      const access = await checkSysAccess(userId);
      const accessName = getAccessLevelName(access);
      
      let message = `👤 Проверка прав доступа\n\n`;
      message += `🆔 Ваш ID: ${userId}\n`;
      message += `👑 Уровень доступа: ${access} (${accessName})\n\n`;
      
      if (access === 0) {
        message += `❌ У вас нет прав доступа к системе бота\n`;
        message += `📝 Доступные команды:\n`;
        message += `• /report [сообщение] - Создание тикета в системе поддержки\n`;
      } else {
        message += `✅ У вас есть права доступа к системе бота\n\n`;
        message += `📋 Доступные команды:\n`;
        message += `• /myaccess - Подробная информация о правах\n`;
        message += `• /sysadmins - Список администраторов системы\n`;
        
        if (access >= 1) {
          message += `• /tickets - Список открытых тикетов
`;
          message += `• /sysbanned - Список заблокированных пользователей
`;
          message += `• /banreport [ID] - Блокировка возможности создания тикетов
`;
          message += `• /unbanreport [ID] - Разблокировка возможности создания тикетов
`;
          message += `• /rbanlist - Список заблокированных в системе репортов
`;
        }
        
        if (access >= 2) {
          message += `• /sysban [ID] [дни] [причина] - Блокировка пользователя\n`;
          message += `• /unsysban [ID] - Разблокировка пользователя\n`;
          message += `• /giveagent [ID] - Выдача статуса агента поддержки\n`;
        }
        
        if (access >= 3) {
          message += `• /giveadm [ID] - Выдача статуса администрации бота\n`;
        }
        
        if (access >= 4) {
          message += `• /givezam [ID] - Выдача статуса заместителя основателя\n`;
        }
        
        if (access === 5) {
          message += `• /giveowner [ID] - Выдача статуса основателя\n`;
          message += `• 🔧 Секретные команды разработчика\n`;
        }
      }
      
      context.reply(message);
    } catch (error) {
      console.error('Ошибка при проверке прав доступа:', error);
      context.reply('❌ Произошла ошибка при проверке прав доступа');
    }
  }
};