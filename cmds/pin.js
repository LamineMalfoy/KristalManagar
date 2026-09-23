const { getUserRole, getRoleName, checkIfTableExists } = require('./roles.js');
const { vk } = require('../index.js');
const { checkCommandPriority, getCommandPriorities } = require('./editcmd.js');

module.exports = {
  command: '/pin',
  aliases: ['/pin'],
  description: 'Закрепить сообщение',
  async execute(context) {
    if (!await checkIfTableExists(`roles_${context.peerId}`)) {
      return context.reply('❌ Беседа не активирована');
    }

    // Проверяем приоритет команды через editcmd
    const hasPermission = await checkCommandPriority(context.peerId, context.senderId, '/pin');
    if (!hasPermission) {
      const priorities = await getCommandPriorities(context.peerId);
      const requiredRole = priorities['/pin'] || 60;
      const senderRoleId = await getUserRole(context.peerId, context.senderId);
      const senderRoleName = await getRoleName(context.peerId, senderRoleId);
      return context.reply(`⛔ Доступ запрещён | Для использования команды /pin требуется приоритет ${requiredRole} или выше\n👤 Ваша роль: ${senderRoleName} (приоритет ${senderRoleId})`);
    }
    if (!context.replyMessage) {
      return context.reply('❌ Вы не ответили на сообщение, которое требуется закрепить');
    }

    try {
      const pinMessage = await vk.api.messages.pin({
        peer_id: context.peerId,
        conversation_message_id: context.replyMessage.conversationMessageId
      });
    } catch (error) {
      return context.reply('❌ У меня нет прав, чтобы закрепить сообщение :( ');
    }
  }
}