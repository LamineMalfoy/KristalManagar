const { getUserRole, getRoleName, checkIfTableExists } = require('./roles.js');
const database = require('../databases.js');
const fs = require('fs');
const path = require('path');
const cacheManager = require('../cacheManager.js');

// Список системных команд, которые нельзя изменять
const SYSTEM_COMMANDS = [
  '/marriage', '/marriages', '/divorce', '/stats', '/ping', '/help',
  '/start', '/hello', '/rules', '/editowner', '/sysadmin',
  '/sysadmins', '/sysban', '/sysbanned', '/unsysban'
];

// Список команд модерации, которые можно изменять
const MODERATION_COMMANDS = [
  '/ban', '/unban', '/kick', '/warn', '/unwarn', '/mute', '/unmute',
  '/snick', '/rnick', '/del', '/pin', '/unpin', '/silence', '/тишина', '/role',
  '/unrole', '/addrole', '/delrole', '/gban', '/gunban', '/gkick',
  '/gnick', '/grole', '/gzov', '/zov', '/addadmin', '/gaddadmin', '/gsnick', '/grnick', '/mutelist',
  '/warnlist', '/getwarn', '/warnhistory', '/filter', '/settings',
  '/newrole', '/gnewrole', '/gdelrole', '/grr', '/rr', '/banlist', '/getban', '/getbynick', '/logs',
  '/editcmd', '/settings', '/wipe', // Теперь editcmd, settings и wipe можно изменять
  '/groups', '/ungroups', '/listgroups' // Команды управления обязательными подписками
];

// Стандартные приоритеты команд
const DEFAULT_PRIORITIES = {
  '/ban': 40,
  '/unban': 40,
  '/kick': 20,
  '/warn': 20,
  '/unwarn': 20,
  '/mute': 20,
  '/unmute': 20,
  '/snick': 20,
  '/rnick': 20,
  '/del': 40,
  '/pin': 60,
  '/unpin': 60,
  '/silence': 40,
  '/тишина': 40, // Алиас для silence
  '/role': 40,
  '/unrole': 40,
  '/addrole': 80,
  '/delrole': 80,
  '/gban': 50,
  '/gunban': 50,
  '/gkick': 40,
  '/gnick': 40,
  '/grole': 50,
  '/gzov': 40,
  '/zov': 20, // Команда зов (призыв)
  '/addadmin': 80,
  '/addlead': 80,
  '/addspec': 80,
  '/gaddadmin': 100,
  '/gaddlead': 100,
  '/gaddmoder': 100,
  '/gaddspec': 100,
  '/newrole': 80,
  '/gnewrole': 80, // Глобальное создание роли
  '/gdelrole': 80, // Глобальное удаление роли
  '/grr': 50, // Глобальное удаление роли из всех пуллов
  '/rr': 50, // Удаление роли
  '/mutelist': 20,
  '/warnlist': 20,
  '/banlist': 20, // Список забаненных
  '/getban': 20, // Информация о бане
  '/getbynick': 20, // Поиск по никнейму
  '/getwarn': 20,
  '/warnhistory': 20,
  '/filter': 40,
  '/settings': 60,
  '/logs': 60, // Журнал действий администрации
  '/gsnick': 40, // Глобальная установка никнейма
  '/grnick': 40, // Глобальное удаление никнейма
  '/pullinfo': 80, // Информация о пулле
  '/newrules': 80, // Установка правил беседы
  '/editcmd': 100, // По умолчанию только владелец может использовать editcmd
  '/wipe': 100, // Очистка данных чата (только владелец по умолчанию)
  '/groups': 100, // Добавление обязательных подписок (только владелец)
  '/ungroups': 100, // Удаление обязательных подписок (только владелец)
  '/listgroups': 100 // Просмотр списка обязательных подписок (только владелец)
};

// Функция для получения приоритетов команд
async function getCommandPriorities(peerId) {
  // Проверяем кэш
  const cacheKey = `priorities_${peerId}`;
  const cached = cacheManager.get('commandPriorities', cacheKey);
  if (cached) {
    return cached;
  }
  
  const prioritiesDir = path.join(__dirname, '../data', `command_priorities_${peerId}`);
  const prioritiesFile = path.join(prioritiesDir, 'priorities.json');
  
  let priorities;
  if (!fs.existsSync(prioritiesFile)) {
    priorities = { ...DEFAULT_PRIORITIES };
  } else {
    try {
      const data = fs.readFileSync(prioritiesFile, 'utf8');
      const customPriorities = JSON.parse(data);
      priorities = { ...DEFAULT_PRIORITIES, ...customPriorities };
    } catch (error) {
      console.error('Ошибка при чтении приоритетов команд:', error);
      priorities = { ...DEFAULT_PRIORITIES };
    }
  }
  
  // Сохраняем в кэш
  cacheManager.set('commandPriorities', cacheKey, priorities);
  return priorities;
}

// Функция для сохранения приоритетов команд
async function saveCommandPriorities(peerId, customPriorities) {
  const prioritiesDir = path.join(__dirname, '../data', `command_priorities_${peerId}`);
  const prioritiesFile = path.join(prioritiesDir, 'priorities.json');
  
  try {
    if (!fs.existsSync(prioritiesDir)) {
      fs.mkdirSync(prioritiesDir, { recursive: true });
    }
    
    // Сохраняем ВСЕ кастомные приоритеты, включая те, что равны дефолтным
    // Это нужно для правильной работы после изменения приоритета
    fs.writeFileSync(prioritiesFile, JSON.stringify(customPriorities, null, 2));
    return true;
  } catch (error) {
    console.error('Ошибка при сохранении приоритетов команд:', error);
    return false;
  }
}

// Функция для проверки приоритета команды
async function checkCommandPriority(peerId, userId, command) {
  // ВАЖНО: Используем getUserRole для получения роли пользователя
  const { getUserRole } = require('./roles.js');
  const userRole = await getUserRole(peerId, userId);
  
  const priorities = await getCommandPriorities(peerId);
  const requiredRole = priorities[command] || 0;
  
  return userRole >= requiredRole;
}

module.exports = {
  command: '/editcmd',
  aliases: ['/editcmd'],
  description: 'Изменить приоритет команды',
  async execute(context) {
    const { peerId, senderId, text } = context;
    const parts = text.split(' ');
    
    // Проверяем, что беседа активирована
    if (!await checkIfTableExists(`conference_${peerId}`)) {
      return context.send('⚠️ Беседа не активирована | Для активации используйте команду /start');
    }
    
    // Проверяем права на использование editcmd
    const priorities = await getCommandPriorities(peerId);
    const requiredRole = priorities['/editcmd'] || 100;
    const senderRole = await getUserRole(peerId, context.senderId);
    const senderRoleName = await getRoleName(peerId, senderRole);
    if (senderRole < requiredRole) {
      return context.reply(`⛔ Доступ запрещён | Для использования команды /editcmd требуется приоритет ${requiredRole} или выше\n👤 Ваша роль: ${senderRoleName} (приоритет ${senderRole})`);
    }
    
    // Проверяем аргументы
    if (parts.length < 3) {
      return context.reply('❓ Пример: /editcmd команда приоритет');
    }
    
    const command = parts[1].toLowerCase();
    const priority = parseInt(parts[2]);
    
    // Проверяем, что команда начинается с /
    if (!command.startsWith('/')) {
      return context.reply('❌ Команда должна начинаться с символа /');
    }
    
    // Проверяем, что это не системная команда
    if (SYSTEM_COMMANDS.includes(command)) {
      return context.reply('❌ Эта команда является системной и не может быть изменена');
    }
    
    // Проверяем, что команда в списке разрешенных
    if (!MODERATION_COMMANDS.includes(command)) {
      return context.reply('❌ Эта команда не может быть изменена. Доступны только команды модерации и администрирования');
    }
    
    // Проверяем корректность приоритета
    if (isNaN(priority) || priority < 0 || priority > 100) {
      return context.reply('❌ Приоритет должен быть числом от 0 до 100');
    }
    
    // ВАЖНО: Проверяем, что пользователь не пытается установить приоритет выше своего
    if (priority > senderRole) {
      return context.reply(`❌ Вы не можете установить приоритет выше вашего уровня (${senderRole})`);
    }
    
    // Загружаем только кастомные приоритеты из файла (без дефолтных)
    const prioritiesFile = path.join(__dirname, '../data', `command_priorities_${peerId}`, 'priorities.json');
    let customPriorities = {};
    if (fs.existsSync(prioritiesFile)) {
      try {
        customPriorities = JSON.parse(fs.readFileSync(prioritiesFile, 'utf8'));
      } catch (e) {
        customPriorities = {};
      }
    }
    
    // Обновляем приоритет команды
    customPriorities[command] = priority;
    
    // Сохраняем изменения
    if (await saveCommandPriorities(peerId, customPriorities)) {
      // Очищаем кэш приоритетов команд для этой беседы
      const cacheKey = `priorities_${peerId}`;
      cacheManager.invalidate('commandPriorities', cacheKey);
      
      return context.reply(`✅ Приоритет команды "${command}" успешно установлен на ${priority}.`);
    } else {
      return context.reply('❌ Произошла ошибка при сохранении приоритетов');
    }
  },
  // Экспортируем функции для использования в других модулях
  getCommandPriorities,
  checkCommandPriority,
  SYSTEM_COMMANDS,
  MODERATION_COMMANDS,
  DEFAULT_PRIORITIES
};