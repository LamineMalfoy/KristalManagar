const { getUserRole, getRoleName, checkIfTableExists } = require('./roles.js');
const { vk } = require('../index.js');
const { checkCommandPriority, getCommandPriorities } = require('./editcmd.js');

module.exports = {
  command: '/unpin',
  aliases: ['/unpin'],
  description: 'Открепить сообщение',
  async execute(context) {
    if (!await checkIfTableExists(`roles_${context.peerId}`)) {
      return context.reply('❌ Беседа не активирована');
    }

    // Проверяем приоритет команды через editcmd
    const hasPermission = await checkCommandPriority(context.peerId, context.senderId, '/unpin');
    if (!hasPermission) {
      const priorities = await getCommandPriorities(context.peerId);
      const requiredRole = priorities['/unpin'] || 60;
      const senderRoleId = await getUserRole(context.peerId, context.senderId);
      const senderRoleName = await getRoleName(context.peerId, senderRoleId);
      return context.reply(`⛔ Доступ запрещён | Для использования команды /unpin требуется приоритет ${requiredRole} или выше\n👤 Ваша роль: ${senderRoleName} (приоритет ${senderRoleId})`);
    }

    try {
      // Пытаемся открепить сообщение напрямую
      await vk.api.messages.unpin({
        peer_id: context.peerId
      });
      
      return context.reply('✅ Сообщение успешно откреплено');
      
    } catch (error) {
      console.error('Ошибка при откреплении сообщения:', error);
      
      // Обрабатываем разные типы ошибок
      if (error.code === 15) {
        return context.reply('❌ У меня нет прав на открепление сообщений в этом чате');
      } else if (error.code === 936) {
        return context.reply('ℹ️ В чате нет закреплённого сообщения');
      } else if (error.message && error.message.includes('no pinned message')) {
        return context.reply('ℹ️ В чате нет закреплённого сообщения');
      } else {
        console.log('Код ошибки:', error.code, 'Сообщение:', error.message);
        return context.reply('❌ Произошла ошибка при откреплении сообщения');
      }
    }
  }
}