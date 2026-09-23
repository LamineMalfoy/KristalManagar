const database = require('../databases.js');
const { checkSysAccess, getAccessLevelName } = require('./sysadmin.js');
const { hasCommandAccess, getAccessDeniedMessage } = require('../utils/commandAccess.js');
const { getUserRole, getRoleName, checkIfTableExists, getAllCustomRoles } = require('./roles.js');
const util = require('util');
const { extractNumericId } = require('./ban.js');
const { getlink } = require('../util.js');
const cacheManager = require('../cacheManager.js');
const databaseQuery = util.promisify(database.query.bind(database));

module.exports = {
  command: '/sysrole',
  description: 'Системная команда для выдачи ролей в беседах',
  async execute(context) {
    try {
      // Проверяем доступ к команде
      const hasAccess = await hasCommandAccess(context.senderId, 'sysrole');
      if (!hasAccess) {
        return context.reply(getAccessDeniedMessage('sysrole'));
      }
      
      const senderSysAccess = await checkSysAccess(context.senderId);

      // Парсим аргументы команды
      const args = context.text.split(' ');
      
      // Стандартные роли всегда доступны
      const standardRoles = [
        { role_id: 0, role_name: 'Участник' },
        { role_id: 20, role_name: 'Модератор' },
        { role_id: 40, role_name: 'Администратор' },
        { role_id: 60, role_name: 'Спец. Администратор' },
        { role_id: 80, role_name: 'Руководитель' },
        { role_id: 100, role_name: 'Владелец' }
      ];

      // Если нет аргументов, показываем справку
      if (args.length < 3) {
        return context.reply(`❓ Аргументы введены неверно. Необходимо указать пользователя и роль.
      
❓ Примеры использования:
/sysrole @user модератор
/sysrole @user 60
/sysrole @id123456 администратор`);
      }

      // Получаем ID пользователя
      let userId = await extractNumericId(args[1]);
      if (!userId) {
        return context.reply(`❓ Аргументы введены неверно. Необходимо указать пользователя и роль.
      
❓ Примеры использования:
/sysrole @user модератор
/sysrole @user 60
/sysrole @id123456 администратор`);
      }
      userId = parseInt(userId);

      // Получаем роль (по приоритету или названию)
      const roleIdentifier = args.slice(2).join(' ').toLowerCase();
      
      // Проверяем, существует ли таблица ролей для этой беседы
      const tableExists = await checkIfTableExists(`roles_${context.peerId}`);
      
      // Получаем кастомные роли если таблица существует
      let customRoles = [];
      if (tableExists) {
        customRoles = await getAllCustomRoles(context.peerId);
      }
      
      let targetRole = null;
      let isCustomRole = false;

      // Сначала пробуем найти по названию в кастомных ролях
      if (customRoles.length > 0) {
        targetRole = customRoles.find(role => role.role_name.toLowerCase() === roleIdentifier);
        if (targetRole) {
          isCustomRole = true;
        }
      }

      // Если не нашли в кастомных, ищем в стандартных ролях по названию
      if (!targetRole) {
        targetRole = standardRoles.find(role => role.role_name.toLowerCase() === roleIdentifier);
      }

      // Если не нашли по названию, пробуем по приоритету
      if (!targetRole) {
        const roleId = parseInt(roleIdentifier);
        if (!isNaN(roleId)) {
          // Сначала ищем в кастомных ролях по приоритету
          if (customRoles.length > 0) {
            targetRole = customRoles.find(role => role.role_id === roleId);
            if (targetRole) {
              isCustomRole = true;
            }
          }
          
          // Если не нашли в кастомных, проверяем стандартные приоритеты
          if (!targetRole) {
            // Если приоритет нестандартный но в рамках 0-100, создаем кастомную роль
            if (roleId >= 0 && roleId <= 100) {
              // Проверяем есть ли стандартная роль с таким приоритетом
              const standardRole = standardRoles.find(role => role.role_id === roleId);
              if (standardRole) {
                targetRole = standardRole;
              } else {
                // Создаем кастомную роль с этим приоритетом
                targetRole = {
                  role_id: roleId,
                  role_name: `Кастомная роль (${roleId})`
                };
                isCustomRole = true;
              }
            }
          }
        }
      }

      if (!targetRole) {
        return context.reply(`❓ Неверная роль "${roleIdentifier}". Укажите корректную роль или приоритет.\n      \n❓ Примеры использования:\n/sysrole @user модератор\n/sysrole @user 60\n/sysrole @id123456 администратор`);
      }

      // Проверяем, что агент поддержки может выдать эту роль (до 100 включительно)
      if (targetRole.role_id > 100) {
        return context.reply(`❌ Недостаточно прав для выдачи роли с приоритетом выше 100`);
      }

      // Если таблица не существует, создаем её
      if (!tableExists) {
        const createTableQuery = `
          CREATE TABLE IF NOT EXISTS roles_${context.peerId} (
            user_id BIGINT PRIMARY KEY,
            role_id INT DEFAULT 0
          )
        `;
        await databaseQuery(createTableQuery);
      }

      // Получаем текущую роль пользователя
      const currentUserRole = await getUserRole(context.peerId, userId);
      const currentRoleName = await getRoleName(context.peerId, currentUserRole);

      // Выдаем роль
      const rolesTable = `roles_${context.peerId}`;
      const query = `INSERT INTO ${rolesTable} (user_id, role_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE role_id = VALUES(role_id)`;

      await databaseQuery(query, [userId, targetRole.role_id]);
      
      // Очищаем кэш роли пользователя, чтобы новая роль сразу была видна
      const cacheKey = cacheManager.generateKey(context.peerId, userId);
      cacheManager.invalidate('userRoles', cacheKey);

      // Если это кастомная роль, добавляем её в таблицу кастомных ролей
      if (isCustomRole && targetRole.role_name.startsWith('Кастомная роль')) {
        // Проверяем существование таблицы кастомных ролей
        const customRolesTable = `custom_roles_${context.peerId}`;
        const createCustomRolesTableQuery = `
          CREATE TABLE IF NOT EXISTS ${customRolesTable} (
            role_id INT PRIMARY KEY,
            role_name VARCHAR(255)
          )
        `;
        await databaseQuery(createCustomRolesTableQuery);
        
        // Добавляем кастомную роль
        const insertCustomRoleQuery = `
          INSERT INTO ${customRolesTable} (role_id, role_name) 
          VALUES (?, ?) 
          ON DUPLICATE KEY UPDATE role_name = VALUES(role_name)
        `;
        await databaseQuery(insertCustomRoleQuery, [targetRole.role_id, targetRole.role_name]);
      }

      // Получаем ссылки на пользователей
      const userLink = await getlink(userId);
      const adminLink = await getlink(context.senderId);
      const sysAccessName = getAccessLevelName(senderSysAccess);

      // Формируем сообщение об успешной выдаче роли
      let successMessage = `✅ ${userLink}, вы успешно установили себе роль «${targetRole.role_name}» и приоритет ${targetRole.role_id}`;
      
      // Если это системная выдача другому пользователю
      if (userId !== context.senderId) {
        successMessage = `✅ ${adminLink}, вы успешно установили роль пользователю ${userLink} «${targetRole.role_name}» и приоритет ${targetRole.role_id}`;
      }

      context.send({ message: successMessage, disable_mentions: true });

      // Логируем действие
      console.log(`[SYSROLE] Администратор ${context.senderId} (${sysAccessName}) выдал роль ${targetRole.role_name} пользователю ${userId} в беседе ${context.peerId}`);

    } catch (error) {
      console.error('Ошибка при выполнении команды sysrole:', error);
      context.reply('❌ Произошла ошибка при выполнении команды');
    }
  },
};