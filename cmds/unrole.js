const { getUserRole, getRoleName, checkIfTableExists } = require('./roles.js');
const database = require('../databases.js');
const { checkCommandPriority } = require('./editcmd.js');
const { extractNumericId } = require('./ban.js');
const { getlink } = require('../util.js');
const cacheManager = require('../cacheManager.js');

module.exports = {
    command: '/unrole',
    aliases: ['/снятьроль', '/unsetrole', '/убратьроль'],
    description: 'Снятие роли у пользователя',
    async execute(context) {
        const { peerId, senderId, replyMessage, text } = context;
        const parts = text.split(' ');

        if (!(await checkIfTableExists(`roles_${peerId}`))) {
            return context.reply('❌ Ваша беседа не зарегистрирована! Таблица ролей не найдена.');
        }

        // Проверяем права через checkCommandPriority
        const { checkCommandPriority } = require('./editcmd.js');
        const hasAccess = await checkCommandPriority(peerId, senderId, '/unrole');
        if (!hasAccess) {
            const senderUserRole = await getUserRole(peerId, context.senderId);
            const roleName = await getRoleName(peerId, senderUserRole);
            return context.send(`⛔ Доступ запрещён | Для использования команды /unrole требуется приоритет 40 или выше\n👤 Ваша роль: ${roleName} (приоритет ${senderUserRole})`);
        }
        
        const senderUserRole = await getUserRole(peerId, context.senderId);

        const targetUserIdRaw = replyMessage ? replyMessage.senderId : parts[1];
        const targetUserId = await extractNumericId(targetUserIdRaw);

        if (!targetUserId) {
            return context.reply('❌ Не указан пользователь. Укажите его через @ или ответьте на его сообщение.');
        }

        const targetUserRole = await getUserRole(peerId, targetUserId);

        if (targetUserRole === 0) {
            return context.reply('❌ У этого пользователя уже роль "Участник".');
        }

        if (senderUserRole <= targetUserRole) {
            return context.reply('❌ Вы не можете снять роль у пользователя с таким же или более высоким уровнем прав.');
        }

        const previousRoleName = await getRoleName(peerId, targetUserRole);

        const rolesTable = `roles_${peerId}`;
        const query = `INSERT INTO ${rolesTable} (user_id, role_id) VALUES (?, 0) ON DUPLICATE KEY UPDATE role_id = 0`;

        database.query(query, [targetUserId], async (error) => {
            if (error) {
                console.error('Ошибка при снятии роли:', error);
                return context.reply('❌ Произошла ошибка при обновлении роли в базе данных.');
            }
            
            // Очищаем кэш роли пользователя после успешного снятия
            const cacheKey = cacheManager.generateKey(peerId, targetUserId);
            cacheManager.invalidate('userRoles', cacheKey);

            const targetLink = await getlink(targetUserId);
            context.send(`✅ ${targetLink} успешно снята роль «${previousRoleName}».
Новая роль: «Участник»`);
        });
    }
}; 