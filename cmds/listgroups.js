const database = require('../databases.js');
const { getUserRole, getRoleName, checkIfTableExists } = require('./roles.js');
const { checkCommandPriority } = require('./editcmd.js');
const util = require('util');
const queryAsync = util.promisify(database.query).bind(database);

module.exports = {
  command: '/listgroups',
  aliases: ['/списокгрупп'],
  description: 'Показать список обязательных подписок',
  
  async execute(context) {
    const { peerId, senderId } = context;
    
    // Проверяем существование таблицы
    if (!(await checkIfTableExists(`conference_${peerId}`))) {
      return context.send('⚠️ Беседа не активирована | Для активации используйте команду /start');
    }
    
    // Проверяем права доступа
    const hasPermission = await checkCommandPriority(peerId, senderId, '/listgroups');
    if (!hasPermission) {
      const { getCommandPriorities } = require('./editcmd.js');
      const priorities = await getCommandPriorities(peerId);
      const requiredRole = priorities['/listgroups'] || 100;
      const senderRole = await getUserRole(peerId, senderId);
      const senderRoleName = await getRoleName(peerId, senderRole);
      return context.reply(`⛔ Доступ запрещён | Для использования команды /listgroups требуется приоритет ${requiredRole} или выше\n👤 Ваша роль: ${senderRoleName} (приоритет ${senderRole})`);
    }
    
    try {
      // Получаем текущий список обязательных подписок из файла конференции
      const query = `SELECT * FROM conference_${peerId} WHERE conference_id = ? LIMIT 1`;
      const result = await queryAsync(query, [peerId]);
      
      let requiredGroups = [];
      if (result.length > 0 && result[0].required_groups) {
        try {
          requiredGroups = JSON.parse(result[0].required_groups);
        } catch (e) {
          requiredGroups = [];
        }
      }
      
      if (requiredGroups.length === 0) {
        return context.reply(`📋 Список обязательных подписок пуст.

Используйте /groups для добавления сообществ.`);
      }
      
      // Получаем информацию о группах батчем
      let message = '📋 Обязательные подписки:\n\n';
      
      try {
        // VK API позволяет получить информацию о нескольких группах за раз
        const groupIds = requiredGroups.join(',');
        const groupsInfo = await global.vk.api.groups.getById({ group_ids: groupIds });
        
        // VK API возвращает объект с полем groups
        const groups = groupsInfo.groups || groupsInfo;
        
        for (let i = 0; i < groups.length; i++) {
          const group = groups[i];
          message += `${i + 1}. [club${group.id}|${group.name}]\n`;
          message += `🆔 ID: ${group.id}\n\n`;
        }
      } catch (error) {
        console.error('Ошибка получения информации о группах:', error);
        // Fallback: показываем просто ID
        for (let i = 0; i < requiredGroups.length; i++) {
          message += `${i + 1}. Группа ${requiredGroups[i]}\n`;
          message += `🆔 ID: ${requiredGroups[i]}\n\n`;
        }
      }
      
      message += `💬 Всего: ${requiredGroups.length}\n`;
      message += `\nДля удаления: /ungroups [ID]`;
      
      return context.reply(message);
      
    } catch (error) {
      console.error('Ошибка при получении списка групп:', error);
      return context.reply('❌ Произошла ошибка при получении списка сообществ');
    }
  }
};
