const database = require('../databases.js');
const { checkUserRole, checkIfTableExists, getUserRole, getRoleName, addCustomRole, initCustomRolesTable } = require('./roles.js');
const cacheManager = require('../cacheManager.js');

module.exports = {
  command: '/newrole',
  aliases: ['/newrole', '/добавитьроль'],
  description: 'Добавление или обновление роли',
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
    const hasAccess = await checkCommandPriority(peerId, senderId, '/newrole');
    if (!hasAccess) {
      const roleName = await getRoleName(peerId, senderUserRole);
      return context.send(`⛔ Доступ запрещён | Для использования команды /newrole требуется приоритет 80 или выше\n👤 Ваша роль: ${roleName} (приоритет ${senderUserRole})`);
    }

    if (parts.length < 3) {
      return context.reply('❌ Используйте: /newrole [приоритет] [название роли]');
    }

    const priority = parseInt(parts[1]);
    const roleName = parts.slice(2).join(' ');

    if (isNaN(priority)) {
      return context.reply('❌ Приоритет должен быть числом');
    }

    if (priority < 0 || priority > 100) {
      return context.reply('❌ Приоритет должен быть от 0 до 100');
    }

    // Только владелец может менять роль с приоритетом 0
    if (priority === 0 && senderUserRole !== 100) {
      return context.reply('❌ Только владелец может изменять название роли "Участник" (приоритет 0)');
    }

    // Проверяем, является ли это стандартной ролью (0, 20, 40, 60, 80, 100)
    const standardRoles = [0, 20, 40, 60, 80, 100];
    const isStandardRole = standardRoles.includes(priority);
    
    if (isStandardRole) {
      // Для стандартных ролей просто меняем название
      const result = await addCustomRole(peerId, priority, roleName);
      if (result.success) {
        // Очищаем кэш кастомных ролей для этой беседы
        const cacheKey = `custom_roles_${peerId}`;
        cacheManager.invalidate('customRoles', cacheKey);
        
        // Определяем название стандартной роли для сообщения
        let standardRoleName = '';
        switch(priority) {
          case 0: standardRoleName = 'участника'; break;
          case 20: standardRoleName = 'модератора'; break;
          case 40: standardRoleName = 'администратора'; break;
          case 60: standardRoleName = 'спец. администратора'; break;
          case 80: standardRoleName = 'руководителя'; break;
          case 100: standardRoleName = 'владельца'; break;
        }
        
        return context.reply(`✅ Роль ${standardRoleName} с приоритетом ${priority} изменена на «${roleName}»`);
      } else {
        return context.reply(`❌ ${result.message}`);
      }
    }

    // Для кастомных ролей проверяем, существует ли уже роль с таким приоритетом
    const existingRole = await getRoleName(peerId, priority);
    // Роль считается существующей только если она НЕ "Неизвестная роль"
    if (existingRole && !existingRole.startsWith('Неизвестная роль') && existingRole !== `Роль ${priority}`) {
      return context.reply(`❌ Роль с приоритетом ${priority} уже существует («${existingRole}»)`);
    }

    const result = await addCustomRole(peerId, priority, roleName);

    if (result.success) {
      // Очищаем кэш кастомных ролей для этой беседы
      const cacheKey = `custom_roles_${peerId}`;
      cacheManager.invalidate('customRoles', cacheKey);
      return context.reply(`✅ Роль "${roleName}" с приоритетом [${priority}] успешно ${priority === 0 ? 'добавлена' : 'обновлена'}`);
    } else {
      return context.reply(`❌ ${result.message}`);
    }
  }
}; 