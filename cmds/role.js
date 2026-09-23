const { getUserRole, getRoleName, checkIfTableExists, getAllCustomRoles } = require('./roles.js');
const database = require('../databases.js');
const { Keyboard } = require('vk-io');
const { addLog } = require('../utils/logs.js');
const { checkCommandPriority } = require('./editcmd.js');
const { extractNumericId } = require('./ban.js');
const { getlink } = require('../util.js');
const cacheManager = require('../cacheManager.js');





module.exports = {
    command: '/role',
    aliases: ['/роль', '/setrole', '/датьроль'],
    description: 'Назначение роли пользователю',
    async execute(context) {
        const { peerId, senderId, replyMessage, text } = context;
        const parts = text.split(' ');

        if (!(await checkIfTableExists(`roles_${peerId}`))) {
            return context.reply('❌ Ваша беседа не зарегистрирована! Таблица ролей не найдена.');
        }

        // Проверяем права через checkCommandPriority
        const { checkCommandPriority } = require('./editcmd.js');
        const hasAccess = await checkCommandPriority(peerId, senderId, '/role');
        if (!hasAccess) {
            const senderUserRole = await getUserRole(peerId, context.senderId);
            const roleName = await getRoleName(peerId, senderUserRole);
            return context.send(`⛔ Доступ запрещён | Для использования команды /role требуется приоритет 40 или выше\n👤 Ваша роль: ${roleName} (приоритет ${senderUserRole})`);
        }
        
        const senderUserRole = await getUserRole(peerId, context.senderId);

        if (parts.length < 2) {
            return context.reply('❌ Используйте: /role [приоритет] [или ответ]');
        }

        const roleNameQuery = parts[1].toLowerCase();
        const allRoles = await getAllCustomRoles(peerId);
        
        const standardRoles = [
            { role_id: 0, role_name: 'Участник' },
            { role_id: 20, role_name: 'Модератор' },
            { role_id: 40, role_name: 'Администратор' },
            { role_id: 60, role_name: 'Спец. Администратор' },
            { role_id: 80, role_name: 'Руководитель' },
            { role_id: 100, role_name: 'Владелец' }
        ];

        let targetRole = allRoles.find(role => role.role_name.toLowerCase() === roleNameQuery);

        if (!targetRole) {
            const roleIdQuery = parseInt(roleNameQuery, 10);
            if (!isNaN(roleIdQuery)) {
                // Сначала ищем в кастомных
                targetRole = allRoles.find(role => role.role_id === roleIdQuery);
                // Если не нашли в кастомных, ищем в стандартных
                if (!targetRole) {
                    targetRole = standardRoles.find(role => role.role_id === roleIdQuery);
                }
            }
        }

        if (!targetRole) {
            const availableRoles = allRoles.map(r => `— ${r.role_name} (ID: ${r.role_id})`).join('\n');
            return context.reply(`❌ Роль «${parts[1]}» не найдена.\n\n📜 Доступные роли:\n${availableRoles}`);
        }

        const targetUserIdRaw = replyMessage ? replyMessage.senderId : parts[2];
        const targetUserId = await extractNumericId(targetUserIdRaw);

        if (!targetUserId) {
            return context.reply('❌ Не указан пользователь. Укажите его через @ или ответьте на его сообщение.');
        }

        const targetUserRole = await getUserRole(peerId, targetUserId);

        if (senderUserRole <= targetUserRole) {
            return context.reply('❌ Вы не можете изменить роль пользователя с таким же или более высоким уровнем прав.');
        }

        if (senderUserRole <= targetRole.role_id) {
            return context.reply(`❌ Вы не можете выдать роль «${targetRole.role_name}», так как она равна или выше вашей.`);
        }

        const previousRoleName = await getRoleName(peerId, targetUserRole);

        const rolesTable = `roles_${peerId}`;
        const query = `INSERT INTO ${rolesTable} (user_id, role_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE role_id = VALUES(role_id)`;

        database.query(query, [targetUserId, targetRole.role_id], async (error) => {
            if (error) {
                console.error('Ошибка при назначении роли:', error);
                return context.reply('❌ Произошла ошибка при обновлении роли в базе данных.');
            }
            
            // Очищаем кэш роли пользователя после успешной выдачи
            const cacheKey = cacheManager.generateKey(peerId, targetUserId);
            cacheManager.invalidate('userRoles', cacheKey);

            try {
                // Используем функцию getlink для корректного отображения пользователей и сообществ
                const targetLink = await getlink(targetUserId);
                const adminLink = await getlink(senderId);

                // Добавляем запись в журнал действий
                addLog(peerId, senderId, targetUserId, 'role', `Назначена роль "${targetRole.role_name}" с приоритетом ${targetRole.role_id}`)
                  .catch(err => console.error('Ошибка при логировании изменения роли:', err));

                // Создаем кнопку "Снять" для снятия роли
                const removeRoleKeyboard = Keyboard.builder()
                    .callbackButton({
                        label: 'Снять',
                        color: Keyboard.POSITIVE_COLOR,
                        payload: {
                            event_id: 9999,
                            target_user: targetUserId,
                            admin_user: senderId
                        }
                    })
                    .inline();

                context.send({
                    message: `✅ | ${targetLink} назначена роль "${targetRole.role_name}" с приоритетом ${targetRole.role_id}.\n\n👤 | Роль выдал: ${adminLink}.`,
                    keyboard: removeRoleKeyboard
                });
            } catch (error) {
                console.error('Ошибка при получении ссылок на пользователей:', error);
              
                // Добавляем запись в журнал действий
                addLog(peerId, senderId, targetUserId, 'role', `Назначена роль "${targetRole.role_name}" с приоритетом ${targetRole.role_id}`)
                  .catch(err => console.error('Ошибка при логировании изменения роли:', err));
              
                // Fallback с правильным форматом для сообществ
                const targetFallback = targetUserId < 0 ? `[club${Math.abs(targetUserId)}|Сообщество]` : `[id${targetUserId}|Пользователь]`;
                const adminFallback = `[id${senderId}|Администратор]`;
                context.send(`✅ | ${targetFallback} назначена роль "${targetRole.role_name}" с приоритетом ${targetRole.role_id}.\n\n👤 | Роль выдал: ${adminFallback}.`);
            }
        });
    }
};
