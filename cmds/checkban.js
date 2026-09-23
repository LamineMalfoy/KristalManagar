const fs = require('fs').promises;
const path = require('path');
const { extractNumericId } = require('./ban.js');
const { checkSysAccess } = require('./sysadmin.js');
const { getlink } = require('../util.js');

async function getChatTitle(peerId) {
    try {
        const conversationInfo = await global.vk.api.messages.getConversationsById({
            peer_ids: peerId
        });
        
        if (conversationInfo && conversationInfo.items && conversationInfo.items.length > 0) {
            const chat = conversationInfo.items[0];
            return chat.chat_settings ? chat.chat_settings.title : `Беседа ${peerId}`;
        }
    } catch (error) {
        // Тихо обрабатываем ошибки для скорости
    }
    return `Беседа ${peerId}`;
}

function formatDate(dateString) {
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: '2-digit', 
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (error) {
        return 'Неизвестно';
    }
}

// 🚀 СУПЕР-ОПТИМИЗИРОВАННАЯ ФУНКЦИЯ ПОИСКА БАНОВ (МАКСИМАЛЬНАЯ СКОРОСТЬ)
async function findUserBansInAllChats(targetUserId) {
    console.log(`🔍 Поиск банов для ${targetUserId}...`);
    
    const dataDir = path.join(__dirname, '..', 'data');
    const startTime = Date.now();
    
    try {
        // Получаем список папок конференций
        const entries = await fs.readdir(dataDir, { withFileTypes: true });
        const conferenceDirs = entries
            .filter(entry => entry.isDirectory() && entry.name.startsWith('conference_'))
            .map(entry => entry.name);
        
        if (conferenceDirs.length === 0) {
            console.log('⚠️ Нет конференций');
            return [];
        }
        
        console.log(`📊 Поиск в ${conferenceDirs.length} беседах...`);
        
        // 🚀 ПАРАЛЛЕЛЬНАЯ ОБРАБОТКА ВСЕХ БЕСЕД
        const allBansPromises = conferenceDirs.map(async (conferenceDir) => {
            const chatId = conferenceDir.replace('conference_', '');
            const conferencePath = path.join(dataDir, conferenceDir);
            
            try {
                // Получаем список файлов пользователей
                const userFiles = await fs.readdir(conferencePath);
                const jsonFiles = userFiles.filter(file => file.endsWith('.json'));
                
                // 🚀 ПАРАЛЛЕЛЬНАЯ ОБРАБОТКА ВСЕХ ФАЙЛОВ В БЕСЕДЕ
                const chatBansPromises = jsonFiles.map(async (userFile) => {
                    const userFilePath = path.join(conferencePath, userFile);
                    
                    try {
                        const userData = await fs.readFile(userFilePath, 'utf8');
                        if (!userData.trim()) return [];
                        
                        const userInfo = JSON.parse(userData);
                        if (!userInfo.blocked_users) return [];
                        
                        let blockedUsers = [];
                        if (typeof userInfo.blocked_users === 'string') {
                            blockedUsers = userInfo.blocked_users.trim() ? JSON.parse(userInfo.blocked_users) : [];
                        } else if (Array.isArray(userInfo.blocked_users)) {
                            blockedUsers = userInfo.blocked_users;
                        }
                        
                        // Ищем только нашего пользователя
                        const foundBans = [];
                        for (const block of blockedUsers) {
                            if (block.blocked_user_id && parseInt(block.blocked_user_id) === parseInt(targetUserId)) {
                                // Проверяем срок действия
                                const banExpiry = new Date(block.block_until);
                                const now = new Date();
                                
                                if (banExpiry > now || (banExpiry.getFullYear() - now.getFullYear()) > 5) {
                                    foundBans.push({
                                        chatId: chatId,
                                        blockedUserId: block.blocked_user_id,
                                        blockedBy: block.blocked_by,
                                        blockUntil: block.block_until,
                                        reason: block.reason
                                    });
                                }
                            }
                        }
                        
                        return foundBans;
                    } catch (fileError) {
                        return []; // Тихо пропускаем проблемные файлы
                    }
                });
                
                // Дожидаемся обработки всех файлов в беседе
                const chatBansResults = await Promise.all(chatBansPromises);
                return chatBansResults.flat();
                
            } catch (dirError) {
                return []; // Тихо пропускаем проблемные папки
            }
        });
        
        // Дожидаемся обработки всех бесед
        const allBansResults = await Promise.all(allBansPromises);
        const allBans = allBansResults.flat();
        
        const endTime = Date.now();
        console.log(`🎯 Найдено ${allBans.length} банов за ${endTime - startTime}ms`);
        
        return allBans;
        
    } catch (error) {
        console.error('❌ Ошибка поиска:', error.message);
        return [];
    }
}

module.exports = {
    command: '/checkban',
    aliases: ['/чекбан'],
    description: 'Проверить блокировки пользователя во всех беседах',
    async execute(context) {
        const { peerId, text, senderId, replyMessage } = context;
        
        // Определяем целевого пользователя
        let target = senderId;
        let targetSpecified = false;
        
        if (replyMessage) {
            target = replyMessage.senderId;
            targetSpecified = true;
        } else if (text.split(' ').length > 1) {
            target = text.split(' ')[1];
            targetSpecified = true;
        }
        
        // Проверяем права доступа
        const hasAccess = await checkSysAccess(senderId);
        let targetUserId;
        
        if (targetSpecified) {
            if (!hasAccess) {
                return context.reply('❌ У вас нет прав для проверки блокировок других пользователей.\n\n💡 Используйте команду без параметров для проверки своих блокировок.');
            }
            
            targetUserId = await extractNumericId(target);
        } else {
            targetUserId = senderId;
        }
        
        if (!targetUserId) {
            return context.reply('❌ Не удалось определить ID пользователя');
        }
        
        try {
            // 🚀 СУПЕР-БЫСТРЫЙ ПОИСК БАНОВ
            const userBans = await findUserBansInAllChats(targetUserId);
            
            if (userBans.length === 0) {
                const targetUserLink = await getlink(targetUserId);
                return context.reply(`✅ Пользователь ${targetUserLink} не имеет активных блокировок`);
            }
            
            // Ограничиваем до 15 банов для быстрого отображения
            const limitedBans = userBans.slice(0, 15);
            const hasMoreBans = userBans.length > 15;
            
            // 🚀 ПАРАЛЛЕЛЬНО ПОЛУЧАЕМ ИНФОРМАЦИЮ О ПОЛЬЗОВАТЕЛЕ И ЧАТАХ
            const [targetUserLink, ...chatTitles] = await Promise.all([
                getlink(targetUserId),
                ...limitedBans.map(ban => getChatTitle(ban.chatId))
            ]);
            
            let message = `🚫 Блокировки пользователя ${targetUserLink}:\n\n`;
            
            // Быстро форматируем результат
            for (let i = 0; i < limitedBans.length; i++) {
                const ban = limitedBans[i];
                const chatTitle = chatTitles[i];
                const formattedDate = formatDate(ban.blockUntil);
                const reason = ban.reason || 'Не указана';
                
                message += `${i + 1}. ${chatTitle} (ID: ${ban.chatId})\n`;
                message += `   ├ Причина: ${reason}\n`;
                message += `   └ До: ${formattedDate}\n\n`;
            }
            
            if (hasMoreBans) {
                message += `⚠️ Показано ${limitedBans.length} из ${userBans.length} блокировок`;
            }
            
            return context.reply(message);
            
        } catch (error) {
            console.error('❌ Ошибка при поиске блокировок:', error);
            return context.reply('❌ Произошла ошибка при поиске блокировок');
        }
    }
};
