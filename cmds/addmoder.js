const { getUserRole, checkIfTableExists, getRoleName } = require('./roles.js');
const database = require('../databases.js');  
const util = require('util');
const databaseQuery = util.promisify(database.query);
const { extractNumericId } = require('./ban.js');
const { getlink } = require('../util.js');

module.exports = {
    command: '/addmoder',
    aliases: ['/датьмодера', '/модер'],
    description: 'Назначение роли «Модератор»',
    async execute(context) {
        const { peerId, senderId, replyMessage, text } = context;

        if (!(await checkIfTableExists(`roles_${peerId}`))) {
            return context.reply('❌ Ваша беседа не зарегистрирована! Таблица ролей не найдена.');
        }

        const senderUserRole = await getUserRole(peerId, context.senderId);

        if (senderUserRole < 40) { // Права на выдачу с Администратора
            return context.reply('❌ У вас нет прав. Требуется роль «Администратор» или выше.');
        }

        const targetUserIdRaw = replyMessage ? replyMessage.senderId : text.split(' ')[1];
        const targetUserId = await extractNumericId(targetUserIdRaw);

        if (!targetUserId) {
            return context.reply('❌ Не указан пользователь. Укажите его через @ или ответьте на его сообщение.');
        }

        const targetUserRole = await getUserRole(peerId, targetUserId);

        if (senderUserRole <= targetUserRole) {
            return context.reply('❌ Вы не можете изменить роль пользователя с таким же или более высоким уровнем прав.');
        }

        if (20 >= senderUserRole) {
             return context.reply('❌ Вы не можете выдать роль, которая равна или выше вашей.');
        }

        const previousRoleName = await getRoleName(peerId, targetUserRole);
        const newRoleName = await getRoleName(peerId, 20, { forceStandard: true });

        const rolesTable = `roles_${peerId}`;
        const query = `INSERT INTO ${rolesTable} (user_id, role_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE role_id = VALUES(role_id)`;

        database.query(query, [targetUserId, 20], async (error) => {
            if (error) {
                console.error('Ошибка при назначении роли модератора:', error);
                return context.reply('❌ Произошла ошибка при обновлении роли в базе данных.');
            }

            const targetLink = await getlink(targetUserId);
            context.send(`✅ ${targetLink} успешно выдана роль «${newRoleName}».
Прежняя роль: «${previousRoleName}»`);
        });
    }
};
