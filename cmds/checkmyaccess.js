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
          message += `• /tickets - Список открытых тикетов\n`;
          message += `• /sysbanned - Список заблокированных пользователей\n`;
          message += `• /banreport [ID] - Блокировка возможности создания тикетов\n`;
          message += `• /unbanreport [ID] - Разблокировка возможности создания тикетов\n`;
          message += `• /rbanlist - Список заблокированных в системе репортов\n`;
          message += `• /checkban [ID] - Проверка статуса бана пользователя\n`;
        }
        
        if (access >= 2) {
          message += `• /sysban [ID] [дни] [причина] - Блокировка пользователя\n`;
          message += `• /unsysban [ID] - Разблокировка пользователя\n`;
          message += `• /giveagent [ID] - Выдача статуса агента поддержки\n`;
          message += `• /sysinfo [ID] - Полная информация о пользователе\n`;
          message += `• /sysinfo_search [ID] - Поиск пользователя в системной базе\n`;
          message += `• /notif [текст] - Системное уведомление/рассылка\n`;
          message += `• /null [ID] - Сброс доступов пользователя\n`;
        }
        
        if (access >= 3) {
          message += `• /giveadm [ID] - Выдача статуса администрации бота\n`;
          message += `• /sysrole [ID] [уровень] - Изменение уровня доступа\n`;
          message += `• /edit [ID] - Редактирование прав доступа к командам\n`;
          message += `• /setreportchat - Установка чата для жалоб\n`;
          message += `• /setpublic - Установка публичной страницы\n`;
        }
        
        if (access >= 4) {
          message += `• /givezam [ID] - Выдача статуса заместителя основателя\n`;
          message += `• /chatid - Узнать ID текущего чата\n`;
          message += `• /checkchats - Проверка состояния чатов\n`;
          message += `• /logs - Просмотр логов действий\n`;
          message += `• /transfer [ID] [сумма] - Перевод средств\n`;
        }
        
        if (access === 5) {
          message += `• /giveowner [ID] - Выдача статуса основателя\n`;
          message += `• /checkmyaccess - Проверка своих прав доступа\n`;
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