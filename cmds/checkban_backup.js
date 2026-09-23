const database = require('../databases.js');
const { checkIfTableExists } = require('./roles.js');
const { checkSysAccess } = require('./sysadmin.js');
const { vk } = require('../index.js');
const { extractNumericId } = require('./ban.js');

// Функция для получения ссылки на пользователя
async function getlink(userId) {
    try {
        const userInfo = await vk.api.users.get({ user_ids: userId });
        const user = userInfo[0];
        return `[id${userId}|${user.first_name} ${user.last_name}]`;
    } catch (error) {
        return `[id${userId}|Пользователь]`;
    }
}

// Функция для получения названия беседы
async function getChatTitle(peerId) {
    try {
        if (peerId < 2000000000) {
            return `Личные сообщения (ID: ${peerId})`;
        }
        
        const chatInfo = await vk.api.messages.getConversationsById({
            peer_ids: peerId
        });
        
        if (chatInfo && chatInfo.items && chatInfo.items[0] && chatInfo.items[0].chat_settings) {
            return chatInfo.items[0].chat_settings.title || `Беседа (ID: ${peerId})`;
        }
        
        return `Беседа (ID: ${peerId})`;
    } catch (error) {
        console.error('Ошибка получения названия беседы:', error);
        return `Беседа (ID: ${peerId})`;
    }
}

// Функция для форматирования даты
function formatDate(dateString) {
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) {
            return 'Неизвестная дата';
        }
        
        // Проверяем, не истёк ли бан
        const now = new Date();
        if (date <= now) {
            return 'истёк';
        }
        
        // Проверяем на перманентный бан (очень далёкая дата)
        const yearsDiff = (date.getFullYear() - now.getFullYear());
        if (yearsDiff > 5) {
            return 'перманентно';
        }
        
        return date.toLocaleString('ru-RU', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (error) {
        console.error('Ошибка форматирования даты:', error);
        return 'Ошибка даты';
    }
}

// Функция поиска всех банов пользователя ВО ВСЕХ БЕСЕДАХ
async function findUserBansInAllChats(targetUserId) {
    return new Promise((resolve, reject) => {
        console.log(`🔍 Ищем баны для пользователя ${targetUserId} во всех беседах`);
        
        // Получаем список всех таблиц конференций
        const searchQuery = `
            SELECT DISTINCT table_name 
            FROM information_schema.tables 
            WHERE table_schema = DATABASE() 
            AND table_name LIKE 'conference_%'
        `;
        
        database.query(searchQuery, async (error, tables) => {
            if (error) {
                console.error('❌ Ошибка поиска таблиц:', error);
                return resolve([]);
            }
            
            console.log(`📊 Найдено ${tables.length} таблиц конференций`);
            
            const allBans = [];
            let processedTables = 0;
            
            if (tables.length === 0) {
                console.log('⚠️ Нет таблиц конференций');
                return resolve([]);
            }
            
            // Обрабатываем каждую таблицу
            for (const tableRow of tables) {
                const tableName = tableRow.table_name;
                const chatId = tableName.replace('conference_', '');
                
                console.log(`🔍 Проверяем беседу ${chatId}`);
                
                // ТОЧНАЯ КОПИЯ ЛОГИКИ ИЗ /banlist
                const selectAllUsersQuery = `
                    SELECT user_id, blocked_users
                    FROM ${tableName}
                `;
                
                database.query(selectAllUsersQuery, async (banError, results) => {
                    processedTables++;
                    console.log(`📋 Беседа ${chatId}: найдено ${results ? results.length : 0} записей`);
                    
                    if (!banError && results && results.length > 0) {
                        // ТОЧНАЯ КОПИЯ ЛОГИКИ ИЗ /banlist
                        for (const result of results) {
                            const userId = result.user_id;
                            let blockedUsers = [];
                            if (result.blocked_users) {
                                try {
                                    blockedUsers = result.blocked_users.trim() ? JSON.parse(result.blocked_users) : [];
                                } catch { 
                                    console.log(`⚠️ Ошибка парсинга JSON в беседе ${chatId} для пользователя ${userId}`);
                                    blockedUsers = []; 
                                }
                            }
                            
                            // Ищем блокировки нашего целевого пользователя
                            for (const block of blockedUsers) {
                                if (block.blocked_user_id && parseInt(block.blocked_user_id) === parseInt(targetUserId)) {
                                    console.log(`🚫 Найден бан в беседе ${chatId}:`, block);
                                    
                                    // Проверяем срок действия бана
                                    const banExpiry = new Date(block.block_until);
                                    const now = new Date();
                                    
                                    // Добавляем только активные баны
                                    if (banExpiry > now || (banExpiry.getFullYear() - now.getFullYear()) > 5) {
                                        allBans.push({
                                            chatId: chatId,
                                            blockedUserId: block.blocked_user_id,
                                            blockedBy: block.blocked_by,
                                            blockUntil: block.block_until,
                                            reason: block.reason
                                        });
                                        console.log(`✅ Бан добавлен в список (активный)`);
                                    } else {
                                        console.log(`⏰ Бан пропущен (истёкший)`);
                                    }
                                }
                            }
                        }
                    }
                    
                    // Если обработали все таблицы
                    if (processedTables === tables.length) {
                        console.log(`🎯 Поиск завершён. Найдено активных банов: ${allBans.length}`);
                        resolve(allBans);
                    }
                });
            }
        });
    });
}

module.exports = {
    command: '/checkban',
    aliases: ['/чекбан'],
    description: 'Проверить блокировки пользователя во всех беседах',
    async execute(context) {
        const { peerId, text, senderId, replyMessage } = context;
        
        // Определяем целевого пользователя
        let target = senderId; // По умолчанию проверяем себя
        let targetSpecified = false;
        
        if (replyMessage) {
            target = replyMessage.senderId;
            targetSpecified = true;
        } else if (text.split(' ').length > 1) {
            target = text.split(' ')[1];
            targetSpecified = true;
        }
        
        console.log(`👤 target: ${target}, targetSpecified: ${targetSpecified}`);
        
        // Проверка прав доступа
        console.log(`🔐 Проверяем права доступа для ${senderId}`);
        const hasAccess = await checkSysAccess(senderId);
        console.log(`🔐 Результат проверки прав: ${hasAccess}`);
        
        let targetUserId;
        let isCheckingOthers = false;
        
        if (targetSpecified) {
            console.log(`👤 Проверяем другого пользователя: ${target}`);
            // Проверяем, есть ли права на проверку других пользователей
            if (!hasAccess) {
                console.log(`❌ Нет прав для проверки других пользователей`);
                return context.reply('❌ У вас нет прав для проверки блокировок других пользователей.\n\n💡 Используйте команду без параметров для проверки своих блокировок.');
            }
            
            console.log(`🔢 Извлекаем числовой ID из: ${target}`);
            targetUserId = await extractNumericId(target);
            console.log(`🔢 Результат extractNumericId: ${targetUserId}`);
            isCheckingOthers = true;
        } else {
            console.log(`👤 Проверяем себя: ${senderId}`);
            targetUserId = senderId;
        }
        
        if (!targetUserId) {
            console.log(`❌ Не удалось определить ID пользователя`);
            return context.reply('❌ Не удалось определить ID пользователя');
        }
        
        try {
            // Ищем все баны пользователя ВО ВСЕХ БЕСЕДАХ
            const userBans = await findUserBansInAllChats(targetUserId);
            
            console.log(`📊 Найдено банов: ${userBans.length}`);
            
            if (userBans.length === 0) {
                const targetUserLink = await getlink(targetUserId);
                return context.reply(`✅ Пользователь ${targetUserLink} не имеет активных блокировок`);
            }
            
            // Ограничиваем до 15 банов
            const limitedBans = userBans.slice(0, 15);
            const hasMoreBans = userBans.length > 15;
            
            // Получаем информацию о пользователе и форматируем результат
            const targetUserLink = await getlink(targetUserId);
            
            let message = `🚫 Блокировки пользователя ${targetUserLink}:\n\n`;
            
            // Обрабатываем каждый бан
            for (let i = 0; i < limitedBans.length; i++) {
                const ban = limitedBans[i];
                const chatTitle = await getChatTitle(ban.peerId);
                const formattedDate = formatDate(ban.block_until);
                const reason = ban.reason || 'Не указана';
                
                message += `${i + 1}. ${chatTitle} (ID: ${ban.peerId})\n`;
                message += `   ├ Причина: ${reason}\n`;
                message += `   └ Окончание бана: ${formattedDate}\n\n`;
            }
            
            if (hasMoreBans) {
                message += `⚠️ Показано ${limitedBans.length} из ${userBans.length} блокировок`;
            }
            
            return context.send({
                message: message.trim(),
                disable_mentions: true
            });
            
        } catch (error) {
            console.error('Ошибка при проверке блокировок:', error);
            return context.reply('❌ Произошла ошибка при поиске блокировок');
        }
    }
};
