const database = require('../databases.js');
const cacheManager = require('../cache_manager.js');

async function checkUserRole(conferenceId, userId) {
  return new Promise((resolve, reject) => {
    const rolesTableName = `roles_${conferenceId}`;
    const getUserRoleQuery = `
      SELECT role_id
      FROM ${rolesTableName}
      WHERE user_id = ?
    `;
    
    database.query(getUserRoleQuery, [userId], (error, results) => {
      if (error) {
        console.error('Ошибка при получении роли пользователя:', error);
        reject(error);
        return;
      }
      
      if (results && results[0] && results[0].role_id) {
        resolve(results[0].role_id);
      } else {
        resolve(0); // Участник по умолчанию
      }
    });
  });
}

async function getUserRole(conferenceId, userId) {
  // ОТКЛЮЧЕНО КЭШИРОВАНИЕ РОЛЕЙ - всегда читаем из БД напрямую для актуальности
  const role = await checkUserRole(conferenceId, userId);
  return role;
}

async function checkIfTableExists(tableName) {
  // 🚀 Проверяем кэш сначала
  const cachedExists = cacheManager.getTableExists(tableName);
  if (cachedExists !== null) {
    return cachedExists;
  }
  
  const query = `SHOW TABLES LIKE '${tableName}'`;
  return new Promise((resolve) => {
    database.query(query, (error, results) => {
      if (error) {
        console.error('Ошибка при проверке существования таблицы:', error);
        resolve(false);
      } else {
        const exists = results.length > 0;
        // 🚀 Сохраняем в кэш
        cacheManager.setTableExists(tableName, exists);
        resolve(exists);
      }
    });
  });
}

async function initCustomRolesTable(conferenceId) {
  const customRolesTableName = `custom_roles_${conferenceId}`;
  const tableExists = await checkIfTableExists(customRolesTableName);

  if (!tableExists) {
    // Вместо создания таблицы, которая вызывает проблемы, просто выходим.
    // Функция getAllCustomRoles вернет пустой массив, что корректно.
    return false; // Указываем, что таблица не была готова
  }
  return true; // Таблица существует
}

async function getRoleName(peerId, roleId, options = {}) {
  // Если roleId null, возвращаем "Участник"
  if (roleId === null || roleId === undefined) {
    return 'Участник';
  }

  // Стандартные роли (неизменяемые)
  const standardRoles = {
    0: 'Участник',
    20: 'Модератор',
    40: 'Администратор',
    60: 'Спец. Администратор',
    80: 'Руководитель',
    100: 'Владелец'
  };

  if (options.forceStandard) {
    if (standardRoles[roleId]) {
      return standardRoles[roleId];
    } else {
      return `Неизвестная роль (${roleId})`;
    }
  }

  // Сначала проверяем кастомные роли (включая приоритет 100)
  const customRoles = await getAllCustomRoles(peerId);
  const customRole = customRoles.find(role => role.role_id === roleId);
  if (customRole) {
    return customRole.role_name;
  }

  // Если не найдено переименование — используем стандартное название
  if (standardRoles[roleId]) {
    return standardRoles[roleId];
  }

  // Если ничего не найдено
  return `Неизвестная роль (${roleId})`;
}

async function getAllCustomRoles(conferenceId) {
  const fs = require('fs');
  const path = require('path');
  
  // Путь к файлу с кастомными ролями
  const customRolesDir = path.join(__dirname, '../data/custom_roles_' + conferenceId);
  const customRolesFile = path.join(customRolesDir, 'roles.json');
  
  // Проверяем, существует ли файл с кастомными ролями
  if (!fs.existsSync(customRolesFile)) {
    return [];
  }
  
  try {
    const customRolesData = JSON.parse(fs.readFileSync(customRolesFile, 'utf8'));
    
    // Преобразуем данные в нужный формат
    const customRoles = customRolesData.map(role => ({
      role_id: role.priority,
      role_name: role.name
    }));
    
    return customRoles;
  } catch (error) {
    console.error('Ошибка при чтении кастомных ролей из файла:', error);
    return [];
  }
}

async function getUserName(conferenceId, userId) {
  // 🚀 Проверяем кэш сначала
  const cachedNickname = cacheManager.getUserNickname(conferenceId, userId);
  if (cachedNickname !== null) {
    return cachedNickname;
  }
  
  const nicknamesTableName = `nicknames_${conferenceId}`;
  const query = `SELECT nickname FROM ${nicknamesTableName} WHERE user_id = ?`;

  return new Promise((resolve) => {
    database.query(query, [userId], (error, results) => {
      if (error || results.length === 0) {
        // 🚀 Кэшируем даже null значения чтобы избежать повторных запросов
        cacheManager.setUserNickname(conferenceId, userId, null);
        resolve(null); // Возвращаем null, если ник не найден или произошла ошибка
      } else {
        const nickname = results[0].nickname;
        // 🚀 Сохраняем в кэш
        cacheManager.setUserNickname(conferenceId, userId, nickname);
        resolve(nickname);
      }
    });
  });
}

async function getUserVipStatus(userId) {
  // 🚀 Проверяем кэш сначала
  const cachedStatus = cacheManager.getVipStatus(userId);
  if (cachedStatus !== null) {
    return cachedStatus;
  }
  
  const query = 'SELECT status FROM vips WHERE user_id = ?';
  
  return new Promise((resolve) => {
    database.query(query, [userId], (error, results) => {
      if (error || results.length === 0) {
        // 🚀 Кэшируем null чтобы избежать повторных запросов
        cacheManager.setVipStatus(userId, null);
        resolve(null);
      } else {
        const status = results[0].status === 'VIP' ? 'VIP' : null;
        // 🚀 Сохраняем в кэш
        cacheManager.setVipStatus(userId, status);
        resolve(status);
      }
    });
  });
}

async function addCustomRole(peerId, priority, roleName) {
  const fs = require('fs');
  const path = require('path');
  
  // Кастомные роли создаются для любого приоритета (включая 100)
  
  // Путь к файлу с кастомными ролями
  const customRolesDir = path.join(__dirname, '../data/custom_roles_' + peerId);
  const customRolesFile = path.join(customRolesDir, 'roles.json');
  
  try {
    // Создаем директорию, если её нет
    if (!fs.existsSync(customRolesDir)) {
      fs.mkdirSync(customRolesDir, { recursive: true });
    }
    
    // Читаем существующие роли или создаем новый массив
    let customRoles = [];
    if (fs.existsSync(customRolesFile)) {
      const fileContent = fs.readFileSync(customRolesFile, 'utf8');
      customRoles = JSON.parse(fileContent);
    }
    
    // Проверяем, существует ли уже роль с таким приоритетом
    const existingRoleIndex = customRoles.findIndex(role => role.priority === priority);
    
    if (existingRoleIndex !== -1) {
      // Обновляем существующую роль
      customRoles[existingRoleIndex].name = roleName;
    } else {
      // Добавляем новую роль
      customRoles.push({
        priority: priority,
        name: roleName
      });
    }
    
    // Сохраняем обновленные роли
    fs.writeFileSync(customRolesFile, JSON.stringify(customRoles, null, 2));
    
    return { success: true };
  } catch (error) {
    console.error('Ошибка при добавлении/обновлении кастомной роли:', error);
    return { success: false, message: 'Произошла ошибка при работе с файловой системой.' };
  }
}

async function setStandardRoleName(peerId, priority, roleName) {
  const fs = require('fs');
  const path = require('path');
  
  // Путь к файлу с переименованными стандартными ролями
  const standardRolesDir = path.join(__dirname, '../data/standard_roles_' + peerId);
  const standardRolesFile = path.join(standardRolesDir, 'renamed.json');
  
  try {
    // Создаем директорию, если её нет
    if (!fs.existsSync(standardRolesDir)) {
      fs.mkdirSync(standardRolesDir, { recursive: true });
    }
    
    // Читаем существующие переименования или создаем новый объект
    let renamedRoles = {};
    if (fs.existsSync(standardRolesFile)) {
      const fileContent = fs.readFileSync(standardRolesFile, 'utf8');
      renamedRoles = JSON.parse(fileContent);
    }
    
    // Устанавливаем новое название
    renamedRoles[priority] = roleName;
    
    // Сохраняем обновленные переименования
    fs.writeFileSync(standardRolesFile, JSON.stringify(renamedRoles, null, 2));
    
    return { success: true };
  } catch (error) {
    console.error('Ошибка при переименовании стандартной роли:', error);
    return { success: false, message: 'Произошла ошибка при работе с файловой системой.' };
  }
}

async function getStandardRoleName(peerId, priority) {
  const fs = require('fs');
  const path = require('path');
  
  const standardRolesFile = path.join(__dirname, '../data/standard_roles_' + peerId, 'renamed.json');
  
  if (!fs.existsSync(standardRolesFile)) {
    return null;
  }
  
  try {
    const fileContent = fs.readFileSync(standardRolesFile, 'utf8');
    const renamedRoles = JSON.parse(fileContent);
    return renamedRoles[priority] || null;
  } catch (error) {
    console.error('Ошибка при чтении переименованных стандартных ролей:', error);
    return null;
  }
}

async function getUsersWithRole(peerId, roleId) {
  const rolesTable = `roles_${peerId}`;
  const countQuery = `
    SELECT COUNT(*) as count
    FROM ${rolesTable}
    WHERE role_id = ?
  `;

  return new Promise((resolve) => {
    database.query(countQuery, [roleId], (error, results) => {
      if (error) {
        console.error('Ошибка при подсчете пользователей с ролью:', error);
        resolve(0);
      } else {
        resolve(results[0] ? results[0].count : 0);
      }
    });
  });
}

async function deleteCustomRole(peerId, roleIdentifier) {
  const customRolesTable = `custom_roles_${peerId}`;
  const rolesTable = `roles_${peerId}`;
  
  // Проверяем, что таблица существует
  const tableExists = await initCustomRolesTable(peerId);
  if (!tableExists) {
    return { success: false, message: 'Таблица кастомных ролей не существует.' };
  }

  // Получаем все кастомные роли
  const customRoles = await getAllCustomRoles(peerId);
  
  let roleToDelete = null;
  
  // Ищем роль по ID или названию
  if (!isNaN(roleIdentifier)) {
    // Если передан ID
    roleToDelete = customRoles.find(role => role.role_id === parseInt(roleIdentifier));
  } else {
    // Если передано название
    roleToDelete = customRoles.find(role => 
      role.role_name.toLowerCase() === roleIdentifier.toLowerCase()
    );
  }

  if (!roleToDelete) {
    return { success: false, message: 'Роль не найдена.' };
  }

  // Разрешаем удалять кастомную роль с любым id, если она есть в кастомных
  // Запрещаем только если кастомной роли с этим id нет (то есть это реально стандартная роль)

  // Получаем количество пользователей с этой ролью
  const usersCount = await getUsersWithRole(peerId, roleToDelete.role_id);

  // Сброс роли у всех пользователей в SQL-таблице
  let sqlAffectedRows = 0;
  try {
    const updateQuery = `UPDATE ${rolesTable} SET role_id = 0 WHERE role_id = ?`;
    const updateResult = await new Promise((resolve, reject) => {
      database.query(updateQuery, [roleToDelete.role_id], (err, result) => {
        if (err) return reject(err);
        resolve(result);
      });
    });
    sqlAffectedRows = updateResult.affectedRows || 0;
  } catch (e) {
    console.error('Ошибка при сбросе роли в SQL:', e);
  }

  // Сначала удаляем роль у всех пользователей напрямую через файлы
  const fs = require('fs');
  const path = require('path');
  const rolesDir = path.join(__dirname, '../data', rolesTable);
  
  let affectedRows = 0;
  if (fs.existsSync(rolesDir)) {
    const files = fs.readdirSync(rolesDir).filter(f => f.endsWith('.json'));
    for (const file of files) {
      const filePath = path.join(rolesDir, file);
      try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        if (Number(data.role_id) === roleToDelete.role_id) {
          data.role_id = 0;
          fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
          affectedRows++;
        }
      } catch (e) {
        console.error('Ошибка при обработке файла роли:', filePath, e);
      }
    }
  }
  
  // Удаляем роль из файла кастомных ролей (если есть)
  try {
    const customRolesFile = path.join(__dirname, '../data', `custom_roles_${peerId}`, 'roles.json');
    if (fs.existsSync(customRolesFile)) {
      const fileData = JSON.parse(fs.readFileSync(customRolesFile, 'utf8'));
      const beforeCount = fileData.length;
      let afterData;
      if (!isNaN(roleIdentifier)) {
        afterData = fileData.filter(role => Number(role.priority) !== Number(roleToDelete.role_id));
      } else {
        afterData = fileData.filter(role => (role.name || '').toLowerCase() !== roleToDelete.role_name.toLowerCase());
      }
      if (afterData.length !== beforeCount) {
        fs.writeFileSync(customRolesFile, JSON.stringify(afterData, null, 2));
        console.log(`Роль удалена из файла кастомных ролей custom_roles_${peerId}/roles.json`);
      }
    }
  } catch (e) {
    console.error('Ошибка при удалении роли из файла кастомных ролей:', e);
  }

  const totalAffected = affectedRows + sqlAffectedRows;
  console.log(`Успешно обновлено ${totalAffected} пользователей (SQL: ${sqlAffectedRows}, файлы: ${affectedRows})`);

  // Затем удаляем саму роль
  const deleteQuery = `
    DELETE FROM ${customRolesTable}
    WHERE role_id = ?
  `;

  return new Promise((resolve) => {
    console.log(`Удаление кастомной роли: ${deleteQuery} с параметром ${roleToDelete.role_id}`);
    database.query(deleteQuery, [roleToDelete.role_id], (deleteError, deleteResult) => {
      console.log(`Результат удаления:`, deleteError, deleteResult);
      if (deleteError) {
        console.error(`Ошибка при удалении роли:`, deleteError);
        resolve({ success: false, message: 'Произошла ошибка при удалении роли.' });
      } else {
        let message = `Роль "${roleToDelete.role_name}" успешно удалена.`;
        if (affectedRows > 0) {
          message += ` ${affectedRows} пользователей получили статус "Участник".`;
        }
        resolve({ success: true, message: message });
      }
    });
  });
}

async function cleanupInvalidRoles(peerId) {
  const rolesTable = `roles_${peerId}`;
  const customRoles = await getAllCustomRoles(peerId);
  
  // Стандартные роли
  const standardRoleIds = [0, 10, 20, 30, 40, 50, 60, 80, 100];
  
  // Получаем все валидные роли (стандартные + кастомные)
  const validRoleIds = [...standardRoleIds, ...customRoles.map(role => role.role_id)];

  // Путь к директории с ролями
  const fs = require('fs');
  const path = require('path');
  const rolesDir = path.join(__dirname, '../data', rolesTable);

  let affectedRows = 0;
  if (fs.existsSync(rolesDir)) {
    const files = fs.readdirSync(rolesDir).filter(f => f.endsWith('.json'));
    for (const file of files) {
      const filePath = path.join(rolesDir, file);
      try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        if (!validRoleIds.includes(Number(data.role_id))) {
          data.role_id = 0;
          fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
          affectedRows++;
        }
      } catch (e) {
        console.error('Ошибка при обработке файла роли:', filePath, e);
      }
    }
  }
  if (affectedRows > 0) {
    return { success: true, message: `Очищено ${affectedRows} невалидных ролей. Пользователи получили статус "Участник".` };
  } else {
    return { success: true, message: 'Невалидных ролей не найдено.' };
  }
}

async function getRoleNamezov(roleId) {
  // Стандартные роли для команды zov
  const standardRoles = {
    0: 'Участник',
    20: 'Модератор',
    40: 'Администратор',
    60: 'Спец. Администратор',
    80: 'Руководитель',
    100: 'Владелец'
  };

  return standardRoles[roleId] || `Неизвестная роль (${roleId})`;
}

module.exports = {
  checkUserRole,
  checkIfTableExists,
  getUserRole,
  initCustomRolesTable,
  getRoleName,
  getAllCustomRoles,
  getUserName,
  getUserVipStatus,
  addCustomRole,
  setStandardRoleName,
  getStandardRoleName,
  deleteCustomRole,
  getUsersWithRole,
  cleanupInvalidRoles,
  getRoleNamezov
};
