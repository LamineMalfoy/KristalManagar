const { checkSysAccess } = require('../cmds/sysadmin.js');
const path = require('path');
const fs = require('fs');

// 🔧 ПОЛНАЯ ПРОВЕРКА ДОСТУПА С ИНДИВИДУАЛЬНЫМИ НАСТРОЙКАМИ
async function hasCommandAccess(userId, commandName) {
  try {
    // Получаем системный уровень доступа пользователя
    const sysAccess = await checkSysAccess(userId);
    
    console.log(`[DEBUG] Checking access for user ${userId} to command ${commandName}, sysAccess: ${sysAccess}`);
    
    // Если у пользователя нет системного доступа вообще, он не может использовать команды
    if (sysAccess === 0) {
      return false;
    }
    
    // Получаем доступ по умолчанию на основе системного уровня
    let hasAccess = checkDefaultAccess(sysAccess, commandName);
    
    // Проверяем индивидуальные настройки доступа
    try {
      const userAccessFile = path.join(__dirname, '../data/user_command_access', `${userId}.json`);
      if (fs.existsSync(userAccessFile)) {
        const fileContent = fs.readFileSync(userAccessFile, 'utf8');
        if (fileContent.trim()) {
          const userAccess = JSON.parse(fileContent);
          
          // Если есть индивидуальная настройка для этой команды
          if (userAccess.hasOwnProperty(commandName)) {
            hasAccess = userAccess[commandName];
            console.log(`[DEBUG] Using individual setting for user ${userId}, command ${commandName}: ${hasAccess}`);
          } else {
            console.log(`[DEBUG] No individual setting for command ${commandName}, using default: ${hasAccess}`);
          }
        }
      } else {
        console.log(`[DEBUG] No individual access file for user ${userId}, using default: ${hasAccess}`);
      }
    } catch (fileError) {
      console.log(`[DEBUG] Error reading individual access file for user ${userId}:`, fileError.message);
      console.log(`[DEBUG] Using default access for command ${commandName}: ${hasAccess}`);
    }
    
    return hasAccess;
  } catch (error) {
    console.error('Ошибка при проверке доступа к команде:', error);
    return false;
  }
}

// Проверяет доступ по умолчанию на основе системного уровня
function checkDefaultAccess(sysAccess, commandName) {
  const commandMinAccess = {
    'ticket': 1,      // Агент поддержки и выше
    'answer': 1,      // Агент поддержки и выше
    'sysadmins': 1,   // Агент поддержки и выше
    'sysban': 2,      // Администрация бота и выше
    'unsysban': 2,    // Администрация бота и выше
    'sysrole': 3,     // Заместитель основателя и выше
    'пополнить': 4,   // Основатель и выше
    'notif': 3,       // Заместитель основателя и выше

    'giveagent': 2,   // Администрация бота и выше
    'giveadm': 3,     // Заместитель основателя и выше
    'givezam': 4,     // Основатель и выше
    'giveowner': 5,   // Только разработчик
    'null': 2,        // Администрация бота и выше
    'edit': 3,        // Заместитель основателя и выше
    'rbanlist': 1,    // Агент поддержки и выше
    'banreport': 1,   // Агент поддержки и выше
    'unbanreport': 1  // Агент поддержки и выше
  };
  
  const minAccess = commandMinAccess[commandName];
  if (minAccess === undefined) {
    // Если команда не определена, по умолчанию требуем минимальный доступ
    return sysAccess >= 1;
  }
  
  return sysAccess >= minAccess;
}

// Получает сообщение об ошибке доступа для команды
function getAccessDeniedMessage(commandName) {
  const commandDescriptions = {
    'ticket': { name: 'просмотра тикетов', level: 'Агент поддержки' },
    'answer': { name: 'ответа на тикеты', level: 'Агент поддержки' },
    'sysadmins': { name: 'просмотра системных администраторов', level: 'Агент поддержки' },
    'sysban': { name: 'системной блокировки пользователей', level: 'Администрация бота' },
    'unsysban': { name: 'снятия системной блокировки', level: 'Администрация бота' },
    'sysrole': { name: 'управления системными ролями', level: 'Заместитель основателя' },
    'пополнить': { name: 'пополнения баланса', level: 'Основатель' },
    'notif': { name: 'отправки системных уведомлений', level: 'Заместитель основателя' },

    'giveagent': { name: 'выдачи прав агента', level: 'Администрация бота' },
    'giveadm': { name: 'выдачи прав администратора', level: 'Заместитель основателя' },
    'givezam': { name: 'выдачи прав заместителя', level: 'Основатель' },
    'giveowner': { name: 'выдачи прав основателя', level: 'Разработчик' },
    'null': { name: 'снятия всех прав', level: 'Администрация бота' },
    'edit': { name: 'управления доступом к командам', level: 'Заместитель основателя' },
    'rbanlist': { name: 'просмотра списка заблокированных в репортах', level: 'Агент поддержки' },
    'banreport': { name: 'блокировки в системе репортов', level: 'Агент поддержки' },
    'unbanreport': { name: 'разблокировки в системе репортов', level: 'Агент поддержки' }
  };
  
  const cmdInfo = commandDescriptions[commandName];
  if (!cmdInfo) {
    return '⛔ Доступ запрещен | У вас нет прав для использования этой команды';
  }
  
  return `⛔ Доступ запрещен | У вас недостаточно прав для ${cmdInfo.name}\n👑 Требуемый уровень: ${cmdInfo.level}`;
}

module.exports = {
  hasCommandAccess,
  getAccessDeniedMessage
};