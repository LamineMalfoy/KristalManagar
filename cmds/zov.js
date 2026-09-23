const { checkUserRole, checkIfTableExists, getUserRole, getRoleName, getRoleNamezov } = require('./roles.js');
const { checkCommandPriority, getCommandPriorities } = require('./editcmd.js');
const { vk } = require('../index.js');
const { getlink } = require('../util.js');

module.exports = {
    command: '/zov',
    aliases: ['/зов', '/вызов'],
    description: 'Массовое упоминание всех пользователей в беседе',
    async execute(context) {
        const messageText = context.text;
        const { peerId, senderId, replyMessage } = context;
        const parts = messageText.split(' ');
        const senderUserRole = await getUserRole(peerId, context.senderId);
        const reason = parts.slice(1).join(' ');
        
        if (!await checkIfTableExists(`nicknames_${peerId}`)) {
            console.error('Таблица никнеймов не существует');
            return context.send('Ваша беседа не зарегистрирована!');
        }
        const conversationMembers = await vk.api.messages.getConversationMembers({
            peer_id: context.peerId,
        });

        // Новая проверка приоритета
        const hasPermission = await checkCommandPriority(peerId, senderId, '/zov');
        if (!hasPermission) {
            const priorities = await getCommandPriorities(peerId);
            const requiredRole = priorities['/zov'] || 20;
            const senderRole = await getUserRole(peerId, context.senderId);
            const senderRoleName = await getRoleName(peerId, senderRole);
            return context.reply(`⛔ Доступ запрещён | Для использования команды /zov требуется приоритет ${requiredRole} или выше\n👤 Ваша роль: ${senderRoleName} (приоритет ${senderRole})`);
        }
        if (!reason) {
            return context.reply('❌ Вы не указали причину вызова');
        }

        const memberProfiles = conversationMembers.profiles;  
        let message = '';

        for (const member of memberProfiles) {
            const name = `[id${member.id}|☑️]`;
            message += `${name} `;
        }

        const role = await getRoleNamezov(senderUserRole);
        const pingMessage = await context.send(`Пинг: ${message}`);
		console.log(pingMessage)
		console.log(pingMessage.conversationMessageId)
		let pingidmsg = pingMessage.conversationMessageId
		console.log(pingidmsg)
        const senderLink = await getlink(senderId);
        const editedMessage = `
	🔊 Вы были вызваны ${senderLink} беседы.

Причина: ${reason}!​⁬​⁬​⁬​⁬​⁬​⁬​⁬​⁬​⁬​⁬​⁬​⁬​⁬​⁬​⁬​⁬​⁬​⁬​⁬​⁬​⁬​⁬​⁬​⁬​⁬​⁬​⁬​⁬​⁬​⁬​⁬​⁬​⁬​⁬​⁬​⁬​⁬​⁬​⁬
`;
        await vk.api.messages.edit({
            peer_id: context.peerId,
            message: editedMessage,
            conversation_message_id: pingidmsg,
        });
    },
};
