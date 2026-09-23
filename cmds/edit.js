const { Keyboard } = require('vk-io');
const { checkSysAccess, canManageAccess } = require('./sysadmin.js');
const { extractNumericId } = require('./ban.js');
const { vk } = require('../index.js');
const { hasCommandAccess } = require('../utils/commandAccess.js');
const database = require('../databases.js');
const util = require('util');
const path = require('path');
const fs = require('fs');
const databaseQuery = util.promisify(database.query).bind(database);

// Список системных команд и их описания
const systemCommands = {
  ticket: {
    name: '!ticket',
    description: 'Команды тикетов (/ticket, /tickets, /tickets all)',
    minAccess: 1
  },
  answer: {
    name: '!answer',
    description: 'Ответ на тикет (/answer)',
    minAccess: 1
  },
  banreport: {
    name: '!banreport',
    description: 'Блокировка возможности создания тикетов (/banreport)',
    minAccess: 1
  },
  unbanreport: {
    name: '!unbanreport',
    description: 'Разблокировка возможности создания тикетов (/unbanreport)',
    minAccess: 1
  },
  rbanlist: {
    name: '!rbanlist',
    description: 'Список заблокированных в системе репортов (/rbanlist)',
    minAccess: 1
  },
  sysadmins: {
    name: '!sysadmins',
    description: 'Список системных администраторов (/sysadmins)',
    minAccess: 1
  },
  sysban: {
    name: '!sysban',
    description: 'Системная блокировка (/sysban, /sysbanned)',
    minAccess: 2
  },
  unsysban: {
    name: '!unsysban',
    description: 'Снятие системной блокировки (/unsysban)',
    minAccess: 2
  },
  sysrole: {
    name: '!sysrole',
    description: 'Управление системными ролями (/sysrole)',
    minAccess: 3
  },
  givemoney: {
    name: '!givemoney',
    description: 'Пополнение баланса (/givemoney)',
    minAccess: 4
  },
  notif: {
    name: '!notif',
    description: 'Системные уведомления (/notif)',
    minAccess: 3
  },
  giveagent: {
    name: '!giveagent',
    description: 'Выдача прав агента',
    minAccess: 2
  },
  giveadm: {
    name: '!giveadm',
    description: 'Выдача прав администратора',
    minAccess: 3
  },
  givezam: {
    name: '!givezam',
    description: 'Выдача прав заместителя',
    minAccess: 4
  },
  giveowner: {
    name: '!giveowner',
    description: 'Выдача прав основателя',
    minAccess: 5
  },
  null: {
    name: '!null',
    description: 'Снятие всех прав',
    minAccess: 2
  },
  edit: {
    name: '!edit',
    description: 'Управление доступом к командам (/edit)',
    minAccess: 3
  }
};

// Функция для получения прав пользователя на команды
async function getUserCommandAccess(userId) {
  try {
    // Сначала проверяем системный доступ пользователя
    const sysAccess = await checkSysAccess(userId);
    
    const commandAccess = {};
    
    // Инициализируем доступ для всех команд на основе системного уровня
    for (const cmd in systemCommands) {
      // По умолчанию доступ есть если уровень пользователя >= минимальному уровню команды
      commandAccess[cmd] = sysAccess >= systemCommands[cmd].minAccess;
    }
    
    // Попытаемся получить индивидуальные настройки доступа из файловой базы
    try {
      const userAccessFile = path.join(__dirname, '../data/user_command_access', `${userId}.json`);
      if (fs.existsSync(userAccessFile)) {
        const userAccess = JSON.parse(fs.readFileSync(userAccessFile, 'utf8'));
        
        // Применяем индивидуальные настройки доступа
        for (const cmd in userAccess) {
          if (systemCommands[cmd]) {
            commandAccess[cmd] = userAccess[cmd];
          }
        }
      }
    } catch (fileError) {
      console.log(`📝 Индивидуальные настройки доступа для пользователя ${userId} не найдены, используем системные`);
    }
    
    return { sysAccess, commandAccess };
  } catch (error) {
    console.error('Ошибка при получении прав доступа:', error);
    return { sysAccess: 0, commandAccess: {} };
  }
}

// Функция для обновления доступа к команде (через файловую систему)
async function updateCommandAccess(userId, command, hasAccess) {
  try {
    console.log(`💾 Обновляем доступ к команде: userId=${userId}, command=${command}, hasAccess=${hasAccess}`);
    
    // Путь к файлу доступа пользователя (так же как в getUserCommandAccess)
    const userAccessDir = path.join(__dirname, '../data/user_command_access');
    const userAccessFile = path.join(userAccessDir, `${userId}.json`);
    
    // Создаем директорию если не существует
    if (!fs.existsSync(userAccessDir)) {
      fs.mkdirSync(userAccessDir, { recursive: true });
    }
    
    // Читаем существующие настройки пользователя
    let userAccess = {};
    if (fs.existsSync(userAccessFile)) {
      try {
        const fileContent = fs.readFileSync(userAccessFile, 'utf8');
        if (fileContent.trim()) {
          userAccess = JSON.parse(fileContent);
        }
      } catch (parseError) {
        console.log(`⚠️ Ошибка парсинга файла доступа, создаем новый`);
        userAccess = {};
      }
    }
    
    // Обновляем доступ к конкретной команде
    userAccess[command] = hasAccess;
    
    // Сохраняем обновленные настройки
    fs.writeFileSync(userAccessFile, JSON.stringify(userAccess, null, 2));
    
    console.log(`✅ Доступ к команде ${command} для пользователя ${userId} обновлен: ${hasAccess}`);
    console.log(`💾 Файл сохранен: ${userAccessFile}`);
    return true;
  } catch (error) {
    console.error('Ошибка при обновлении доступа к команде:', error);
    return false;
  }
}

module.exports = {
  command: '/edit',
  aliases: [],
  description: 'Редактирование прав доступа к системным командам',
  requiredRole: 0,
  // Экспортируем функции для использования в callback обработчиках
  getUserCommandAccess,
  updateCommandAccess,
  
  async execute(context) {
    console.log('🔍 /edit команда запущена');
    const { senderId, text } = context;
    const args = text.split(' ').slice(1);
    console.log('📋 Аргументы:', args);
    
    try {
      // Проверяем права доступа к команде edit
      console.log('🔒 Проверка доступа для пользователя:', senderId);
      const hasAccess = await hasCommandAccess(senderId, 'edit');
      console.log('👑 Доступ к команде edit:', hasAccess);
      
      if (!hasAccess) {
        console.log('❌ Доступ запрещен');
        return context.send('❌ У вас нет доступа к команде управления правами');
      }
    
      if (args.length === 0) {
        return context.send('❌ Использование: /edit [ID пользователя]');
      }
      
      // 🔧 ПРАВИЛЬНОЕ ИЗВЛЕЧЕНИЕ ID ЧЕРЕЗ extractNumericId
      const targetId = await extractNumericId(args[0]);
      
      if (!targetId) {
        return context.send('❌ Не удалось определить ID пользователя');
      }
      
      console.log('🔍 Получение информации о целевом пользователе:', targetId);
      
      // Получаем системные уровни доступа
      const senderSysAccess = await checkSysAccess(senderId);
      const targetAccess = await checkSysAccess(targetId);
      console.log('🔑 Системный доступ отправителя:', senderSysAccess);
      console.log('🔑 Системный доступ целевого пользователя:', targetAccess);
      
      // 🛡️ ОСОБАЯ ЛОГИКА ЗАЩИТЫ: пользователь с доступом к edit не может редактировать права того, кто выше его по системной иерархии
      if (targetAccess > senderSysAccess) {
        console.log('🛡️ Защита: попытка редактировать права вышестоящего');
        return context.send('🛡️ Защита системы | Вы не можете редактировать права пользователя с более высоким системным уровнем доступа');
      }
      
      const targetInfo = await getUserCommandAccess(targetId);
      console.log('📋 Информация о доступе к командам получена');
      
      // Проверяем, может ли текущий пользователь редактировать права целевого
      if (!canManageAccess(senderSysAccess, targetAccess)) {
        console.log('❌ Недостаточно прав для редактирования');
        return context.send('❌ Вы не можете редактировать права этого пользователя');
      }
      
      console.log('✅ Проверка прав пройдена, получаем информацию о пользователе');
      
      // Получаем информацию о пользователе
      let targetName = 'Пользователь';
      try {
        console.log('🔍 Запрос информации о пользователе через VK API');
        const userInfo = await vk.api.users.get({ user_ids: targetId });
        if (userInfo && userInfo[0]) {
          targetName = `${userInfo[0].first_name} ${userInfo[0].last_name}`;
          console.log('👤 Имя пользователя получено:', targetName);
        }
      } catch (error) {
        console.error('❌ Ошибка при получении информации о пользователе:', error);
      }
      
      console.log('📝 Формирование сообщения и клавиатуры');
      
      // Формируем сообщение
      let message = `🎛️ Редактирование прав доступа | 👤 ${targetName} | 🔑 ${getAccessLevelName(targetInfo.sysAccess)}\n\n`;
      message += `📋 Нажмите кнопку для переключения доступа\n\n`;
      
      // Создаем клавиатуру
      console.log('⌨️ Создание клавиатуры с пагинацией');
      const keyboard = Keyboard.builder();
      
      // Разбиваем команды на страницы по 3 кнопки (3 команды + навигация + закрыть = 5-6 кнопок максимум)
      const commandEntries = Object.entries(systemCommands);
      const pageSize = 3; // Уменьшаем до 3 команд на страницу для совместимости с VK API
      const currentPage = 0; // Начинаем с первой страницы
      const totalPages = Math.ceil(commandEntries.length / pageSize);
      
      console.log(`📄 Всего команд: ${commandEntries.length}, страниц: ${totalPages}`);
      
      // Получаем команды для текущей страницы
      const startIndex = currentPage * pageSize;
      const endIndex = Math.min(startIndex + pageSize, commandEntries.length);
      const currentPageCommands = commandEntries.slice(startIndex, endIndex);
      
      console.log(`📋 Показываем команды ${startIndex + 1}-${endIndex} из ${commandEntries.length}`);
      
      // Добавляем кнопки команд для текущей страницы
      for (const [cmdKey, cmdInfo] of currentPageCommands) {
        const hasAccess = targetInfo.commandAccess[cmdKey];
        const color = hasAccess ? Keyboard.POSITIVE_COLOR : Keyboard.NEGATIVE_COLOR;
        const emoji = hasAccess ? '✅' : '❌';
        
        keyboard.callbackButton({
          label: `${emoji} ${cmdInfo.name}`,
          payload: {
            command: 'toggle_command_access',
            target_id: targetId,
            cmd_key: cmdKey,
            editor_id: senderId,
            page: currentPage
          },
          color: color
        });
        keyboard.row(); // Каждая кнопка на отдельной строке для лучшей читаемости
      }
      
      // Добавляем навигационные кнопки если страниц больше одной
      if (totalPages > 1) {
        const navRow = [];
        
        if (currentPage > 0) {
          navRow.push({
            label: '⬅️ Назад',
            payload: {
              command: 'edit_page_nav',
              target_id: targetId,
              page: currentPage - 1,
              editor_id: senderId
            },
            color: Keyboard.SECONDARY_COLOR
          });
        }
        
        navRow.push({
          label: `${currentPage + 1}/${totalPages}`,
          payload: {
            command: 'edit_page_info',
            target_id: targetId,
            page: currentPage,
            editor_id: senderId
          },
          color: Keyboard.SECONDARY_COLOR
        });
        
        if (currentPage < totalPages - 1) {
          navRow.push({
            label: 'Вперёд ➡️',
            payload: {
              command: 'edit_page_nav',
              target_id: targetId,
              page: currentPage + 1,
              editor_id: senderId
            },
            color: Keyboard.SECONDARY_COLOR
          });
        }
        
        // Добавляем навигационные кнопки
        for (const btn of navRow) {
          keyboard.callbackButton(btn);
        }
        keyboard.row();
      }
      
      // Добавляем кнопку закрытия
      keyboard.callbackButton({
        label: '❌ Закрыть',
        payload: {
          command: 'close_edit_menu',
          editor_id: senderId
        },
        color: Keyboard.NEGATIVE_COLOR
      });
      
      console.log('📤 Отправка сообщения с клавиатурой');
      console.log('📝 Длина сообщения:', message.length);
      console.log('⌨️ Количество кнопок в клавиатуре:', Object.keys(systemCommands).length);
      
      try {
        await context.send({
          message,
          keyboard: keyboard.inline()
        });
        console.log('✅ Сообщение успешно отправлено');
      } catch (sendError) {
        console.error('❌ Ошибка при отправке сообщения:', sendError);
        // Попробуем отправить упрощенное сообщение
        await context.send('🎛️ Редактирование прав доступа\n\n❌ Ошибка при создании интерактивного меню');
      }
      
    } catch (error) {
      console.error('❌ Ошибка в команде /edit:', error);
      return context.send('❌ Произошла ошибка при обработке команды');
    }
  }
};

// Вспомогательная функция для получения названия уровня доступа
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
