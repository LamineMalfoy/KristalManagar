const vk = require('../vkInstance.js');
const { query } = require('../filedb.js');
const util = require('util');
const databaseQuery = util.promisify(query);
const { searchConversationsByMembers } = require('./sysinfo_search.js');
const { checkSysAccess } = require('./sysadmin.js');

module.exports = {
  command: '/sysinfo',
  aliases: ['/системинфо', '/чаты'],
  description: 'Показать общие чаты пользователя и бота. Использование: /sysinfo [пользователь]',
  async execute(context) {
    try {
      // Проверяем права системного администратора
      const userAccess = await checkSysAccess(context.senderId);
      
      if (userAccess === 0) {
        await context.reply('❌ У вас нет прав для использования этой команды. Доступна только системным администраторам.');
        return;
      }
      
      // Парсим аргументы команды
      const args = context.text.split(' ').slice(1);
      let targetUserId = context.senderId; // По умолчанию - отправитель

      // Если указан аргумент - парсим ID пользователя
      if (args.length > 0) {
        const userArg = args[0];
        
        // Различные форматы ID пользователя
        if (userArg.startsWith('@id')) {
          targetUserId = parseInt(userArg.replace('@id', ''));
        } else if (userArg.startsWith('[id') && userArg.includes('|')) {
          const match = userArg.match(/\[id(\d+)\|/);
          if (match) targetUserId = parseInt(match[1]);
        } else if (userArg.includes('vk.com/id')) {
          const match = userArg.match(/vk\.com\/id(\d+)/);
          if (match) targetUserId = parseInt(match[1]);
        } else if (/^\d+$/.test(userArg)) {
          targetUserId = parseInt(userArg);
        }
      }

      // Отправляем простое сообщение о начале поиска
      await context.send('🔍 Начинаю поиск бесед...');
      
      // Упрощенная функция уведомлений о прогрессе
      let lastProgress = 0;
      const updateProgress = async (step, total, message) => {
        const percent = Math.round((step / total) * 100);
        
        // Отправляем уведомление каждые 25%
        if (percent - lastProgress >= 25 || percent >= 100) {
          const emoji = percent >= 100 ? '✅' : '🔍';
          await context.send(`${emoji} ${message} (${percent}%)`);
          lastProgress = percent;
        }
      };
      
      await updateProgress(1, 4, 'Получаем список бесед...');
      
      // Получаем все активные беседы бота через API
      const botChats = Array.from(await getBotConversations(updateProgress));

      await updateProgress(3, 4, `Проверяем ${botChats.length} бесед...`);
      
      // Проверяем, в каких беседах есть пользователь
      const commonChats = await findUserInChats(targetUserId, botChats, updateProgress);
      
      await updateProgress(4, 4, 'Готово!');

      // Получаем информацию о пользователе
      let userName = `[id${targetUserId}|Пользователь]`;
      try {
        const userInfo = await vk.api.users.get({
          user_ids: targetUserId,
          fields: 'first_name,last_name'
        });
        if (userInfo && userInfo[0]) {
          userName = `[id${targetUserId}|${userInfo[0].first_name} ${userInfo[0].last_name}]`;
        }
      } catch (error) {
        console.log('Не удалось получить имя пользователя');
      }

      let message = `🩵 Информация о пользователе\n\n`;
      message += `👤 Пользователь: ${userName}\n`;
      message += `💬 Общих чатов: ${commonChats.length}\n`;

      if (commonChats.length > 0) {
        // Получаем названия чатов батчами
        const chatInfos = await getChatInfoBatch(commonChats);
        
        // Получаем коды чатов из базы данных
        const chatCodes = await getChatCodes(commonChats);
        
        // Получаем инвайт-ссылки для чатов
        const inviteLinks = await getChatInviteLinks(commonChats);
        
        // Сохраняем данные для пагинации
        const chatData = {
          userId: targetUserId,
          userName: userName,
          chats: chatInfos.map(chat => ({
            id: chat.id,
            title: chat.title,
            code: chatCodes[chat.id],
            link: inviteLinks[chat.id]
          }))
        };
        
        // Отправляем первую страницу с кнопками
        await sendChatListPage(context, chatData, 0);
        return;
      } else {
        message += `\n❌ Общих чатов не найдено`;
        await context.reply(message);
        return;
      }
    } catch (error) {
      console.error('Ошибка в команде /sysinfo:', error);
      await context.reply(`❌ Ошибка: ${error.message}`);
    }
  },
  
  // Обработчик callback для пагинации
  async handleCallback(context, payload) {
    if (payload.action === 'sysinfo_page') {
      const { userId, page } = payload;
      
      // Заново получаем данные о чатах
      const botChats = Array.from(await getBotConversations());
      const commonChats = await findUserInChats(userId, botChats);
      
      if (commonChats.length > 0) {
        const chatInfos = await getChatInfoBatch(commonChats);
        const chatCodes = await getChatCodes(commonChats);
        const inviteLinks = await getChatInviteLinks(commonChats);
        
        // Получаем имя пользователя
        let userName = `[id${userId}|Пользователь]`;
        try {
          const userInfo = await vk.api.users.get({
            user_ids: userId,
            fields: 'first_name,last_name'
          });
          if (userInfo && userInfo[0]) {
            userName = `[id${userId}|${userInfo[0].first_name} ${userInfo[0].last_name}]`;
          }
        } catch (e) {}
        
        const chatData = {
          userId: userId,
          userName: userName,
          chats: chatInfos.map(chat => ({
            id: chat.id,
            title: chat.title,
            code: chatCodes[chat.id],
            link: inviteLinks[chat.id]
          }))
        };
        
        await sendChatListPage(context, chatData, page, true);
      }
    }
  }
};

/**
 * Находит беседы, в которых состоит пользователь
 * @param {number} userId - ID пользователя
 * @param {number[]} chatIds - Массив ID бесед для проверки
 * @returns {Promise<number[]>} - Массив ID бесед, где есть пользователь
 */
async function findUserInChats(userId, chatIds, updateProgress = null) {
  try {
    const chatsWithUser = [];
    let processed = 0;
    
    // Проверяем каждую беседу порциями по 10 (быстрее)
    for (let i = 0; i < chatIds.length; i += 10) {
      const batch = chatIds.slice(i, i + 10);
      
      const checks = batch.map(async (chatId) => {
        try {
          const members = await vk.api.messages.getConversationMembers({
            peer_id: chatId
          });
          
          console.log(`Проверяем беседу ${chatId}: ${members.items.length} участников`);
          
          // Проверяем, есть ли пользователь в членах беседы
          const isMember = members.items.some(member => member.member_id === userId);
          
          if (isMember) {
            console.log(`✅ Пользователь ${userId} найден в беседе ${chatId}`);
            return chatId;
          } else {
            console.log(`❌ Пользователь ${userId} не найден в беседе ${chatId}`);
          }
        } catch (error) {
          // Если нет доступа к беседе, пропускаем
          console.log(`⚠️ Нет доступа к беседе ${chatId}: ${error.message}`);
        }
        return null;
      });
      
      const results = await Promise.all(checks);
      chatsWithUser.push(...results.filter(id => id !== null));
      
      processed += batch.length;
      if (updateProgress) {
        await updateProgress(3.5, 4, `Проверено ${processed}/${chatIds.length} бесед...`);
      }
    }
    
    return chatsWithUser;
  } catch (error) {
    console.error('Ошибка поиска пользователя в беседах:', error.message);
    return [];
  }
}

/**
 * Получает список всех бесед бота из базы данных
 * @returns {Promise<number[]>} - Массив ID бесед
 */
async function getBotConversationsFromDB() {
  try {
    // Читаем все файлы из директории conference
    const fs = require('fs');
    const path = require('path');
    const dataDir = path.join(__dirname, '..', 'data', 'conference');
    
    if (!fs.existsSync(dataDir)) {
      console.log('Директория conference не существует');
      return [];
    }

    const files = fs.readdirSync(dataDir);
    const chatIds = [];
    
    // Читаем каждый файл и извлекаем conference_id
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      
      try {
        const filePath = path.join(dataDir, file);
        const content = fs.readFileSync(filePath, 'utf8');
        const data = JSON.parse(content);
        
        // Ищем conference_id в файле
        if (data.conference_id) {
          chatIds.push(data.conference_id);
        } else {
          // Если нет conference_id, пробуем использовать имя файла
          const idFromFilename = parseInt(file.replace('.json', ''));
          // Только если это похоже на peer_id (начинается с 2000000000)
          if (!isNaN(idFromFilename) && idFromFilename >= 2000000000 && idFromFilename < 3000000000) {
            chatIds.push(idFromFilename);
          }
        }
      } catch (e) {
        console.log(`Ошибка чтения файла ${file}:`, e.message);
      }
    }

    console.log(`Найдено бесед в БД: ${chatIds.length}`);
    return chatIds;
  } catch (error) {
    console.error('Ошибка получения бесед из БД:', error.message);
    return [];
  }
}

/**
 * Получает список всех бесед бота (старый метод через API)
 * @returns {Promise<Set<number>>} - Set с ID бесед бота
 */
async function getBotConversations() {
  try {
    console.log('Получаем все беседы бота через VK API...');
    const allChatIds = new Set();
    
    // Метод 1: Получаем официальные беседы сообщества
    await getOfficialConversations(allChatIds);
    
    // Метод 2: Поиск через базу данных
    await getConversationsFromDB(allChatIds);
    
    // Метод 3: Поиск через участников (для обычных чатов)
    await searchConversationsByMembers(allChatIds);
    
    console.log(`Всего найдено уникальных чатов: ${allChatIds.size}`);
    return allChatIds;
  } catch (error) {
    console.error('Ошибка получения бесед бота:', error.message);
    return new Set();
  }
}

/**
 * Получает официальные беседы сообщества
 */
async function getOfficialConversations(allChatIds) {
  try {
    console.log('Метод 1: Получаем официальные беседы...');
    let offset = 0;
    const count = 200;
    let hasMore = true;
    let totalRequests = 0;

    while (hasMore && totalRequests < 20) {
      const conversations = await vk.api.messages.getConversations({
        count: count,
        offset: offset,
        filter: 'all',
        extended: 1
      });

      const chatIds = conversations.items
        .filter(item => item.conversation.peer.type === 'chat')
        .map(item => {
          const id = item.conversation.peer.id;
          const title = item.conversation.chat_settings?.title || 'Без названия';
          console.log(`  Официальный чат: ${id} - "${title}"`);
          return id;
        });

      chatIds.forEach(id => allChatIds.add(id));
      offset += count;
      hasMore = conversations.items.length === count;
      totalRequests++;
    }
    
    console.log(`Метод 1: найдено ${allChatIds.size} официальных чатов`);
  } catch (error) {
    console.error('Ошибка получения официальных бесед:', error.message);
  }
}

/**
 * Получает беседы из базы данных (включая обычные групповые чаты)
 */
async function getConversationsFromDB(allChatIds) {
  try {
    console.log('Метод 2: Ищем чаты в базе данных...');
    const dbChats = await getBotConversationsFromDB();
    
    let foundCount = 0;
    for (const chatId of dbChats) {
      if (!allChatIds.has(chatId)) {
        // Проверяем, что это действительно активный чат
        try {
          const chatInfo = await vk.api.messages.getConversationsById({
            peer_ids: chatId
          });
          
          if (chatInfo.items && chatInfo.items.length > 0) {
            const chat = chatInfo.items[0];
            const title = chat.chat_settings?.title || 'Без названия';
            console.log(`  Найден в БД: ${chatId} - "${title}"`);
            allChatIds.add(chatId);
            foundCount++;
          }
        } catch (e) {
          console.log(`  Неактивный чат в БД: ${chatId}`);
        }
      }
    }
    
    console.log(`Метод 2: найдено ${foundCount} дополнительных чатов`);
  } catch (error) {
    console.error('Ошибка получения бесед из БД:', error.message);
  }
}

/**
 * Получает инвайт-ссылки для чатов
 * @param {number[]} chatIds - Массив ID чатов
 * @returns {Promise<Object>} - Объект {chatId: inviteLink}
 */
async function getChatInviteLinks(chatIds) {
  try {
    const links = {};
    
    for (const chatId of chatIds) {
      try {
        // Получаем инвайт-ссылку для чата
        const inviteLink = await vk.api.messages.getInviteLink({
          peer_id: chatId,
          reset: 0 // Не сбрасывать существующую ссылку
        });
        
        if (inviteLink && inviteLink.link) {
          links[chatId] = inviteLink.link;
        }
      } catch (e) {
        console.log(`Не удалось получить ссылку для чата ${chatId}`);
      }
    }
    
    return links;
  } catch (error) {
    console.error('Ошибка получения инвайт-ссылок:', error.message);
    return {};
  }
}

/**
 * Получает коды чатов из базы данных
 * @param {number[]} chatIds - Массив ID чатов
 * @returns {Promise<Object>} - Объект {chatId: uniquekey}
 */
async function getChatCodes(chatIds) {
  try {
    const codes = {};
    
    // Читаем файлы из директории conference
    const fs = require('fs');
    const path = require('path');
    const dataDir = path.join(__dirname, '..', 'data', 'conference');
    
    if (!fs.existsSync(dataDir)) {
      return codes;
    }
    
    for (const chatId of chatIds) {
      const filePath = path.join(dataDir, `${chatId}.json`);
      
      try {
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, 'utf8');
          const data = JSON.parse(content);
          
          if (data.uniquekey) {
            codes[chatId] = data.uniquekey;
          }
        }
      } catch (e) {
        console.log(`Ошибка чтения кода для чата ${chatId}`);
      }
    }
    
    return codes;
  } catch (error) {
    console.error('Ошибка получения кодов чатов:', error.message);
    return {};
  }
}

/**
 * Получает информацию о чатах батчами
 * @param {number[]} chatIds - Массив ID чатов
 * @returns {Promise<Array<{id: number, title: string}>>}
 */
async function getChatInfoBatch(chatIds) {
  try {
    // VK API позволяет получить до 25 чатов за раз
    const batchSize = 25;
    const batches = [];

    for (let i = 0; i < chatIds.length; i += batchSize) {
      const batch = chatIds.slice(i, i + batchSize);
      batches.push(
        vk.api.messages.getConversationsById({
          peer_ids: batch.join(',')
        })
      );
    }

    // Параллельно получаем все батчи
    const results = await Promise.all(batches);

    // Собираем результаты
    return results.flatMap(result =>
      result.items.map(item => ({
        id: item.peer.id,
        title: item.chat_settings?.title || 'Без названия'
      }))
    );
  } catch (error) {
    console.error('Ошибка получения информации о чатах:', error.message);
    // Возвращаем базовую информацию без названий
    return chatIds.map(id => ({ id, title: 'Беседа' }));
  }
}

/**
 * Отправляет страницу списка чатов с кнопками
 */
async function sendChatListPage(context, chatData, page = 0, isEdit = false) {
  const { Keyboard } = require('vk-io');
  const CHATS_PER_PAGE = 7;
  
  const totalPages = Math.ceil(chatData.chats.length / CHATS_PER_PAGE);
  const startIndex = page * CHATS_PER_PAGE;
  const endIndex = Math.min(startIndex + CHATS_PER_PAGE, chatData.chats.length);
  const pageChats = chatData.chats.slice(startIndex, endIndex);
  
  // Формируем сообщение
  let message = `🩵 Информация о пользователе\n\n`;
  message += `👤 Пользователь: ${chatData.userName}\n`;
  message += `💬 Общих чатов: ${chatData.chats.length}\n`;
  message += `\n💭 Беседы с ботом (стр. ${page + 1}/${totalPages}):\n`;
  
  // Добавляем информацию о чатах на текущей странице
  pageChats.forEach((chat, index) => {
    const num = startIndex + index + 1;
    const chatTitle = chat.title || 'Без названия';
    
    // Если есть ссылка - делаем заголовок кликабельным
    if (chat.link) {
      message += `\n${num}. ${chatTitle}\n`;
      message += `   🔗 ${chat.link}\n`;
    } else {
      message += `\n${num}. ${chatTitle}\n`;
    }
    
    message += `   🆔 ID: ${chat.id}`;
    if (chat.code) {
      message += ` | 🔑 #${chat.code}`;
    }
    message += `\n`;
  });
  
  // Создаем клавиатуру только с кнопками навигации (белые кнопки)
  const keyboard = Keyboard.builder();
  
  // Кнопки навигации
  if (totalPages > 1) {
    if (page > 0) {
      keyboard.callbackButton({
        label: '⬅️ Назад',
        payload: {
          action: 'sysinfo_page',
          userId: chatData.userId,
          page: page - 1
        },
        color: Keyboard.SECONDARY_COLOR
      });
    }
    
    if (page < totalPages - 1) {
      keyboard.callbackButton({
        label: 'Вперёд ➡️',
        payload: {
          action: 'sysinfo_page',
          userId: chatData.userId,
          page: page + 1
        },
        color: Keyboard.SECONDARY_COLOR
      });
    }
  }
  
  keyboard.inline();
  
  // Отправляем или редактируем сообщение
  if (isEdit && context.eventId) {
    try {
      await context.editMessage({
        message: message,
        keyboard: keyboard
      });
    } catch (e) {
      await context.send({
        message: message,
        keyboard: keyboard
      });
    }
  } else {
    await context.send({
      message: message,
      keyboard: keyboard
    });
  }
}
