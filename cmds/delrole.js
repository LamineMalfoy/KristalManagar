const database = require('../databases.js');
const { checkUserRole, checkIfTableExists, getUserRole, getRoleName, deleteCustomRole, getAllCustomRoles } = require('./roles.js');
const cacheManager = require('../cacheManager.js');

module.exports = {
  command: '/delrole',
  aliases: ['/delrole', '/удалитьроль', '/deleterole'],
  description: 'Удаление роли',
  async execute(context) {
    const messageText = context.text;
    const { peerId, senderId } = context;
    const parts = messageText.split(' ');

     
    const senderUserRole = await getUserRole(peerId, context.senderId);

    if (!await checkIfTableExists(`roles_${peerId}`)) {
      return context.reply('❌ Таблица ролей не существует');
    }

    // Проверяем права через checkCommandPriority
    const { checkCommandPriority } = require('./editcmd.js');
    const hasAccess = await checkCommandPriority(peerId, senderId, '/delrole');
    if (!hasAccess) {
      const roleName = await getRoleName(peerId, senderUserRole);
      return context.send(`⛔ Доступ запрещён | Для использования команды /delrole требуется приоритет 80 или выше\n👤 Ваша роль: ${roleName} (приоритет ${senderUserRole})`);
    }

    if (parts.length < 2) {
      return context.reply('❌ Использование: /delrole [приоритет или название]');
    }

    const roleIdentifier = parts.slice(1).join(' ');
    
    if (!roleIdentifier) {
      return context.reply('❌ Укажите ID или название роли для удаления');
    }

    // Защита от удаления роли владельца (100)
    if (roleIdentifier === '100' || roleIdentifier === 100) {
      return context.reply('❌ Нельзя удалить роль владельца (приоритет 100)! Можно только переименовать через /newrole 100 [название]');
    }
     
    const result = await deleteCustomRole(peerId, roleIdentifier);

    if (result.success) {
      // Очищаем кэш кастомных ролей после удаления
      const cacheKey = `custom_roles_${peerId}`;
      cacheManager.invalidate('customRoles', cacheKey);
      return context.reply(`✅ ${result.message}`);
    } else {
      return context.reply(`❌ ${result.message}`);
    }
  }
}; 