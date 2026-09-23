const fs = require('fs').promises;
const path = require('path');
const { extractNumericId } = require('./ban.js');
const { checkSysAccess } = require('./sysadmin.js');

// Функция для получения информации о пользователе
async function getlink(userId) {
    try {
        const userInfo = await global.vk.api.users.get({ user_ids: userId });
        if (userInfo && userInfo.length > 0) {
            const user = userInfo[0];
            return `@id${userId}(${user.first_name} ${user.last_name})`;
        }
    } catch (error) {
        console.error('Ошибка получения информации о пользователе:', error);
    }
    return `@id${userId}(Пользователь)`;
}

// Функция для получения названия беседы
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
        console.error('Ошибка получения названия беседы:', error);
    }
    return `Беседа ${peerId}`;
}

// Функция форматирования даты
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

// ОСНОВНАЯ ФУНКЦИЯ ПОИСКА БАНОВ ВО ВСЕХ БЕСЕДАХ (FILEDB.JS ВЕРСИЯ)
async function findUserBansInAllChats(targetUserId) {
    console.log(`🔍 НАЧИНАЕМ ПОИСК БАНОВ для пользователя ${targetUserId} (FILEDB.JS)`);
    
    const allBans = [];
    const dataDir = path.join(__dirname, '..', 'data');
    
    try {
        // Получаем список всех папок конференций
        const entries = await fs.readdir(dataDir, { withFileTypes: true });
        const conferenceDirs = entries
            .filter(entry => entry.isDirectory() && entry.name.startsWith('conference_'))
            .map(entry => entry.name);
        
        console.log(`📊 Найдено ${conferenceDirs.length} папок конференций:`, conferenceDirs);
        
        if (conferenceDirs.length === 0) {
            console.log('⚠️ Нет папок конференций');
            return [];
        }
        
        // Обрабатываем каждую папку конференции
        for (const conferenceDir of conferenceDirs) {
            const chatId = conferenceDir.replace('conference_', '');
            const conferencePath = path.join(dataDir, conferenceDir);
            
            console.log(`🔍 Проверяем беседу ${chatId} в папке ${conferencePath}`);
            
            try {
                // Получаем список всех файлов пользователей в этой беседе
                const userFiles = await fs.readdir(conferencePath);
                const jsonFiles = userFiles.filter(file => file.endsWith('.json'));
                
                console.log(`📋 Беседа ${chatId}: найдено ${jsonFiles.length} файлов пользователей`);
                
                // Проверяем каждый файл пользователя
                for (const userFile of jsonFiles) {
                    const userFilePath = path.join(conferencePath, userFile);
                    const userId = userFile.replace('.json', '');
                    
                    try {
                        // Читаем данные пользователя
                        const userData = await fs.readFile(userFilePath, 'utf8');
                        
                        if (!userData.trim()) {
                            console.log(`📄 Файл ${userFile} пустой, пропускаем`);
                            continue;
                        }
                        
                        const userInfo = JSON.parse(userData);
                        console.log(`👤 Анализируем пользователя ${userId} в беседе ${chatId}`);
                        
                        // Проверяем есть ли blocked_users
                        if (userInfo.blocked_users) {
                            console.log(`📄 У пользователя ${userId} есть блокировки:`, userInfo.blocked_users.substring(0, 200) + '...');
                            
                            let blockedUsers = [];
                            try {
                                if (typeof userInfo.blocked_users === 'string') {
                                    blockedUsers = userInfo.blocked_users.trim() ? JSON.parse(userInfo.blocked_users) : [];
                                } else if (Array.isArray(userInfo.blocked_users)) {
                                    blockedUsers = userInfo.blocked_users;
                                }
                                console.log(`✅ JSON парсинг успешен. Найдено блокировок: ${blockedUsers.length}`);
                            } catch (parseError) {
                                console.log(`⚠️ Ошибка парсинга blocked_users в беседе ${chatId} для пользователя ${userId}:`, parseError.message);
                                continue;
                            }
                            
                            // Ищем блокировки нашего целевого пользователя
                            console.log(`🎯 Ищем блокировки для target=${targetUserId} среди ${blockedUsers.length} блокировок`);
                            for (let i = 0; i < blockedUsers.length; i++) {
                                const block = blockedUsers[i];
                                console.log(`🔍 Блокировка ${i+1}:`, {
                                    blocked_user_id: block.blocked_user_id,
                                    blocked_by: block.blocked_by,
                                    block_until: block.block_until,
                                    reason: block.reason
                                });
                                
                                if (block.blocked_user_id) {
                                    console.log(`🔢 Сравниваем: блок=${parseInt(block.blocked_user_id)} vs цель=${parseInt(targetUserId)}`);
                                    
                                    if (parseInt(block.blocked_user_id) === parseInt(targetUserId)) {
                                        console.log(`🚫 НАЙДЕН БАН в беседе ${chatId}!`);
                                        
                                        // Проверяем срок действия бана
                                        const banExpiry = new Date(block.block_until);
                                        const now = new Date();
                                        console.log(`⏰ Проверяем срок: до=${banExpiry} vs сейчас=${now}`);
                                        
                                        // Добавляем только активные баны
                                        if (banExpiry > now || (banExpiry.getFullYear() - now.getFullYear()) > 5) {
                                            allBans.push({
                                                chatId: chatId,
                                                blockedUserId: block.blocked_user_id,
                                                blockedBy: block.blocked_by,
                                                blockUntil: block.block_until,
                                                reason: block.reason
                                            });
                                            console.log(`✅ БАН ДОБАВЛЕН В СПИСОК (активный)`);
                                        } else {
                                            console.log(`⏰ Бан пропущен (истёкший)`);
                                        }
                                    } else {
                                        console.log(`❌ ID не совпадает: ${block.blocked_user_id} !== ${targetUserId}`);
                                    }
                                } else {
                                    console.log(`❌ У блока нет blocked_user_id`);
                                }
                            }
                        } else {
                            console.log(`📄 У пользователя ${userId} нет блокировок (поле отсутствует)`);
                        }
                    } catch (fileError) {
                        console.log(`❌ Ошибка чтения файла ${userFile}:`, fileError.message);
                        continue;
                    }
                }
            } catch (dirError) {
                console.log(`❌ Ошибка чтения папки ${conferenceDir}:`, dirError.message);
                continue;
            }
        }
        
        console.log(`🎯 Поиск завершён. Найдено активных банов: ${allBans.length}`);
        return allBans;
        
    } catch (error) {
        console.error('❌ Критическая ошибка поиска банов:', error);
        return [];
    }
}

module.exports = {
    command: '/checkban',
    aliases: ['/чекбан'],
    description: 'Проверить блокировки пользователя во всех беседах',
    async execute(context) {
        const { peerId, text, senderId, replyMessage } = context;
        
        console.log(`🚀 НАЧАЛО ВЫПОЛНЕНИЯ /checkban`);
        console.log(`📝 peerId: ${peerId}, senderId: ${senderId}`);
        
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
        
        // Проверяем права доступа
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
                return context.reply(`❌ У вас нет прав для проверки блокировок других пользователей.\n\n💡 Используйте команду без параметров для проверки своих блокировок.`);
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
            // Ищем все баны пользователя ВО ВСЕХ БЕСЕДАХ (FILEDB.JS)
            console.log(`🔍 ЗАПУСКАЕМ ПОИСК БАНОВ... (FILEDB.JS)`);
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
                const chatTitle = await getChatTitle(ban.chatId);
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
