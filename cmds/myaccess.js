const database = require('../databases.js');
const { checkSysAccess, getAccessLevelName } = require('./sysadmin.js');
const util = require('util');
const databaseQuery = util.promisify(database.query);

module.exports = {
  command: '/myaccess',
  description: 'Просмотр информации о своем уровне доступа в системе бота',
  async execute(context) {
    try {
       
      const userAccess = await checkSysAccess(context.senderId);
      
       
      let message;
      
      if (userAccess === 0) {
        message = '👤 У вас нет прав доступа к системе бота';
      } else {
        message = `👑 Ваш уровень доступа: ${getAccessLevelName(userAccess)}\n\n`;
        
         
        message += '📋 Доступные команды:\n';
        
         
        message += '• /myaccess - Информация о вашем уровне доступа\n';
        message += '• /sysadmins - Список администраторов системы\n';
        
         
        if (userAccess >= 1) {
          message += '• /tickets - Список открытых тикетов\n';
          message += '• /tickets all - Список всех тикетов\n';
          message += '• /ticket [ID] - Просмотр информации о тикете\n';
          message += '• /answer [ID] [ответ] - Ответ на тикет\n';
          message += '• /sysbanned - Список заблокированных пользователей\n';
          message += '• /banreport [ID] - Блокировка возможности создания тикетов\n';
          message += '• /unbanreport [ID] - Разблокировка возможности создания тикетов\n';
          message += '• /rbanlist - Список заблокированных в системе репортов\n';
          message += '• /пополнить [ID] [dollars/btc] [сумма] - Пополнение баланса пользователя\n';
        }
        
         
        if (userAccess >= 2) {
          message += '• /sysban [ID] [дни] [причина] - Блокировка пользователя\n';
          message += '• /unsysban [ID] - Разблокировка пользователя\n';
          message += '• /notif [сообщение] - Отправка уведомления по всем чатам\n';
          message += '• /giveagent [ID] - Выдача статуса агента поддержки\n';
        }
        
         
        if (userAccess >= 3) {
          message += '• /giveadm [ID] - Выдача статуса администрации бота\n';
        }
        
         
        if (userAccess >= 4) {
          message += '• /givezam [ID] - Выдача статуса заместителя основателя\n';
        }
        
         
        if (userAccess === 5) {
          message += '• /giveowner [ID] - Выдача статуса основателя\n';
          message += '• [Секретные команды разработчика]\n';
        }
        
         
        if (userAccess >= 1) {
          message += '• /null [ID] - Снятие прав доступа (в рамках ваших полномочий)\n';
        }
        
         
        message += '\n📝 Для пользователей доступна команда:\n';
        message += '• /report [сообщение] - Создание тикета в системе поддержки';
      }
      
       
      context.reply(message);
    } catch (error) {
      console.error('Ошибка при выполнении команды myaccess:', error);
      context.reply('❌ Произошла ошибка при выполнении команды');
    }
  },
};