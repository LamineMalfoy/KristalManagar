const database = require('../databases.js');
const { getUserRole, getRoleName, checkIfTableExists } = require('./roles.js');
// Убрано кэширование ролей для актуальности данных
const { invalidateBanList } = require('../optimized_util.js');
const { Keyboard } = require('vk-io');
const { addLog } = require('../utils/logs.js');
const { checkCommandPriority } = require('./editcmd.js');
const utils = require('../util.js');

// Функция для извлечения ID пользователя или сообщества
async function extractNumericId(idString) {
    if (!idString) {
        return null;
    }
  
    // Если это просто число (в том числе отрицательное)
    if (/^-?\d+$/.test(idString)) {
        return parseInt(idString);
    }
  
    // Для пользователей [id123|...]
    const matchUser = idString.match(/\[id(\d+)\|.*\]/);
    if (matchUser && matchUser[1]) {
        return parseInt(matchUser[1]);
    }
    
    // Для пользователей @id123
    const matchAtUser = idString.match(/@?id(\d+)/);
    if (matchAtUser && matchAtUser[1]) {
        return parseInt(matchAtUser[1]);
    }
    
    // Для упоминаний вида @username (без id)
    if (idString.startsWith('@')) {
        const username = idString.substring(1); // убираем @
        try {
            const userInfo = await vk.api.users.get({ user_ids: [username] });
            if (userInfo && userInfo.length > 0 && userInfo[0].id) {
                return userInfo[0].id;
            }
        } catch (error) {
            console.log(`Не удалось получить ID для @${username}:`, error.message);
        }
    }
  
    // Для сообществ (club123456, public123456, group123456)
    const matchGroup = idString.match(/(?:club|public|group)(\d+)/i);
    if (matchGroup && matchGroup[1]) {
        return -parseInt(matchGroup[1]);
    }
  
    // Для сообществ (например, -123456)
    const matchMinus = idString.match(/-\d+/);
    if (matchMinus) {
        return parseInt(matchMinus[0]);
    }
    
    // Проверяем VK ссылки типа https://vk.com/id123 или https://vk.com/username
    const vkLinkPattern = /(?:https?:\/\/)?(?:vk\.com|m\.vk\.com)\/(id)?(\d+|[a-zA-Z0-9_.]+)/;
    const vkMatches = idString.match(vkLinkPattern);
    
    if (vkMatches) {
        const identifier = vkMatches[2];
        
        // Если это число, возвращаем его
        if (/^\d+$/.test(identifier)) {
            return parseInt(identifier, 10);
        }
        
        // Если это имя пользователя, пытаемся разрешить через VK API
        try {
            const userInfo = await vk.api.users.get({ user_ids: [identifier] });
            if (userInfo && userInfo.length > 0 && userInfo[0].id) {
                return userInfo[0].id;
            }
        } catch (vkError) {
            // Игнорируем ошибки VK API для username
        }
    }
  
    // Попытка получить ID из имени пользователя через API VK (как fallback)
    try {
        if (typeof idString === 'string' && idString.trim()) {
            const userInfo = await vk.api.users.get({ user_ids: [idString.trim()] });
            if (userInfo && userInfo.length > 0 && userInfo[0].id) {
                return userInfo[0].id;
            }
        }
    } catch (error) {
        // Игнорируем ошибки fallback API
    }
  
    return null;
}

// Функция для бана пользователя
async function banUser(peerId, userId, reason, bannedBy = null, banDays = 999) {
    // Проверка на null/undefined
    if (userId === null || userId === undefined) {
        console.error('Ошибка при бане: userId не может быть null или undefined');
        return false;
    }

    const currentDate = new Date();
    const blockUntil = new Date(currentDate.getTime() + banDays * 24 * 60 * 60 * 1000);

    const blockInfo = {
        blocked_user_id: userId,
        blocked_by: bannedBy || userId,
        block_until: blockUntil,
        reason: reason,
    };

    const selectBlockedUsersQuery = `
        SELECT blocked_users
        FROM conference_${peerId}
        WHERE user_id = ?
    `;

    return new Promise((resolve, reject) => {
        database.query(selectBlockedUsersQuery, [userId], (error, results) => {
            if (error) {
                console.error('Ошибка при выборке заблокированных пользователей:', error);
                return reject(error);
            }

            let blockedUsers = [];
            if (results.length > 0 && results[0].blocked_users) {
                try {
                    blockedUsers = results[0].blocked_users.trim() ? JSON.parse(results[0].blocked_users) : [];
                } catch { blockedUsers = []; }
            }

            const existingBlockIndex = blockedUsers.findIndex(block => parseInt(block.blocked_user_id) === parseInt(userId));

            if (existingBlockIndex !== -1) {
                blockedUsers[existingBlockIndex] = blockInfo;
            } else {
                blockedUsers.push(blockInfo);
            }

            const updateBlockedUsersQuery = `
                INSERT INTO conference_${peerId} (user_id, blocked_users)
                VALUES (?, ?)
                ON DUPLICATE KEY UPDATE blocked_users = VALUES(blocked_users)
            `;

            database.query(updateBlockedUsersQuery, [userId, JSON.stringify(blockedUsers)], async (error, result) => {
                if (error) {
                    console.error('Ошибка при обновлении заблокированных пользователей:', error);
                    return reject(error);
                }

                try {
                    await vk.api.messages.removeChatUser({
                        chat_id: peerId - 2000000000,
                        member_id: userId,
                    });
                    resolve(true);
                } catch (kickError) {
                    console.error('Ошибка при исключении пользователя:', kickError);
                    // Даже если не удалось кикнуть, бан всё равно сохранён
                    resolve(true);
                }
            });
        });
    });
}

module.exports = {
    command: '/ban',
    aliases: ['/бан'],
    description: 'Забанить пользователя',
    async execute(context) {
        const { peerId, senderId, text, replyMessage } = context;
        
        // 1. Сначала проверяем существование таблицы
        if (!(await checkIfTableExists(`conference_${peerId}`))) {
            return context.send('⚠️ Беседа не активирована | Для активации используйте команду /start');
        }
        
        // 2. Затем проверяем права доступа
        const senderUserRole = await getUserRole(peerId, context.senderId);
        const hasPermission = await checkCommandPriority(peerId, context.senderId, '/ban');
        if (!hasPermission) {
            const { getCommandPriorities } = require('./editcmd.js');
            const priorities = await getCommandPriorities(peerId);
            const requiredRole = priorities['/ban'] || 20;
            const senderRole = await getUserRole(peerId, context.senderId);
            const senderRoleName = await getRoleName(peerId, senderRole);
            return context.reply(`⛔ Доступ запрещён | Для использования команды /ban требуется приоритет ${requiredRole} или выше\n👤 Ваша роль: ${senderRoleName} (приоритет ${senderRole})`);
        }

        let target;
        let banDays;
        let reason;
        let numericId;

        if (replyMessage) {
            const parts = text.split(' ');
            target = replyMessage.senderId;
            numericId = replyMessage.senderId;
            banDays = parseInt(parts[1]) || 999;
            reason = parts.slice(2).join(' ') || 'Без причины';
        } else {
            const parts = text.split(' ');
            target = parts[1];
            numericId = await extractNumericId(parts[1]);
            
            // 🔧 ИСПРАВЛЕННАЯ ЛОГИКА ПАРСИНГА АРГУМЕНТОВ
            if (parts.length === 2) {
                // /ban @user
                banDays = 999;
                reason = 'Без причины';
            } else if (parts.length === 3) {
                // /ban @user число ИЛИ /ban @user причина
                const possibleDays = parseInt(parts[2]);
                if (!isNaN(possibleDays) && possibleDays > 0) {
                    // /ban @user 30
                    banDays = possibleDays;
                    reason = 'Без причины';
                } else {
                    // /ban @user причина
                    banDays = 999;
                    reason = parts[2];
                }
            } else {
                // /ban @user число причина ИЛИ /ban @user причина с пробелами
                const possibleDays = parseInt(parts[2]);
                if (!isNaN(possibleDays) && possibleDays > 0) {
                    // /ban @user 30 причина
                    banDays = possibleDays;
                    reason = parts.slice(3).join(' ') || 'Без причины';
                } else {
                    // /ban @user причина с пробелами
                    banDays = 999;
                    reason = parts.slice(2).join(' ') || 'Без причины';
                }
            }
        }

        // 3. Проверяем параметры
        if (!target) {
            return context.reply(`❓ Аргументы введены неверно. Необходимо указать пользователя, время блокировки в днях и причину.
      
❓ Примеры использования:
/ban @user 30 причина
/ban @user 30
/ban - ответом на сообщение`);
        }

        if (!numericId) {
            return context.reply(`❓ Аргументы введены неверно. Необходимо указать пользователя, время блокировки в днях и причину.
      
❓ Примеры использования:
/ban @user 30 причина
/ban @user 30
/ban - ответом на сообщение`);
        }

        if (Number(numericId) === Number(context.senderId)) {
            return context.reply('❌ Вы не можете забанить самого себя.');
        }

        // Проверяем, что нельзя банить бота
        if (global.botId && (Number(numericId) === Number(global.botId) || Number(numericId) === Math.abs(Number(global.botId)))) {
            console.log(`🚨 Попытка бана бота! numericId: ${numericId}, botId: ${global.botId}`);
            return context.reply('🤖 Нельзя банить бота! Я же ваш помощник 😅');
        }
        
        // Дополнительная проверка через VK API (если global.botId еще не установлен)
        if (!global.botId) {
            try {
                const botInfo = await vk.api.groups.getById({});
                if (botInfo && botInfo.groups && botInfo.groups[0]) {
                    const realBotId = -botInfo.groups[0].id;
                    if (Number(numericId) === Number(realBotId) || Number(numericId) === Math.abs(Number(realBotId))) {
                        console.log(`🚨 Попытка бана бота! numericId: ${numericId}, realBotId: ${realBotId}`);
                        return context.reply('🤖 Нельзя банить бота! Я же ваш помощник 😅');
                    }
                }
            } catch (error) {
                console.error('Ошибка при проверке ID бота:', error);
            }
        }

        // Получаем роль цели без кэширования
        const targetUserRole = await getUserRole(peerId, numericId);

        if (senderUserRole <= targetUserRole) {
            return context.reply('⛔ Доступ запрещен | Вы не можете заблокировать пользователя с равной или более высокой ролью');
        }



        const currentDate = new Date();
        const blockUntil = new Date(currentDate.getTime() + banDays * 24 * 60 * 60 * 1000);

        const blockInfo = {
            blocked_user_id: numericId,
            blocked_by: senderId,
            block_until: blockUntil,
            reason: reason,
        };

        const selectBlockedUsersQuery = `
            SELECT blocked_users
            FROM conference_${peerId}
            WHERE user_id = ?
        `;

        database.query(selectBlockedUsersQuery, [numericId], async (error, results) => {
            if (error) {
                console.error('Ошибка при выборке заблокированных пользователей:', error);
                return context.send('❌ Ошибка системы | Не удалось получить данные о блокировках');
            }

            let blockedUsers = [];
            if (results.length > 0 && results[0].blocked_users) {
                try {
                    blockedUsers = results[0].blocked_users.trim() ? JSON.parse(results[0].blocked_users) : [];
                } catch { blockedUsers = []; }
            }

            const existingBlockIndex = blockedUsers.findIndex(block => block.blocked_user_id === numericId);

            if (existingBlockIndex !== -1) {
                blockedUsers[existingBlockIndex] = blockInfo;
            } else {
                blockedUsers.push(blockInfo);
            }

            const updateBlockedUsersQuery = `
                INSERT INTO conference_${peerId} (user_id, blocked_users)
                VALUES (?, ?)
                ON DUPLICATE KEY UPDATE blocked_users = VALUES(blocked_users)
            `;

            database.query(updateBlockedUsersQuery, [numericId, JSON.stringify(blockedUsers)], async (error, result) => {
                if (error) {
                    console.error('Ошибка при обновлении заблокированных пользователей:', error);
                    return context.send('❌ Ошибка системы | Не удалось обновить данные о блокировках');
                }

                // Формируем дату для сообщения
                function formatDate(date) {
                  const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
                  const month = months[date.getMonth()];
                  const day = date.getDate();
                  const year = date.getFullYear();
                  let hours = date.getHours();
                  let minutes = date.getMinutes();
                  if (minutes < 10) minutes = '0' + minutes;
                  return `${day} ${month} ${year} года в ${hours}:${minutes} по GMT+3`;
                }
                const formattedDate = formatDate(blockUntil);

                // Получаем красивую ссылку на пользователя или сообщество
                const userLink = await utils.getlink(numericId);
                const adminLink = await utils.getlink(senderId);
                
                // Добавляем запись в журнал действий
                addLog(peerId, senderId, numericId, 'ban', `Причина: ${reason}. Срок: ${banDays} дней`)
                  .catch(err => console.error('Ошибка при логировании бана:', err));

                // Создаем клавиатуру с кнопкой снятия бана
                const keyboard = Keyboard.builder()
                  .callbackButton({
                    label: '🔴 Снять блокировку',
                    payload: {
                      button: numericId,
                      banned_by: senderId,
                      event_id: 6910
                    },
                    color: Keyboard.NEGATIVE_COLOR
                  })
                  .inline();

                // 🚀 ОПТИМИЗАЦИЯ: Инвалидируем кэш после бана
                invalidateBanList(peerId);

                // Формируем сообщение о бане по новому шаблону
                let banMessage = `🚷 Пользователь ${userLink} заблокирован до ${formattedDate}.\n\n`;

                if (reason && reason !== 'Без причины') {
                  banMessage += `Причина: ${reason}.\n`;
                } else {
                  banMessage += `Причина блокировки не указана.\n`;
                }

                banMessage += `Решение принял администратор ${adminLink}.`;

                context.reply({
                  message: banMessage,
                  keyboard: keyboard
                });

                try {
                    await vk.api.messages.removeChatUser({
                        chat_id: peerId - 2000000000,
                        member_id: numericId,
                    });
                } catch (kickError) {
                    console.error('Ошибка при исключении пользователя:', kickError);
                    // Пользователь забанен в базе, но не удалось кикнуть из чата
                    context.reply('⚠️ Пользователь забанен в базе, но не удалось исключить из чата.');
                }
            });
        });
    },
    extractNumericId,
    banUser
};
