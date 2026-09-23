const database = require('../databases.js');
const { checkIfTableExists, getUserRole, getRoleName, getAllCustomRoles } = require('./roles.js');
const { vk } = require('../index.js');
const { getlink } = require('../util.js');
const { Keyboard } = require('vk-io');
const cacheManager = require('../cacheManager.js');

module.exports = {
  command: '/staff',
  aliases: ['/staff', '/стафф'],
  description: 'Показать список администраторов и владельцев',
  async execute(context) {
    const startTime = Date.now();
    const { peerId } = context;
    const conferenceId = peerId;

    if (!await checkIfTableExists(`roles_${conferenceId}`)) {
      return context.send('⚠️ Беседа не активирована | Для активации используйте команду /start');
    }
    
    const senderRoleId = await getUserRole(context.peerId, context.senderId);
    
    // ОПТИМИЗАЦИЯ: Кэшированное получение кастомных ролей
    const cacheKey = `custom_roles_${conferenceId}`;
    let customRoles = cacheManager.get('customRoles', cacheKey);
    
    if (!customRoles) {
      customRoles = await getAllCustomRoles(conferenceId);
      cacheManager.set('customRoles', cacheKey, customRoles, 5 * 60 * 1000); // TTL 5 минут
    }
    
    // Создаем карту ролей (без эмодзи)
    const rolesMap = {};
    
    // Добавляем стандартные роли (соответствуют roles.js) — без эмодзи
    const standardRoles = {
      20: 'Модератор',
      40: 'Администратор',
      60: 'Спец. Администратор',
      80: 'Руководитель',
      100: 'Владелец'
    };
    
    // Сначала добавляем стандартные роли
    Object.keys(standardRoles).forEach(roleId => {
      rolesMap[roleId] = standardRoles[roleId];
    });
    
    // Стандартные роли остаются как есть
    
    // Затем добавляем кастомные роли (они перезапишут стандартные если есть)
    for (const role of customRoles) {
      // Без иконок
      rolesMap[role.role_id] = `${role.role_name}`;
    }
    
    // Добавляем обработку для всех остальных ролей >= 1, которые не попали в стандартные или кастомные
    // Это нужно для случаев, когда роль есть у пользователя, но её нет в списках
    
    const getStaffQuery = `
      SELECT user_id, MAX(role_id) as role_id
      FROM roles_${conferenceId}
      WHERE role_id > 0 AND role_id != 0
      GROUP BY user_id
      ORDER BY role_id DESC
    `;

    database.query(getStaffQuery, async (error, results) => {
      console.log('Запрос staff:', getStaffQuery);
      console.log('Результаты запроса:', results);
      
      if (error) {
        console.error('Ошибка при запросе администраторов и владельцев:', error);
        return context.send('❌ Ошибка системы | Не удалось получить список администрации');
      }

      if (results.length === 0) {
        return context.send('⚠️ В беседе нет администраторов | Используйте команды назначения ролей');
      }

      // ОПТИМИЗАЦИЯ: Быстрое разделение пользователей и сообществ
      const userIds = [];
      const groupIds = [];
      
      for (const row of results) {
        if (row.user_id > 0) {
          userIds.push(row.user_id);
        } else if (row.user_id < 0) {
          groupIds.push(Math.abs(row.user_id));
        }
      }
      
      // ОПТИМИЗАЦИЯ: Параллельные запросы с обработкой ошибок
      const [userInfos, groupInfos] = await Promise.allSettled([
        userIds.length > 0 ? vk.api.users.get({ user_ids: userIds }).catch(() => []) : Promise.resolve([]),
        groupIds.length > 0 ? vk.api.groups.getById({ group_ids: groupIds, fields: 'name' }).catch(() => ({ groups: [] })) : Promise.resolve({ groups: [] })
      ]);
      
      const users = userInfos.status === 'fulfilled' ? userInfos.value : [];
      const groups = groupInfos.status === 'fulfilled' ? (groupInfos.value.groups || []) : [];
      
      // ОПТИМИЗАЦИЯ: Создаём оптимизированную карту для быстрого поиска
      const entityMap = new Map();
      
      // Добавляем пользователей
      if (Array.isArray(users)) {
        for (const user of users) {
          entityMap.set(user.id, user);
        }
      }
      
      // Добавляем группы
      if (Array.isArray(groups)) {
        for (const group of groups) {
          entityMap.set(-group.id, { ...group, isGroup: true });
        }
      }

      const staffByRole = {};

      // ОПТИМИЗАЦИЯ: Быстрая обработка всех пользователей
      for (const row of results) {
        const { user_id, role_id } = row;
        
        // Быстрая проверка валидности роли
        if (!role_id || role_id === 0) continue;
        
        let roleName = rolesMap[role_id];
        if (!roleName) {
          roleName = `Роль ${role_id}`;
        }
        
        // Инициализация массива роли
        if (!staffByRole[roleName]) {
          staffByRole[roleName] = [];
        }

        // ОПТИМИЗАЦИЯ: Прямое использование карты сущностей
        const entityInfo = entityMap.get(user_id);
        
        if (entityInfo) {
          if (entityInfo.isGroup) {
            // Сообщество
            staffByRole[roleName].push(`— [club${entityInfo.id}|${entityInfo.name}]`);
          } else {
            // Пользователь (независимо от статуса)
            staffByRole[roleName].push(`— [id${user_id}|${entityInfo.first_name} ${entityInfo.last_name}]`);
          }
        } else {
          // Fallback для недоступных пользователей/сообществ
          const fallbackLink = user_id < 0 ? `[club${Math.abs(user_id)}|Сообщество]` : `[https://vk.com/id${user_id}|Пользователь] (НЕДОСТУПЕН)`;
          staffByRole[roleName].push(`— ${fallbackLink}`);
        }
      }

      const endTime = Date.now();
      const executionTime = endTime - startTime;
      const executionTimeInSeconds = executionTime / 1000;

      let staffMessage = ``;
       
      // Создаём массив ролей с их приоритетами для правильной сортировки
      const rolesWithPriorities = Object.keys(staffByRole).map(roleName => {
        const priority = Object.keys(rolesMap).find(key => rolesMap[key] === roleName);
        return { roleName, priority: Number(priority) || 0 };
      });
      
      console.log('Роли с приоритетами:', rolesWithPriorities);
      
      // Сортируем по приоритету (от высшего к низшему)
      const sortedRoles = rolesWithPriorities
        .sort((a, b) => b.priority - a.priority)
        .map(item => item.roleName);
      
      console.log('Отсортированные роли:', sortedRoles);
      
      for (const roleName of sortedRoles) {
        staffMessage += `${roleName}:\n${staffByRole[roleName].join('\n')}\n\n`;
      }

      // Создаем кнопку "Никнеймы"
      const keyboard = Keyboard.builder()
        .callbackButton({
          label: "Никнеймы",
          payload: {
            command: "show_nicknames",
            event_id: 8888
          },
          color: Keyboard.POSITIVE_COLOR // Зеленый цвет
        })
        .inline();

      if (staffMessage) {
        context.send({ 
          message: staffMessage, 
          disable_mentions: true,
          keyboard: keyboard
        });
      } else {
        context.send('⚠️ В беседе нет администраторов | Используйте команды назначения ролей');
      }
    });
  },
};
