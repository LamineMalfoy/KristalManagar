const database = require('../databases.js');
const { getUserRole, getRoleName, checkIfTableExists } = require('./roles.js');
const { checkCommandPriority } = require('./editcmd.js');
const util = require('util');
const queryAsync = util.promisify(database.query).bind(database);

module.exports = {
  command: '/groups',
  aliases: ['/группы'],
  description: 'Добавить сообщество в обязательные подписки',
  
  async execute(context) {
    const { peerId, senderId, text } = context;
    
    // Проверяем существование таблицы
    if (!(await checkIfTableExists(`conference_${peerId}`))) {
      return context.send('⚠️ Беседа не активирована | Для активации используйте команду /start');
    }
    
    // Проверяем права доступа
    const hasPermission = await checkCommandPriority(peerId, senderId, '/groups');
    if (!hasPermission) {
      const { getCommandPriorities } = require('./editcmd.js');
      const priorities = await getCommandPriorities(peerId);
      const requiredRole = priorities['/groups'] || 100;
      const senderRole = await getUserRole(peerId, senderId);
      const senderRoleName = await getRoleName(peerId, senderRole);
      return context.reply(`⛔ Доступ запрещён | Для использования команды /groups требуется приоритет ${requiredRole} или выше\n👤 Ваша роль: ${senderRoleName} (приоритет ${senderRole})`);
    }
    
    const args = text.split(' ').slice(1);
    
    if (args.length === 0) {
      return context.reply(`❓ Аргументы введены неверно. Необходимо указать сообщество.

❓ Примеры использования:
/groups club123456
/groups https://vk.com/mygroup
/groups 123456`);
    }
    
    // Парсим ID сообщества
    let groupId = await parseGroupId(args[0]);
    
    if (!groupId) {
      return context.reply(`❓ Аргументы введены неверно. Не удалось определить ID сообщества.

❓ Примеры использования:
/groups club123456
/groups https://vk.com/mygroup
/groups 123456`);
    }
    
    // Проверяем существование группы через VK API
    try {
      const groupInfo = await global.vk.api.groups.getById({ group_id: groupId });
      
      // VK API возвращает объект с полем groups
      const groups = groupInfo.groups || groupInfo;
      
      if (!groups || groups.length === 0) {
        return context.reply('❌ Сообщество не найдено');
      }
      
      const groupName = groups[0].name;
      
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
      
      // Проверяем, не добавлена ли уже эта группа
      if (requiredGroups.includes(groupId)) {
        return context.reply(`⚠️ Сообщество уже в списке | [club${groupId}|${groupName}] уже добавлено в обязательные подписки`);
      }
      
      // Добавляем группу
      requiredGroups.push(groupId);
      
      // Сохраняем в базу (обновляем файл конференции)
      const updateQuery = `
        INSERT INTO conference_${peerId} (conference_id, required_groups)
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE required_groups = VALUES(required_groups)
      `;
      
      await queryAsync(updateQuery, [peerId, JSON.stringify(requiredGroups)]);
      
      return context.reply(`✅ Сообщество добавлено в обязательные подписки.

[club${groupId}|${groupName}] теперь в списке обязательных подписок.
Пользователи без подписки не смогут писать в беседе.`);
      
    } catch (error) {
      console.error('Ошибка при добавлении группы:', error);
      return context.reply('❌ Произошла ошибка при добавлении сообщества');
    }
  }
};

// Функция для парсинга ID группы из разных форматов
async function parseGroupId(input) {
  if (!input) {
    console.log('[parseGroupId] Пустой input');
    return null;
  }
  
  console.log('[parseGroupId] Обработка input:', input);
  
  // Если это просто число
  if (/^\d+$/.test(input)) {
    console.log('[parseGroupId] Найдено число:', input);
    return parseInt(input);
  }
  
  // Если это отрицательное число (ID группы)
  if (/^-\d+$/.test(input)) {
    console.log('[parseGroupId] Найдено отрицательное число:', input);
    return Math.abs(parseInt(input));
  }
  
  // Если это club123456, public123456, group123456 (БЕЗ ссылки)
  const matchGroup = input.match(/^(?:club|public|group)(\d+)$/i);
  if (matchGroup && matchGroup[1]) {
    console.log('[parseGroupId] Найдено club/public/group + число:', matchGroup[1]);
    return parseInt(matchGroup[1]);
  }
  
  // Если это ссылка vk.com/club123456 или vk.com/group_name
  const vkLinkPattern = /(?:https?:\/\/)?(?:vk\.com|m\.vk\.com)\/(club|public|group)?(\d+|[a-zA-Z0-9_.]+)/;
  const vkMatches = input.match(vkLinkPattern);
  
  if (vkMatches) {
    console.log('[parseGroupId] Найдено совпадение ссылки VK:', vkMatches);
    const identifier = vkMatches[2];
    console.log('[parseGroupId] Извлечен identifier:', identifier);
    
    // Если это число, возвращаем его
    if (/^\d+$/.test(identifier)) {
      console.log('[parseGroupId] Identifier - число:', identifier);
      return parseInt(identifier);
    }
    
    // Если это короткое имя группы, пытаемся разрешить через VK API
    console.log('[parseGroupId] Попытка получить ID через API для:', identifier);
    try {
      const groupInfo = await global.vk.api.groups.getById({ group_id: identifier });
      console.log('[parseGroupId] Результат API:', groupInfo);
      // VK API возвращает объект с полем groups
      if (groupInfo && groupInfo.groups && groupInfo.groups.length > 0 && groupInfo.groups[0].id) {
        console.log('[parseGroupId] Получен ID группы:', groupInfo.groups[0].id);
        return groupInfo.groups[0].id;
      }
      // Fallback для старого формата ответа
      if (groupInfo && groupInfo.length > 0 && groupInfo[0].id) {
        console.log('[parseGroupId] Получен ID группы (старый формат):', groupInfo[0].id);
        return groupInfo[0].id;
      }
    } catch (error) {
      console.error('[parseGroupId] Ошибка получения ID группы через API:', error.message);
    }
  }
  
  // Попытка получить ID из короткого имени группы через API VK (как fallback)
  console.log('[parseGroupId] Fallback: попытка получить через API напрямую');
  try {
    if (typeof input === 'string' && input.trim()) {
      const groupInfo = await global.vk.api.groups.getById({ group_id: input.trim() });
      console.log('[parseGroupId] Fallback результат:', groupInfo);
      // VK API возвращает объект с полем groups
      if (groupInfo && groupInfo.groups && groupInfo.groups.length > 0 && groupInfo.groups[0].id) {
        console.log('[parseGroupId] Fallback успешен, ID:', groupInfo.groups[0].id);
        return groupInfo.groups[0].id;
      }
      // Fallback для старого формата
      if (groupInfo && groupInfo.length > 0 && groupInfo[0].id) {
        console.log('[parseGroupId] Fallback успешен (старый формат), ID:', groupInfo[0].id);
        return groupInfo[0].id;
      }
    }
  } catch (error) {
    console.error('[parseGroupId] Ошибка fallback:', error.message);
  }
  
  console.log('[parseGroupId] Не удалось распознать ID группы');
  return null;
}
