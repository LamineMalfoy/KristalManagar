/**
 * Функция для поиска бесед через участников
 * @param {Set<number>} allChatIds - Набор ID чатов, куда будут добавлены найденные
 * @returns {Promise<void>}
 */
async function searchConversationsByMembers(allChatIds) {
  try {
    const vk = require('../vkInstance');
    console.log('Метод 3: Поиск через участников...');
    
    // Получаем ID бота
    let botUserId = global.botId;
    if (!botUserId) {
      try {
        const botInfo = await vk.api.groups.getById({});
        if (botInfo && botInfo.groups && botInfo.groups[0]) {
          botUserId = -botInfo.groups[0].id; // Отрицательный ID для сообществ
        }
      } catch (e) {
        console.log('Не удалось получить ID бота');
        return;
      }
    }
    
    console.log(`Поиск бесед где есть бот (ID: ${botUserId})...`);
    
    // Проверяем возможные ID бесед
    // ID бесед VK имеют формат 2000000000 + номер
    let foundCount = 0;
    const maxChatId = 2000000050; // Увеличиваем до 50 чатов
    
    // Проверяем порциями по 10 (быстрее)
    for (let i = 2000000000; i < maxChatId && foundCount < 50; i += 10) {
      const batch = [];
      for (let j = 0; j < 10 && (i + j) < maxChatId; j++) {
        const chatId = i + j;
        if (!allChatIds.has(chatId)) {
          batch.push(chatId);
        }
      }
      
      if (batch.length === 0) continue;
      
      console.log(`Проверка чатов: ${batch.join(', ')}...`);
      
      const checks = batch.map(async (chatId) => {
        try {
          const chatInfo = await vk.api.messages.getConversationsById({
            peer_ids: chatId
          });
          
          if (chatInfo.items && chatInfo.items.length > 0) {
            const title = chatInfo.items[0].chat_settings?.title || 'Без названия';
            
            // Проверяем участников
            try {
              const members = await vk.api.messages.getConversationMembers({
                peer_id: chatId
              });
              
              const botInChat = members.items.some(member => member.member_id === botUserId);
              if (botInChat) {
                console.log(`  Найден чат: ${chatId} - "${title}"`);
                return chatId;
              }
            } catch (e) {
              console.log(`  Нет доступа к участникам чата ${chatId}`);
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
      
      // Убираем задержку для ускорения
      // await new Promise(resolve => setTimeout(resolve, 50)); // Минимальная задержка
    }
    
    console.log(`Метод 3: найдено ${foundCount} дополнительных чатов`);
  } catch (error) {
    console.error('Ошибка поиска через участников:', error.message);
  }
}

module.exports = { searchConversationsByMembers };