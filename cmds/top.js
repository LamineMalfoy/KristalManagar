const { getUserBalance, getUserBTC, getAllUsersWithReputation, getUserReputation } = require('../filedb.js');
const vk = require('../vkInstance.js');
const { getUserRole, checkIfTableExists } = require('./roles.js');
const { Keyboard } = require('vk-io');

// Функция для форматирования денег в VK-стиле (из topup.js)
function formatMoney(amount) {
  if (amount >= 1000000000000) {
    return `${(amount / 1000000000000).toFixed(1).replace('.0', '')}ккк`;
  } else if (amount >= 1000000000) {
    return `${(amount / 1000000000).toFixed(1).replace('.0', '')}млрд`;
  } else if (amount >= 1000000) {
    return `${(amount / 1000000).toFixed(1).replace('.0', '')}кк`;
  } else if (amount >= 1000) {
    return `${(amount / 1000).toFixed(1).replace('.0', '')}к`;
  } else {
    return amount.toString();
  }
}

// Кэш для VK имен пользователей
const nameCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 минут

// Функция для получения VK имени пользователя с кэшированием
async function getVKName(userId) {
  const cacheKey = userId.toString();
  const cached = nameCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.name;
  }
  
  try {
    const userInfo = await vk.api.users.get({ user_ids: userId });
    if (userInfo && userInfo[0]) {
      const name = `[id${userId}|${userInfo[0].first_name} ${userInfo[0].last_name}]`;
      nameCache.set(cacheKey, { name, timestamp: Date.now() });
      return name;
    }
  } catch (error) {
    console.error(`Ошибка при получении имени пользователя ${userId}:`, error);
  }
  
  const fallbackName = `[id${userId}|Пользователь]`;
  nameCache.set(cacheKey, { name: fallbackName, timestamp: Date.now() });
  return fallbackName;
}

// Функция для получения нескольких VK имен одним запросом
async function getVKNames(userIds) {
  const uncachedIds = [];
  const result = {};
  
  // Проверяем кэш
  for (const userId of userIds) {
    const cacheKey = userId.toString();
    const cached = nameCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      result[userId] = cached.name;
    } else {
      uncachedIds.push(userId);
    }
  }
  
  // Запрашиваем недостающие имена
  if (uncachedIds.length > 0) {
    try {
      const userInfo = await vk.api.users.get({ user_ids: uncachedIds.join(',') });
      
      for (const user of userInfo) {
        const name = `[id${user.id}|${user.first_name} ${user.last_name}]`;
        result[user.id] = name;
        nameCache.set(user.id.toString(), { name, timestamp: Date.now() });
      }
    } catch (error) {
      console.error('Ошибка при получении имен пользователей:', error);
      
      // Добавляем fallback имена для неполученных пользователей
      for (const userId of uncachedIds) {
        if (!result[userId]) {
          const fallbackName = `[id${userId}|Пользователь]`;
          result[userId] = fallbackName;
          nameCache.set(userId.toString(), { name: fallbackName, timestamp: Date.now() });
        }
      }
    }
  }
  
  return result;
}

// Функция для получения всех пользователей с балансом (доллары)
async function getAllUsersWithBalance() {
  const fs = require('fs');
  const path = require('path');
  
  const balancesDir = path.join(__dirname, '..', 'data', 'user_balances');
  
  if (!fs.existsSync(balancesDir)) {
    return [];
  }
  
  try {
    const files = fs.readdirSync(balancesDir);
    const users = [];
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        const userId = file.replace('.json', '');
        const filePath = path.join(balancesDir, file);
        
        try {
          const data = fs.readFileSync(filePath, 'utf8');
          const balanceData = JSON.parse(data);
          const balance = balanceData.balance || 0;
          
          if (balance > 0) {
            users.push({
              userId: parseInt(userId),
              balance: balance
            });
          }
        } catch (fileError) {
          console.error(`Ошибка при чтении файла баланса ${file}:`, fileError);
        }
      }
    }
    
    users.sort((a, b) => b.balance - a.balance);
    return users;
  } catch (error) {
    console.error('Ошибка при чтении директории балансов:', error);
    return [];
  }
}

// Функция для получения всех пользователей с BTC
async function getAllUsersWithBTC() {
  const fs = require('fs');
  const path = require('path');
  
  const balancesDir = path.join(__dirname, '..', 'data', 'user_balances');
  
  if (!fs.existsSync(balancesDir)) {
    return [];
  }
  
  try {
    const files = fs.readdirSync(balancesDir);
    const users = [];
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        const userId = file.replace('.json', '');
        const filePath = path.join(balancesDir, file);
        
        try {
          const data = fs.readFileSync(filePath, 'utf8');
          const balanceData = JSON.parse(data);
          const btc = balanceData.btc || 0;
          
          if (btc > 0) {
            users.push({
              userId: parseInt(userId),
              btc: btc
            });
          }
        } catch (fileError) {
          console.error(`Ошибка при чтении файла BTC ${file}:`, fileError);
        }
      }
    }
    
    users.sort((a, b) => b.btc - a.btc);
    return users;
  } catch (error) {
    console.error('Ошибка при чтении директории BTC:', error);
    return [];
  }
}

// Функция для получения топа по сообщениям в беседе (из mtop.js)
async function getTopMessageUsers(peerId) {
  const fs = require('fs');
  const path = require('path');
  const conferenceDir = path.join(__dirname, '../data', `conference_${peerId}`);
  
  if (!fs.existsSync(conferenceDir)) {
    return [];
  }
  
  const files = fs.readdirSync(conferenceDir).filter(f => f.endsWith('.json'));
  const usersWithMessages = [];
  
  for (const file of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(conferenceDir, file), 'utf8'));
      if (data.messages_count && data.messages_count > 0) {
        usersWithMessages.push({
          userId: parseInt(file.replace('.json', '')),
          messages_count: data.messages_count
        });
      }
    } catch (e) {
      console.error('Ошибка при чтении файла:', file, e);
    }
  }
  
  usersWithMessages.sort((a, b) => b.messages_count - a.messages_count);
  return usersWithMessages.slice(0, 10);
}

// Функция для получения глобальной статистики игр
async function getTopGameUsers() {
  const fs = require('fs');
  const path = require('path');
  
  try {
    // Путь к глобальной статистике игр
    const gameStatsPath = path.join(__dirname, '..', 'data', 'game_stats.json');
    
    if (!fs.existsSync(gameStatsPath)) {
      return [];
    }
    
    const data = fs.readFileSync(gameStatsPath, 'utf8');
    const gameStats = JSON.parse(data);
    
    // Преобразуем объект в массив и сортируем
    const usersWithStats = Object.entries(gameStats).map(([userId, stats]) => ({
      userId: parseInt(userId),
      totalWins: (stats.words_wins || 0) + (stats.casino_wins || 0) + (stats.other_wins || 0),
      words_wins: stats.words_wins || 0,
      casino_wins: stats.casino_wins || 0,
      other_wins: stats.other_wins || 0
    }));
    
    // Сортируем по общему количеству побед
    usersWithStats.sort((a, b) => b.totalWins - a.totalWins);
    
    return usersWithStats.slice(0, 10); // Топ-10
  } catch (error) {
    console.error('Ошибка при чтении статистики игр:', error);
    return [];
  }
}

// Функция для обновления статистики игр
async function updateGameStats(userId, gameType, isWin = true) {
  const fs = require('fs');
  const path = require('path');
  
  try {
    const gameStatsPath = path.join(__dirname, '..', 'data', 'game_stats.json');
    let gameStats = {};
    
    // Читаем существующую статистику
    if (fs.existsSync(gameStatsPath)) {
      const data = fs.readFileSync(gameStatsPath, 'utf8');
      gameStats = JSON.parse(data);
    }
    
    // Инициализируем статистику пользователя
    if (!gameStats[userId]) {
      gameStats[userId] = {
        words_wins: 0,
        casino_wins: 0,
        other_wins: 0
      };
    }
    
    // Обновляем статистику
    if (isWin) {
      switch (gameType) {
        case 'words':
          gameStats[userId].words_wins++;
          break;
        case 'casino':
          gameStats[userId].casino_wins++;
          break;
        default:
          gameStats[userId].other_wins++;
          break;
      }
    }
    
    // Сохраняем обновленную статистику
    fs.writeFileSync(gameStatsPath, JSON.stringify(gameStats, null, 2));
    
    return true;
  } catch (error) {
    console.error('Ошибка при обновлении статистики игр:', error);
    return false;
  }
}

// Функция для получения всех бесед с статистикой сообщений
async function getAllChatsWithMessages() {
  const fs = require('fs');
  const path = require('path');
  const dataDir = path.join(__dirname, '..', 'data');
  
  if (!fs.existsSync(dataDir)) {
    return [];
  }
  
  try {
    const allDirs = fs.readdirSync(dataDir, { withFileTypes: true });
    const conferenceDirs = allDirs.filter(dirent => 
      dirent.isDirectory() && dirent.name.startsWith('conference_')
    );
    
    const chats = [];
    
    for (const dir of conferenceDirs) {
      const peerId = dir.name.replace('conference_', '');
      const conferenceDir = path.join(dataDir, dir.name);
      const files = fs.readdirSync(conferenceDir).filter(f => f.endsWith('.json'));
      
      let totalMessages = 0;
      
      // Подсчитываем общее количество сообщений в беседе
      for (const file of files) {
        try {
          const data = JSON.parse(fs.readFileSync(path.join(conferenceDir, file), 'utf8'));
          if (data.messages_count) {
            totalMessages += data.messages_count;
          }
        } catch (e) {
          console.error(`Ошибка при чтении файла ${file}:`, e);
        }
      }
      
      if (totalMessages > 0) {
        chats.push({
          peerId: parseInt(peerId),
          totalMessages: totalMessages
        });
      }
    }
    
    // Сортируем по количеству сообщений
    chats.sort((a, b) => b.totalMessages - a.totalMessages);
    return chats;
  } catch (error) {
    console.error('Ошибка при получении статистики бесед:', error);
    return [];
  }
}

// Функция для получения названия беседы
async function getChatTitle(peerId) {
  try {
    const chatInfo = await vk.api.messages.getConversationsById({
      peer_ids: peerId
    });
    
    if (chatInfo && chatInfo.items && chatInfo.items[0]) {
      return chatInfo.items[0].chat_settings?.title || `Беседа ${peerId}`;
    }
  } catch (error) {
    console.error(`Ошибка при получении названия беседы ${peerId}:`, error);
  }
  
  return `Беседа ${peerId}`;
}

// Функция для создания клавиатуры с кнопками топов
function createTopKeyboard() {
  return Keyboard.builder()
    .callbackButton({
      label: '💰 Баланс',
      payload: { command: 'top_balance' },
      color: Keyboard.PRIMARY_COLOR
    })
    .callbackButton({
      label: '🏆 Репутация',
      payload: { command: 'top_reputation' },
      color: Keyboard.PRIMARY_COLOR
    })
    .row()
    .callbackButton({
      label: '📊 Сообщения',
      payload: { command: 'top_messages' },
      color: Keyboard.SECONDARY_COLOR
    })
    .callbackButton({
      label: '🎮 Игры',
      payload: { command: 'top_games' },
      color: Keyboard.SECONDARY_COLOR
    })
    .row()
    .callbackButton({
      label: '💬 Беседы',
      payload: { command: 'top_chats' },
      color: Keyboard.POSITIVE_COLOR
    })
    .inline();
}

// Функция для отображения топа по балансу
async function showBalanceTop(context) {
  try {
    const senderId = context.senderId;
    const allUsers = await getAllUsersWithBalance();
    
    if (allUsers.length === 0) {
      return '💰 Топ по балансу\n\n🚫 Пока что нет топов\n\n💡 Начните играть в казино, чтобы попасть в рейтинг!';
    }
    
    const top10 = allUsers.slice(0, 10);
    const userPosition = allUsers.findIndex(user => user.userId === senderId) + 1;
    const userBalance = await getUserBalance(senderId);
    
    // Получаем все имена одним запросом для оптимизации
    const userIds = top10.map(user => user.userId);
    const userNames = await getVKNames(userIds);
    
    let message = `💰 Топ по балансу\n\n`;
    
    for (let i = 0; i < top10.length; i++) {
      const user = top10[i];
      const userName = userNames[user.userId];
      const position = i + 1;
      
      message += `[${position}]. ${userName} - ${formatMoney(user.balance)}$\n`;
    }
    
    if (userPosition > 0 && userPosition <= 10) {
      // Пользователь уже в топе
    } else if (userPosition > 10) {
      message += `\n📍 вы в топе ${userPosition}+`;
    } else if (userBalance > 0) {
      message += `\n📍 вы в топе 999+`;
    }
    
    return message;
  } catch (error) {
    console.error('Ошибка в топе по балансу:', error);
    return '❌ Произошла ошибка при получении топа по балансу.';
  }
}

// Функция для отображения топа по репутации
async function showReputationTop(context) {
  try {
    const senderId = context.senderId;
    const allUsers = await getAllUsersWithReputation();
    
    if (allUsers.length === 0) {
      return '🏆 Топ по репутации\n\n🚫 Пока что нет топов\n\n💡 Начните давать друг другу репутацию командами /rep или +реп!';
    }
    
    const top10 = allUsers.slice(0, 10);
    const userReputation = await getUserReputation(senderId);
    const userPosition = allUsers.findIndex(user => user.userId === senderId) + 1;
    
    // Получаем все имена одним запросом для оптимизации
    const userIds = top10.map(user => user.userId);
    const userNames = await getVKNames(userIds);
    
    let message = `🏆 Топ по репутации\n\n`;
    
    for (let i = 0; i < top10.length; i++) {
      const user = top10[i];
      const userName = userNames[user.userId];
      const position = i + 1;
      
      message += `[${position}]. ${userName} - ${user.reputation} реп\n`;
    }
    
    if (userPosition > 0 && userPosition <= 10) {
      // Пользователь уже в топе
    } else if (userPosition > 10) {
      message += `\n📍 вы в топе ${userPosition}+`;
    } else if (userReputation > 0) {
      message += `\n📍 вы в топе 999+`;
    }
    
    return message;
  } catch (error) {
    console.error('Ошибка в топе по репутации:', error);
    return '❌ Произошла ошибка при получении топа по репутации.';
  }
}

// Функция для отображения топа по сообщениям
async function showMessagesTop(context) {
  try {
    const { peerId } = context;
    const topUsers = await getTopMessageUsers(peerId);
    
    if (topUsers.length === 0) {
      return '📊 Топ по сообщениям\n\n🚫 Пока что нет топов\n\n💡 Начните общаться в беседе!';
    }
    
    // Получаем информацию о пользователях из VK API
    const userIds = topUsers.map(user => user.userId);
    const userNames = await getVKNames(userIds);
    
    let message = `📊 Топ по сообщениям\n\n`;
    
    for (let i = 0; i < topUsers.length; i++) {
      const user = topUsers[i];
      const userName = userNames[user.userId] || `[id${user.userId}|Пользователь]`;
      const position = i + 1;
      
      message += `[${position}]. ${userName} - ${user.messages_count} сообщ.\n`;
    }
    
    return message;
  } catch (error) {
    console.error('Ошибка в топе по сообщениям:', error);
    return '❌ Ошибка системы | Не удалось получить статистику сообщений';
  }
}

// Функция для отображения топа по играм
async function showGamesTop(context) {
  try {
    const topUsers = await getTopGameUsers();
    
    if (topUsers.length === 0) {
      return '🎮 Топ по играм\n\n🚆 Пока что нет топов\n\n💡 Начните играть в слова и казино!';
    }
    
    // Получаем все имена одним запросом для оптимизации
    const userIds = topUsers.map(user => user.userId);
    const userNames = await getVKNames(userIds);
    
    let message = `🎮 Топ по играм\n\n`;
    
    for (let i = 0; i < topUsers.length; i++) {
      const user = topUsers[i];
      const userName = userNames[user.userId] || `[id${user.userId}|Пользователь]`;
      const position = i + 1;
      
      // Оставляем только слова и казино
      const totalWins = (user.words_wins || 0) + (user.casino_wins || 0);
      
      message += `[${position}]. ${userName} - ${totalWins} побед\n`;
    }
    
    return message;
  } catch (error) {
    console.error('Ошибка в топе по играм:', error);
    return '❌ Ошибка системы | Не удалось получить статистику игр';
  }
}

// Функция для отображения топа по беседам
async function showChatsTop(context) {
  try {
    const allChats = await getAllChatsWithMessages();
    
    if (allChats.length === 0) {
      return '💬 Топ по беседам\n\n🚫 Пока что нет топов\n\n💡 Общайтесь в беседах, чтобы они попали в рейтинг!';
    }
    
    const top10 = allChats.slice(0, 10);
    
    let message = `💬 Топ бесед по сообщениям\n\n`;
    
    for (let i = 0; i < top10.length; i++) {
      const chat = top10[i];
      const position = i + 1;
      
      // Получаем название беседы
      const chatTitle = await getChatTitle(chat.peerId);
      
      message += `[${position}]. ${chatTitle}\n📊 Сообщений: ${formatMoney(chat.totalMessages)}\n`;
      if (i < top10.length - 1) {
        message += '\n';
      }
    }
    
    return message;
  } catch (error) {
    console.error('Ошибка в топе по беседам:', error);
    return '❌ Ошибка системы | Не удалось получить статистику бесед';
  }
}

module.exports = {
  command: '/топ',
  aliases: ['/top', '/leaderboard', '/мтоп', '/mtop'],
  description: 'Универсальный топ пользователей с выбором категории',
  async execute(context) {
    try {
      const { peerId } = context;
      
      // Проверяем активацию беседы для топа сообщений
      const isActivated = await checkIfTableExists(`roles_${peerId}`);
      
      // По умолчанию показываем топ по балансу
      const message = await showBalanceTop(context);
      const keyboard = createTopKeyboard();
      
      return context.send({
        message: message,
        keyboard: keyboard,
        disable_mentions: true
      });
      
    } catch (error) {
      console.error('Ошибка в команде топ:', error);
      return context.send('❌ Произошла ошибка при получении топа.');
    }
  },
  
  // Экспортируем функции для обработки кнопок
  showBalanceTop,
  showReputationTop,
  showMessagesTop,
  showGamesTop,
  showChatsTop,
  createTopKeyboard,
  
  // Экспортируем функцию для обновления статистики игр
  updateGameStats
};
