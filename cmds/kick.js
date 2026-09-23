const { getUserRole, getRoleName } = require('./roles.js');
const database = require('../databases.js');
const { Keyboard } = require('vk-io');
const { addLog } = require('../utils/logs.js');
const { checkCommandPriority } = require('./editcmd.js');
const { extractNumericId } = require('./ban.js');
const { getlink } = require('../util.js');
const logger = require('../logger.js');

// Функция для получения имени пользователя
async function getUsername(userId) {
    try {
        const user = await vk.api.users.get({ user_ids: [userId] });
        return `${user[0].first_name} ${user[0].last_name}`;
    } catch (error) {
        logger.error('Ошибка при получении информации о пользователе:', error);
        return 'Пользователь';
    }
}

module.exports = {
    command: '/kick',
    aliases: ['/кик'],
    description: 'Кик пользователя из чата',
    async execute(context) {
        const messageText = context.text;
        const { peerId } = context;
        const parts = messageText.split(' ');   
        
        if (context.replyMessage) {
            const target = context.replyMessage.senderId;
            // Извлекаем причину кика из аргументов (/kick причина)
            const reason = parts.slice(1).join(' ') || 'Не указана';
            
            const senderUserRole = await getUserRole(peerId, context.senderId);
            
            // Проверяем приоритет команды
            const hasPermission = await checkCommandPriority(peerId, context.senderId, '/kick');
            if (!hasPermission) {
                const { getCommandPriorities } = require('./editcmd.js');
                const priorities = await getCommandPriorities(peerId);
                const requiredRole = priorities['/kick'] || 20;
                const senderRole = await getUserRole(peerId, context.senderId);
                const senderRoleName = await getRoleName(peerId, senderRole);
                return context.reply(`⛔ Доступ запрещён | Для использования команды /kick требуется приоритет ${requiredRole} или выше\n👤 Ваша роль: ${senderRoleName} (приоритет ${senderRole})`);
            }

            if (!target) {
                return context.reply(`❓ Аргументы введены неверно. Необходимо указать пользователя для исключения.
                
❓ Примеры использования:
/kick @user причина
/kick @user
/kick - ответом на сообщение`);
            }
            
            if (target === context.senderId) {
                return context.reply('⚠️ Ошибка | Вы не можете исключить самого себя');
            }
            
            // Проверяем, что цель не является нашим ботом
            const botId = global.botId;
            if (target === botId) {
                return context.reply('❌ Ошибка | Нельзя исключить этого бота.');
            }

            const targetUserRole = await getUserRole(peerId, target);

            if (targetUserRole >= senderUserRole) {
                return context.reply(`⛔ Доступ запрещен | Вы не можете заблокировать пользователя с равной или более высокой ролью`);
            }


            
            if(target === '-222532223') {
                return context.reply('⛔ Доступ запрещен | Данного пользователя нельзя исключить из беседы');
            }
            
            try {
                const kickResult = await vk.api.messages.removeChatUser({
                    chat_id: peerId - 2000000000,
                    member_id: target,
                });
                
                const rolesTable = `roles_${peerId}`;
                const deleteRoleQuery = `DELETE FROM ${rolesTable} WHERE user_id = ?`;
                
                const nicknamesTable = `nicknames_${peerId}`;
                const deleteNickQuery = `DELETE FROM ${nicknamesTable} WHERE user_id = ?`;
                
                database.query(deleteNickQuery, [target], (error) => {
                    if (error) logger.error('Ошибка при удалении никнейма:', error);
                });
                
                database.query(deleteRoleQuery, [target], (error) => {
                    if (error) logger.error('Ошибка при удалении роли:', error);
                });

                logger.log('Kick Result:', kickResult);

                // Получаем кликабельные ссылки на пользователей
                const targetUserLink = await utils.getlink(target);
                const adminUserLink = await utils.getlink(context.senderId);
                
                const buttonPayload = {
                    target_user_id: target,
                    banned_by: context.senderId,
                    reason: reason,
                    event_id: 6913
                };

                const keyboard = Keyboard.builder()
                    .callbackButton({
                        label: '🔴 Забанить на 7 дней',
                        payload: JSON.stringify(buttonPayload),
                        inline: true,
                        color: Keyboard.PRIMARY_COLOR, // Белая кнопка
                    })
                    .inline();
                
                // Добавляем запись в журнал действий с причиной
                addLog(peerId, context.senderId, target, 'kick', `Исключение пользователя из беседы. Причина: ${reason}`)
                  .catch(err => logger.error('Ошибка при логировании кика:', err));
                
                // Сообщение об исключении с кликабельными именами и причиной
                const kickMessage = reason !== 'Не указана' 
                    ? `✅ ${targetUserLink} был исключён из чата администратором ${adminUserLink}.\n❓ Причина: ${reason}`
                    : `✅ ${targetUserLink} был исключён из чата администратором ${adminUserLink}.`;
                
                context.reply({ 
                    message: kickMessage,
                    keyboard: keyboard
                });
            } catch (error) {
                logger.error('Ошибка при исключении пользователя:', error);
                
                // Проверяем тип ошибки для более информативных сообщений
                if (error.code === 15 || error.code === 917 || error.code === 7 || error.message?.includes('access') || error.message?.includes('admin') || error.message?.includes('права') || error.message?.includes('Permission')) {
                    // Ошибка связана с правами доступа
                    try {
                        const userInfo = await vk.api.users.get({ user_ids: [target] });
                        const userName = userInfo[0] ? `${userInfo[0].first_name} ${userInfo[0].last_name}` : 'Пользователь';
                        
                        return context.reply(`❗️ Операция невозможна — у бота нет админских прав или у пользователя есть системная звезда.`);
                    } catch (userError) {
                        return context.reply(`❗️ Операция невозможна — у бота нет админских прав или у пользователя есть системная звезда.`);
                    }
                }
                
                // Для других ошибок показываем общее сообщение
                context.reply('❌ Ошибка системы | Не удалось исключить пользователя из беседы');
            }
        } else {
            const target = parts[1];
            // Извлекаем причину кика из аргументов (/kick @user причина)
            const reason = parts.slice(2).join(' ') || 'Не указана';
            
            const senderUserRole = await getUserRole(peerId, context.senderId);
            
            // Проверяем приоритет команды
            const hasPermission = await checkCommandPriority(peerId, context.senderId, '/kick');
            if (!hasPermission) {
                const { getCommandPriorities } = require('./editcmd.js');
                const priorities = await getCommandPriorities(peerId);
                const requiredRole = priorities['/kick'] || 20;
                const senderRole = await getUserRole(peerId, context.senderId);
                const senderRoleName = await getRoleName(peerId, senderRole);
                return context.reply(`⛔ Доступ запрещён | Для использования команды /kick требуется приоритет ${requiredRole} или выше\n👤 Ваша роль: ${senderRoleName} (приоритет ${senderRole})`);
            }

            if (!target) {
                return context.reply(`❓ Аргументы введены неверно. Необходимо указать пользователя для исключения.
                
❓ Примеры использования:
/kick @user причина
/kick @user
/kick - ответом на сообщение`);
            }

            const numericId = await extractNumericId(target);
            
            if (!numericId) {
                return context.reply('❓ Неверный формат | Укажите пользователя в формате @id12345');
            }
            
            if (numericId === context.senderId) {
                return context.reply('⚠️ Ошибка | Вы не можете исключить самого себя');
            }
            
            // Проверяем, что цель не является нашим ботом
            const botId = global.botId;
            if (numericId === botId) {
                return context.reply('❌ Ошибка | Нельзя исключить этого бота.');
            }

            const targetUserRole = await getUserRole(peerId, numericId);

            if (targetUserRole >= senderUserRole) {
                return context.reply(`⛔ Доступ запрещен | Вы не можете заблокировать пользователя с равной или более высокой ролью`);
            }

            try {
                const kickResult = await vk.api.messages.removeChatUser({
                    chat_id: peerId - 2000000000,
                    member_id: numericId,
                });
                
                logger.log('Kick Result:', kickResult);

                const rolesTable = `roles_${peerId}`;
                const deleteRoleQuery = `DELETE FROM ${rolesTable} WHERE user_id = ?`;
                
                const nicknamesTable = `nicknames_${peerId}`;
                const deleteNickQuery = `DELETE FROM ${nicknamesTable} WHERE user_id = ?`;
                
                database.query(deleteNickQuery, [numericId], (error) => {
                    if (error) logger.error('Ошибка при удалении никнейма:', error);
                });
                
                database.query(deleteRoleQuery, [numericId], (error) => {
                    if (error) logger.error('Ошибка при удалении роли:', error);
                });

                // Получаем кликабельные ссылки на пользователей
                const targetUserLink = await utils.getlink(numericId);
                const adminUserLink = await utils.getlink(context.senderId);

                const buttonPayload = {
                    target_user_id: numericId,
                    banned_by: context.senderId,
                    reason: reason,
                    event_id: 6913
                };

                const keyboard = Keyboard.builder()
                    .callbackButton({
                        label: '🔴 Забанить на 7 дней',
                        payload: JSON.stringify(buttonPayload),
                        inline: true,
                        color: Keyboard.PRIMARY_COLOR, // Белая кнопка
                    })
                    .inline();
                
                // Добавляем запись в журнал действий с причиной
                addLog(peerId, context.senderId, numericId, 'kick', `Исключение пользователя из беседы. Причина: ${reason}`)
                  .catch(err => logger.error('Ошибка при логировании кика:', err));
                
                // Сообщение об исключении с кликабельными именами и причиной
                const kickMessage = reason !== 'Не указана' 
                    ? `✅ ${targetUserLink} был исключён из чата администратором ${adminUserLink}.\n❓ Причина: ${reason}`
                    : `✅ ${targetUserLink} был исключён из чата администратором ${adminUserLink}.`;
                
                context.reply({ 
                    message: kickMessage,
                    keyboard: keyboard
                });
            } catch (error) {
                logger.error('Ошибка при исключении пользователя:', error);
                
                // Проверяем тип ошибки для более информативных сообщений
                if (error.code === 15 || error.code === 917 || error.code === 7 || error.message?.includes('access') || error.message?.includes('admin') || error.message?.includes('права') || error.message?.includes('Permission')) {
                    // Ошибка связана с правами доступа
                    try {
                        const userInfo = await vk.api.users.get({ user_ids: [numericId] });
                        const userName = userInfo[0] ? `${userInfo[0].first_name} ${userInfo[0].last_name}` : 'Пользователь';
                        
                        return context.reply(`❗️ Операция невозможна — у бота нет админских прав или у пользователя есть системная звезда.`);
                    } catch (userError) {
                        return context.reply(`❗️ Операция невозможна — у бота нет админских прав или у пользователя есть системная звезда.`);
                    }
                }
                
                // Для других ошибок показываем общее сообщение
                context.reply('❌ Ошибка системы | Не удалось исключить пользователя из беседы');
            }
        }
    }
};
