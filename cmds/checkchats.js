const { Keyboard } = require('vk-io');
const database = require('../databases.js');
const util = require('util');
const queryAsync = util.promisify(database.query).bind(database);

const CHATS_PER_PAGE = 10;

// Кэш результатов поиска чатов (обновляется каждые 5 минут)
let cachedChats = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 минут

module.exports = {
  command: '/checkchats',
  aliases: ['/чаты', '/chatlist'],
  description: 'Просмотр списка чатов бота',
  
  async execute(context) {
    try {
      // Проверяем права системного администратора
      const { checkSysAccess } = require('./sysadmin.js');
      const userAccess = await checkSysAccess(context.senderId);
      
      if (userAccess < 3) {
        return context.reply('❌ У вас нет прав для использования этой команды. Доступна с уровня "Заместитель основателя".');
      }
      
      // Проверяем кэш
      const now = Date.now();
      if (!cachedChats || (now - cacheTimestamp) > CACHE_DURATION) {
        // Отправляем сообщение о начале
        await context.send('🔍 Загружаю список всех чатов бота...');
        
        // Получаем все чаты где есть бот через VK API
        const allChatIds = await getAllBotChats();
        
        if (!allChatIds || allChatIds.length === 0) {
          return context.send('📋 Бот не находится ни в одном чате');
        }
        
        // Сохраняем в кэш
        cachedChats = allChatIds.map(id => ({ conference_id: id }));
        cacheTimestamp = now;
        
        await context.send(`✅ Найдено ${allChatIds.length} чатов. Загружаю информацию...`);
      } else {
        await context.send(`✅ Использую сохранённые данные (${cachedChats.length} чатов)...`);
      }
      
      // Показываем первую страницу
      await sendChatsPage(context, cachedChats, 0);
      
    } catch (error) {
      console.error('Ошибка при выполнении checkchats:', error);
      return context.send('❌ Ошибка при получении списка чатов');
    }
  },
  
  async handleCallback(context, payload) {
    try {
      const { page } = payload;
      
      // Используем кэшированные данные для пагинации
      if (!cachedChats || cachedChats.length === 0) {
        return context.send('📋 Данные не найдены. Выполните /checkchats снова.');
      }
      
      // Редактируем сообщение с новой страницей
      await editChatsPage(context, cachedChats, page);
      
    } catch (error) {
      console.error('Ошибка при обработке callback checkchats:', error);
    }
  }
};

async function sendChatsPage(context, chats, page) {
  const { message, keyboard } = await buildChatsMessage(chats, page);
  
  await context.send({
    message: message,
    keyboard: keyboard
  });
}

async function editChatsPage(context, chats, page) {
  const { message, keyboard } = await buildChatsMessage(chats, page);
  
  try {
    await global.vk.api.messages.edit({
      peer_id: context.peerId,
      conversation_message_id: context.conversationMessageId,
      message: message,
      keyboard: keyboard
    });
  } catch (error) {
    console.error('Ошибка при редактировании сообщения:', error);
    // Если не удалось отредактировать, отправляем новое
    await context.send({
      message: message,
      keyboard: keyboard
    });
  }
}

async function buildChatsMessage(chats, page) {
  const totalChats = chats.length;
  const totalPages = Math.ceil(totalChats / CHATS_PER_PAGE);
  const currentPage = Math.min(Math.max(0, page), totalPages - 1);
  
  const startIndex = currentPage * CHATS_PER_PAGE;
  const endIndex = Math.min(startIndex + CHATS_PER_PAGE, totalChats);
  const pageChats = chats.slice(startIndex, endIndex);
  
  // Формируем сообщение
  let message = `🆔 Список чатов бота\n\n`;
  message += `💬 Всего чатов: ${totalChats}\n`;
  message += `\n💭 Беседы (стр. ${currentPage + 1}/${totalPages}):\n`;
  
  // Получаем информацию о чатах батчем (25 чатов за раз)
  const chatIds = pageChats.map(chat => chat.conference_id);
  const chatInfos = await getChatInfoBatch(chatIds);
  const chatLinks = await getChatLinksBatch(chatIds);
  
  // Добавляем чаты текущей страницы
  for (let i = 0; i < pageChats.length; i++) {
    const chat = pageChats[i];
    const chatNum = startIndex + i + 1;
    const chatId = chat.conference_id;
    
    const chatName = chatInfos[chatId] || `Чат ${chatId}`;
    const chatLink = chatLinks[chatId];
    
    message += `\n${chatNum}. ${chatName}\n`;
    if (chatLink) {
      message += `   🔗 ${chatLink}\n`;
    }
    message += `   🆔 ID: ${chatId}\n`;
  }
  
  // Создаем клавиатуру
  const keyboard = Keyboard.builder();
  
  // Кнопки навигации (белые кнопки)
  if (totalPages > 1) {
    if (currentPage > 0) {
      keyboard.callbackButton({
        label: '⬅️ Назад',
        payload: {
          action: 'checkchats_page',
          page: currentPage - 1
        },
        color: Keyboard.SECONDARY_COLOR
      });
    }
    
    if (currentPage < totalPages - 1) {
      keyboard.callbackButton({
        label: 'Вперёд ➡️',
        payload: {
          action: 'checkchats_page',
          page: currentPage + 1
        },
        color: Keyboard.SECONDARY_COLOR
      });
    }
  }
  
  keyboard.inline();
  
  return {
    message: message,
    keyboard: keyboard
  };
}

async function getAllBotChats() {
  try {
    console.log('Получаем все чаты бота...');
    const allChatIds = new Set();
    
    // Метод 1: Читаем JSON файлы из data/conference/ (как в sysinfo)
    try {
      const fs = require('fs');
      const path = require('path');
      const dataDir = path.join(__dirname, '..', 'data', 'conference');
      
      if (fs.existsSync(dataDir)) {
        const files = fs.readdirSync(dataDir);
        console.log(`Найдено файлов в data/conference: ${files.length}`);
        
        for (const file of files) {
          if (!file.endsWith('.json')) continue;
          
          try {
            const filePath = path.join(dataDir, file);
            const content = fs.readFileSync(filePath, 'utf8');
            const data = JSON.parse(content);
            
            // Ищем conference_id в файле
            if (data.conference_id) {
              const id = parseInt(data.conference_id);
              if (id >= 2000000000 && id < 3000000000) {
                allChatIds.add(id);
                console.log(`  Найден чат: ${id}`);
              }
            } else {
              // Используем имя файла
              const idFromFilename = parseInt(file.replace('.json', ''));
              if (!isNaN(idFromFilename) && idFromFilename >= 2000000000 && idFromFilename < 3000000000) {
                allChatIds.add(idFromFilename);
                console.log(`  Найден чат (из имени файла): ${idFromFilename}`);
              }
            }
          } catch (e) {
            console.log(`Ошибка чтения файла ${file}:`, e.message);
          }
        }
        
        console.log(`Из data/conference: ${allChatIds.size} чатов`);
      } else {
        console.log('Директория data/conference не найдена');
      }
    } catch (e) {
      console.error('Ошибка чтения JSON файлов:', e.message);
    }
    
    // Метод 2: Получаем через VK API (все активные беседы)
    const chatsFromFiles = allChatIds.size;
    try {
      console.log('Метод 2: Получаем через VK API...');
      let offset = 0;
      const count = 200;
      let hasMore = true;
      let totalRequests = 0;

      while (hasMore && totalRequests < 20) {
        try {
          const conversations = await global.vk.api.messages.getConversations({
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
              if (!allChatIds.has(id)) {
                console.log(`  Найден чат через API: ${id} - "${title}"`);
              }
              return id;
            });

          chatIds.forEach(id => allChatIds.add(id));
          offset += count;
          hasMore = conversations.items.length === count;
          totalRequests++;
        } catch (e) {
          console.error('Ошибка VK API:', e.message);
          break;
        }
      }
      
      console.log(`Метод 2: найдено ${allChatIds.size - chatsFromFiles} дополнительных чатов через API`);
    } catch (e) {
      console.error('Ошибка метода 2:', e.message);
    }
    
    // Метод 3: Поиск через перебор ID чатов (как в sysinfo)
    const chatsBeforeSearch = allChatIds.size;
    try {
      console.log('Метод 3: Поиск через перебор ID чатов...');
      
      // Получаем ID бота (сообщества)
      let botUserId = global.botId;
      if (!botUserId) {
        try {
          const botInfo = await global.vk.api.groups.getById({});
          if (botInfo && botInfo[0]) {
            botUserId = -botInfo[0].id; // Отрицательный ID для сообществ
          }
        } catch (e) {
          console.log('Не удалось получить ID бота');
        }
      }
      
      if (botUserId) {
        console.log(`ID бота: ${botUserId}`);
        let foundCount = 0;
        const maxChatId = 2000000100; // Проверяем до 100 чатов
        
        // Проверяем порциями по 10 чатов
        for (let i = 2000000000; i < maxChatId && foundCount < 100; i += 10) {
          const batch = [];
          for (let j = 0; j < 10 && (i + j) < maxChatId; j++) {
            const chatId = i + j;
            if (!allChatIds.has(chatId)) {
              batch.push(chatId);
            }
          }
          
          if (batch.length === 0) continue;
          
          const checks = batch.map(async (chatId) => {
            try {
              const chatInfo = await global.vk.api.messages.getConversationsById({
                peer_ids: chatId
              });
              
              if (chatInfo.items && chatInfo.items.length > 0) {
                const title = chatInfo.items[0].chat_settings?.title || 'Без названия';
                
                // Проверяем участников
                try {
                  const members = await global.vk.api.messages.getConversationMembers({
                    peer_id: chatId
                  });
                  
                  const botInChat = members.items.some(member => member.member_id === botUserId);
                  if (botInChat) {
                    console.log(`  Найден через перебор: ${chatId} - "${title}"`);
                    return chatId;
                  }
                } catch (e) {
                  // Нет доступа к участникам
                }
              }
            } catch (e) {
              // Чат не существует или нет доступа
            }
            return null;
          });
          
          const results = await Promise.all(checks);
          const validChatIds = results.filter(id => id !== null);
          
          validChatIds.forEach(id => {
            allChatIds.add(id);
            foundCount++;
          });
        }
        
        console.log(`Метод 3: найдено ${allChatIds.size - chatsBeforeSearch} дополнительных чатов`);
      }
    } catch (e) {
      console.error('Ошибка метода 3:', e.message);
    }
    
    console.log(`Всего найдено: ${allChatIds.size} чатов`);
    return Array.from(allChatIds);
  } catch (error) {
    console.error('Ошибка getAllBotChats:', error);
    return [];
  }
}

async function getChatInfo(chatId) {
  try {
    const response = await global.vk.api.messages.getConversationsById({
      peer_ids: chatId
    });
    
    if (response && response.items && response.items[0]) {
      return response.items[0].chat_settings;
    }
  } catch (error) {
    // Игнорируем ошибки
  }
  return null;
}

async function getChatInfoBatch(chatIds) {
  try {
    const infos = {};
    
    // VK API позволяет получить до 100 чатов за раз
    const batchSize = 100;
    
    for (let i = 0; i < chatIds.length; i += batchSize) {
      const batch = chatIds.slice(i, i + batchSize);
      
      try {
        const response = await global.vk.api.messages.getConversationsById({
          peer_ids: batch.join(',')
        });
        
        if (response && response.items) {
          response.items.forEach(item => {
            const chatId = item.peer.id;
            const title = item.chat_settings?.title || `Чат ${chatId}`;
            infos[chatId] = title;
          });
        }
      } catch (e) {
        console.error('Ошибка получения инфо о чатах:', e.message);
      }
    }
    
    return infos;
  } catch (error) {
    console.error('Ошибка getChatInfoBatch:', error);
    return {};
  }
}

async function getChatLinksBatch(chatIds) {
  try {
    const links = {};
    
    // Получаем ссылки по одной (нельзя батчем)
    for (const chatId of chatIds) {
      try {
        const inviteLink = await global.vk.api.messages.getInviteLink({
          peer_id: chatId,
          reset: 0
        });
        
        if (inviteLink && inviteLink.link) {
          links[chatId] = inviteLink.link;
        }
      } catch (e) {
        // Нет ссылки
      }
    }
    
    return links;
  } catch (error) {
    console.error('Ошибка getChatLinksBatch:', error);
    return {};
  }
}
