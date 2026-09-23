const database = require('../databases.js');
const { getUserRole, getRoleName, checkIfTableExists } = require('./roles.js');
const { checkCommandPriority } = require('./editcmd.js');
const util = require('util');
const queryAsync = util.promisify(database.query).bind(database);

module.exports = {
  command: '/ungroups',
  aliases: ['/удалитьгруппы'],
  description: 'Удалить сообщество из обязательных подписок',
  
  async execute(context) {
    const { peerId, senderId, text } = context;
    
    // Проверяем существование таблицы
    if (!(await checkIfTableExists(`conference_${peerId}`))) {
      return context.send('⚠️ Беседа не активирована | Для активации используйте команду /start');
    }
    
    // Проверяем права доступа
    const hasPermission = await checkCommandPriority(peerId, senderId, '/ungroups');
    if (!hasPermission) {
      const { getCommandPriorities } = require('./editcmd.js');
      const priorities = await getCommandPriorities(peerId);
      const requiredRole = priorities['/ungroups'] || 100;
      const senderRole = await getUserRole(peerId, senderId);
      const senderRoleName = await getRoleName(peerId, senderRole);
      return context.reply(`⛔ Доступ запрещён | Для использования команды /ungroups требуется приоритет ${requiredRole} или выше\n👤 Ваша роль: ${senderRoleName} (приоритет ${senderRole})`);
    }
    
    const args = text.split(' ').slice(1);
    
    if (args.length === 0) {
      return context.reply(`❓ Аргументы введены неверно. Необходимо указать сообщество.

❓ Примеры использования:
/ungroups club123456
/ungroups https://vk.com/mygroup
/ungroups 123456`);
    }
    
    // Парсим ID сообщества
    let groupId = await parseGroupId(args[0]);
    
    if (!groupId) {
      return context.reply(`❓ Аргументы введены неверно. Не удалось определить ID сообщества.

❓ Примеры использования:
/ungroups club123456
/ungroups https://vk.com/mygroup
/ungroups 123456`);
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
      
      // Проверяем, есть ли эта группа в списке
      if (!requiredGroups.includes(groupId)) {
        return context.reply('⚠️ Сообщество не найдено | Это сообщество не находится в списке обязательных подписок');
      }
      
      // Получаем информацию о группе
      let groupName = `Группа ${groupId}`;
      try {
        const groupInfo = await global.vk.api.groups.getById({ group_id: groupId });
        // VK API возвращает объект с полем groups
        const groups = groupInfo.groups || groupInfo;
        if (groups && groups.length > 0) {
          groupName = groups[0].name;
        }
      } catch (e) {
        // Игнорируем ошибки получения названия
      }
      
      // Удаляем группу из списка
      requiredGroups = requiredGroups.filter(id => id !== groupId);
      
      // Сохраняем в базу (обновляем файл конференции)
      const updateQuery = `
        INSERT INTO conference_${peerId} (conference_id, required_groups)
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE required_groups = VALUES(required_groups)
      `;
      
      await queryAsync(updateQuery, [peerId, JSON.stringify(requiredGroups)]);
      
      return context.reply(`✅ Сообщество удалено из обязательных подписок.

[club${groupId}|${groupName}] удалено из списка.
Подписка больше не обязательна для пользователей.`);
      
    } catch (error) {
      console.error('Ошибка при удалении группы:', error);
      return context.reply('❌ Произошла ошибка при удалении сообщества');
    }
  }
};

// Функция для парсинга ID группы из разных форматов
async function parseGroupId(input) {
  if (!input) return null;
  
  // Если это просто число
  if (/^\d+$/.test(input)) {
    return parseInt(input);
  }
  
  // Если это отрицательное число (ID группы)
  if (/^-\d+$/.test(input)) {
    return Math.abs(parseInt(input));
  }
  
  // Если это club123456, public123456, group123456
  const matchGroup = input.match(/(?:club|public|group)(\d+)/i);
  if (matchGroup && matchGroup[1]) {
    return parseInt(matchGroup[1]);
  }
  
  // Если это ссылка vk.com/club123456 или vk.com/group_name
  const vkLinkPattern = /(?:https?:\/\/)?(?:vk\.com|m\.vk\.com)\/(club|public|group)?(\d+|[a-zA-Z0-9_.]+)/;
  const vkMatches = input.match(vkLinkPattern);
  
  if (vkMatches) {
    const identifier = vkMatches[2];
    
    // Если это число, возвращаем его
    if (/^\d+$/.test(identifier)) {
      return parseInt(identifier);
    }
    
    // Если это короткое имя группы, пытаемся разрешить через VK API
    try {
      const groupInfo = await global.vk.api.groups.getById({ group_id: identifier });
      // VK API возвращает объект с полем groups
      if (groupInfo && groupInfo.groups && groupInfo.groups.length > 0 && groupInfo.groups[0].id) {
        return groupInfo.groups[0].id;
      }
      // Fallback для старого формата
      if (groupInfo && groupInfo.length > 0 && groupInfo[0].id) {
        return groupInfo[0].id;
      }
    } catch (error) {
      console.error('Ошибка получения ID группы:', error.message);
    }
  }
  
  // Попытка получить ID из короткого имени группы через API VK (как fallback)
  try {
    if (typeof input === 'string' && input.trim()) {
      const groupInfo = await global.vk.api.groups.getById({ group_id: input.trim() });
      // VK API возвращает объект с полем groups
      if (groupInfo && groupInfo.groups && groupInfo.groups.length > 0 && groupInfo.groups[0].id) {
        return groupInfo.groups[0].id;
      }
      // Fallback для старого формата
      if (groupInfo && groupInfo.length > 0 && groupInfo[0].id) {
        return groupInfo[0].id;
      }
    }
  } catch (error) {
    // Игнорируем ошибки fallback API
  }
  
  return null;
}
