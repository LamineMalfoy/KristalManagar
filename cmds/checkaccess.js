const database = require('../databases.js');
const { checkSysAccess } = require('./sysadmin.js');
const { hasCommandAccess } = require('../utils/commandAccess.js');
const util = require('util');
const databaseQuery = util.promisify(database.query).bind(database);

module.exports = {
  command: '/checkaccess',
  description: 'Проверить доступ к системным командам',
  async execute(context) {
    try {
      const args = context.text.split(' ');
      let targetId = context.senderId;
      
      // Если указан пользователь, проверяем его (только для сотрудников)
      if (args.length > 1) {
        const senderAccess = await checkSysAccess(context.senderId);
        if (senderAccess === 0) {
          return context.reply('⛔ Вы можете проверить только свой доступ');
        }
        
        // Получаем ID пользователя
        const idMatch = args[1].match(/\[id(\d+)\|.*\]/) || args[1].match(/^(\d+)$/);
        
        if (idMatch) {
          targetId = parseInt(idMatch[1]);
        } else if (args[1].startsWith('@')) {
          try {
            const username = args[1].substring(1);
            const users = await vk.api.users.get({ user_ids: username });
            if (users && users[0]) {
              targetId = users[0].id;
            }
          } catch (error) {
            return context.send('❌ Не удалось найти пользователя');
          }
        } else {
          return context.send('❌ Неверный формат ID пользователя');
        }
      }
      
      // Получаем системный уровень доступа
      const sysAccess = await checkSysAccess(targetId);
      
      // Получаем информацию о пользователе
      let targetName = 'Пользователь';
      try {
        const userInfo = await vk.api.users.get({ user_ids: targetId });
        if (userInfo && userInfo[0]) {
          targetName = `${userInfo[0].first_name} ${userInfo[0].last_name}`;
        }
      } catch (error) {
        console.error('Ошибка при получении информации о пользователе:', error);
      }
      
      let message = `📊 Проверка доступа к командам\n`;
      message += `👤 Пользователь: [id${targetId}|${targetName}]\n`;
      message += `🔑 Системный уровень: ${getAccessLevelName(sysAccess)}\n\n`;
      
      // Список всех системных команд
      const systemCommands = [
        { cmd: 'ticket', name: '/ticket, /tickets' },
        { cmd: 'answer', name: '/answer' },
        { cmd: 'sysadmins', name: '/sysadmins' },
        { cmd: 'sysban', name: '/sysban' },
        { cmd: 'unsysban', name: '/unsysban' },
        { cmd: 'sysrole', name: '/sysrole' },
        { cmd: 'пополнить', name: '/пополнить' },
        { cmd: 'notif', name: '/notif' },
        { cmd: 'edit', name: '/edit' },
        { cmd: 'giveagent', name: '/giveagent' },
        { cmd: 'giveadm', name: '/giveadm' },
        { cmd: 'givezam', name: '/givezam' },
        { cmd: 'giveowner', name: '/giveowner' },
        { cmd: 'null', name: '/null' },
        { cmd: 'banreport', name: '/banreport' },
        { cmd: 'unbanreport', name: '/unbanreport' },
        { cmd: 'rbanlist', name: '/rbanlist' }
      ];
      
      // Проверяем доступ к каждой команде
      message += `📋 Доступ к командам:\n`;
      for (const command of systemCommands) {
        const hasAccess = await hasCommandAccess(targetId, command.cmd);
        const icon = hasAccess ? '✅' : '❌';
        message += `${icon} ${command.name}\n`;
      }
      
      // Проверяем индивидуальные настройки
      const individualSettings = await databaseQuery(
        'SELECT command, has_access FROM command_access WHERE user_id = ?',
        [targetId]
      );
      
      if (individualSettings && individualSettings.length > 0) {
        message += `\n⚙️ Индивидуальные настройки:\n`;
        for (const setting of individualSettings) {
          const icon = setting.has_access ? '✅ Разрешено' : '❌ Запрещено';
          message += `• ${setting.command}: ${icon}\n`;
        }
      }
      
      context.send(message);
      
    } catch (error) {
      console.error('Ошибка при выполнении команды checkaccess:', error);
      context.reply('❌ Произошла ошибка при выполнении команды');
    }
  }
};

function getAccessLevelName(level) {
  switch (level) {
    case 1: return 'Агент поддержки';
    case 2: return 'Администрация бота';
    case 3: return 'Заместитель основателя';
    case 4: return 'Основатель';
    case 5: return 'Разработчик';
    default: return 'Пользователь';
  }
}