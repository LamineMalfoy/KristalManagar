const { getUserRole, getRoleName } = require('./roles.js');
const database = require('../databases.js');
const { Keyboard } = require('vk-io');
const vk = require('../vkInstance.js');
const { extractNumericId } = require('./ban.js');

// Функция для получения имени пользователя
async function getUsername(userId) {
    try {
        const user = await vk.api.users.get({ user_ids: [userId] });
        return `${user[0].first_name} ${user[0].last_name}`;
    } catch (error) {
        console.error('Ошибка при получении информации о пользователе:', error);
        return 'Пользователь';
    }
}

module.exports = {
    command: '/q',
    aliases: ['/q'],
    description: 'Выйти из чата (кикнуть пользователя)',
    async execute(context) {
        const messageText = context.text;
        const { peerId } = context;
        const parts = messageText.split(' ');
        
        // Если команда без аргументов — выход самого себя
        let numericId;
        if (!parts[1]) {
            numericId = context.senderId;
        } else {
            return context.reply('⛔ Просто используйте /q чтобы выйти из чата!');
        }

        try {
            await vk.api.messages.removeChatUser({
                chat_id: peerId - 2000000000,
                member_id: numericId,
            });

            const username = await getUsername(numericId);
            context.reply(`🚪 [id${numericId}|${username}] вышел из чата по собственному желанию.`);
        } catch (error) {
            console.error(error);
            context.reply('❌ Ошибка системы | Не удалось выйти из беседы');
        }
    }
}; 