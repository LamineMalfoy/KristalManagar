const database = require('./databases.js');
const cacheManager = require('./cache_manager.js');


// ═══════════════════════════════════════════
// ПРОВЕРКА РОЛИ
// ═══════════════════════════════════════════

async function checkUserRole(conferenceId, userId) {
  return new Promise((resolve, reject) => {
    const table = `roles_${conferenceId}`;

    database.query(
      `SELECT role_id FROM ${table} WHERE user_id = ?`,
      [userId],
      (error, results) => {
        if (error) return reject(error);

        resolve(
          results && results[0]
            ? results[0].role_id
            : null
        );
      }
    );
  });
}


// ═══════════════════════════════════════════
// ПОЛУЧЕНИЕ VK ID ПО USERNAME
// ═══════════════════════════════════════════

async function getUserIdByUsername(username) {
  try {
    if (
      username === null ||
      username === undefined
    ) {
      return null;
    }

    let value = String(username).trim();

    // [id123|Имя]
    let match = value.match(
      /\[id(\d+)\|[^\]]*\]/
    );

    if (match) {
      return Number(match[1]);
    }

    // vk.com/id123
    match = value.match(
      /(?:https?:\/\/)?(?:m\.)?vk\.com\/id(\d+)/i
    );

    if (match) {
      return Number(match[1]);
    }

    // @username
    value = value.replace(/^@/, '');

    // Числовой ID
    if (/^\d+$/.test(value)) {
      return Number(value);
    }

    const users = await vk.api.users.get({
      user_ids: [value]
    });

    if (
      users &&
      users[0] &&
      users[0].id
    ) {
      return Number(users[0].id);
    }

    return null;

  } catch (error) {
    console.error(
      'getUserIdByUsername error:',
      error.message
    );

    return null;
  }
}

global.getUserIdByUsername = getUserIdByUsername;


// ═══════════════════════════════════════════
// ПОЛУЧЕНИЕ ПОЛЬЗОВАТЕЛЯ VK
// ═══════════════════════════════════════════

async function getVkUser(userId) {
  try {
    if (
      userId === null ||
      userId === undefined ||
      userId === ''
    ) {
      return null;
    }

    // Если передали объект пользователя
    if (typeof userId === 'object') {
      if (userId.id) {
        return userId;
      }

      if (userId.user_id) {
        userId = userId.user_id;
      } else {
        return null;
      }
    }

    let value = String(userId).trim();

    // [id123|Имя Фамилия]
    let match = value.match(
      /\[id(\d+)\|[^\]]*\]/
    );

    if (match) {
      value = match[1];
    }

    // vk.com/id123
    match = value.match(
      /(?:https?:\/\/)?(?:m\.)?vk\.com\/id(\d+)/i
    );

    if (match) {
      value = match[1];
    }

    // vk.com/username
    if (value.includes('vk.com/')) {
      const linkMatch = value.match(
        /(?:https?:\/\/)?(?:m\.)?vk\.com\/([^/?]+)/i
      );

      if (linkMatch) {
        value = linkMatch[1];
      }
    }

    // @username
    value = value.replace(/^@/, '');

    if (!value) {
      return null;
    }

    const users = await vk.api.users.get({
      user_ids: [value]
    });

    if (
      !users ||
      !users.length ||
      !users[0] ||
      !users[0].id
    ) {
      return null;
    }

    return users[0];

  } catch (error) {
    console.error(
      'getVkUser error:',
      error.message
    );

    return null;
  }
}

global.getVkUser = getVkUser;


// ═══════════════════════════════════════════
// ПОЛУЧЕНИЕ ИМЕНИ ПОЛЬЗОВАТЕЛЯ
// ═══════════════════════════════════════════

async function getUsername(userId) {
  try {
    const user = await getVkUser(userId);

    if (!user) {
      return 'Пользователь';
    }

    const firstName = user.first_name
      ? String(user.first_name).trim()
      : '';

    const lastName = user.last_name
      ? String(user.last_name).trim()
      : '';

    const name =
      `${firstName} ${lastName}`.trim();

    if (name) {
      return name;
    }

    if (user.id) {
      return `ID ${user.id}`;
    }

    return 'Пользователь';

  } catch (error) {
    console.error(
      'getUsername error:',
      error.message
    );

    return 'Пользователь';
  }
}

global.getUsername = getUsername;


// ═══════════════════════════════════════════
// ПОЛУЧЕНИЕ ID ИЗ ЛЮБОГО ФОРМАТА
// ═══════════════════════════════════════════

async function getUserIdFromInput(input) {
  try {
    if (
      input === null ||
      input === undefined ||
      input === ''
    ) {
      return null;
    }

    // Число
    if (typeof input === 'number') {
      return input;
    }

    // Объект VK
    if (
      typeof input === 'object' &&
      input.id
    ) {
      return Number(input.id);
    }

    let value = String(input).trim();

    // [id123|Имя]
    let match = value.match(
      /\[id(\d+)\|[^\]]*\]/
    );

    if (match) {
      return Number(match[1]);
    }

    // vk.com/id123
    match = value.match(
      /(?:https?:\/\/)?(?:m\.)?vk\.com\/id(\d+)/i
    );

    if (match) {
      return Number(match[1]);
    }

    // vk.com/username
    if (value.includes('vk.com/')) {
      const linkMatch = value.match(
        /(?:https?:\/\/)?(?:m\.)?vk\.com\/([^/?]+)/i
      );

      if (linkMatch) {
        value = linkMatch[1];
      }
    }

    // @username
    value = value.replace(/^@/, '');

    // Числовой ID
    if (/^\d+$/.test(value)) {
      return Number(value);
    }

    // Username VK
    const users = await vk.api.users.get({
      user_ids: [value]
    });

    if (
      users &&
      users[0] &&
      users[0].id
    ) {
      return Number(users[0].id);
    }

    return null;

  } catch (error) {
    console.error(
      'getUserIdFromInput error:',
      error.message
    );

    return null;
  }
}

global.getUserIdFromInput = getUserIdFromInput;


// ═══════════════════════════════════════════
// ИНФОРМАЦИЯ ОБ АГЕНТЕ
// ═══════════════════════════════════════════

async function getAgentInfo(agent) {
  return new Promise((resolve, reject) => {
    database.query(
      'SELECT * FROM tech WHERE user_id = ?',
      [agent],
      (error, results) => {
        if (error) return reject(error);

        resolve(
          results &&
          results[0] &&
          results[0].dostup
            ? results[0]
            : null
        );
      }
    );
  });
}


// ═══════════════════════════════════════════
// GETLINK
// ═══════════════════════════════════════════

async function getlink(userId) {
  try {
    if (
      userId === null ||
      userId === undefined ||
      userId === ''
    ) {
      return '[id0|Пользователь]';
    }

    // Если объект VK
    if (
      typeof userId === 'object' &&
      userId.id
    ) {
      userId = userId.id;
    }

    let value = String(userId).trim();

    // [id123|Имя]
    let match = value.match(
      /\[id(\d+)\|[^\]]*\]/
    );

    if (match) {
      value = match[1];
    }

    // vk.com/id123
    match = value.match(
      /(?:https?:\/\/)?(?:m\.)?vk\.com\/id(\d+)/i
    );

    if (match) {
      value = match[1];
    }

    // ═══════════════════════════════════════
    // СООБЩЕСТВО
    // ═══════════════════════════════════════

    if (/^-\d+$/.test(value)) {
      const gid = Math.abs(
        Number(value)
      );

      try {
        const groupInfo =
          await vk.api.groups.getById({
            group_ids: gid,
            fields: 'name'
          });

        if (
          groupInfo &&
          groupInfo.groups &&
          groupInfo.groups[0]
        ) {
          return `[club${gid}|${groupInfo.groups[0].name}]`;
        }

      } catch (error) {
        console.error(
          'getlink group error:',
          error.message
        );
      }

      return `[club${gid}|Сообщество]`;
    }

    // ═══════════════════════════════════════
    // ПОЛЬЗОВАТЕЛЬ
    // ═══════════════════════════════════════

    const user =
      await getVkUser(value);

    if (
      !user ||
      !user.id
    ) {
      return `[id${value}|Пользователь]`;
    }

    const firstName =
      user.first_name
        ? String(user.first_name).trim()
        : '';

    const lastName =
      user.last_name
        ? String(user.last_name).trim()
        : '';

    const name =
      `${firstName} ${lastName}`.trim();

    if (name) {
      return `[id${user.id}|${name}]`;
    }

    return `[id${user.id}|ID ${user.id}]`;

  } catch (error) {
    console.error(
      'getlink error:',
      error.message
    );

    return `[id${userId}|Пользователь]`;
  }
}

global.getlink = getlink;


// ═══════════════════════════════════════════
// ССЫЛКА НА СООБЩЕСТВО
// ═══════════════════════════════════════════

async function getGroupLink(numericId) {
  const gid = Math.abs(
    Number(numericId)
  );

  try {
    const groupInfo =
      await vk.api.groups.getById({
        group_ids: gid,
        fields: 'name'
      });

    if (
      groupInfo &&
      groupInfo.groups &&
      groupInfo.groups[0]
    ) {
      return `[club${gid}|${groupInfo.groups[0].name}]`;
    }

  } catch (error) {
    console.error(
      'getGroupLink error:',
      error.message
    );
  }

  return `[club${gid}|Сообщество]`;
}

global.getGroupLink = getGroupLink;


// ═══════════════════════════════════════════
// POOL KEY
// ═══════════════════════════════════════════

async function getpoolkey(peerId) {
  const poolTables =
    await new Promise((resolve, reject) => {
      database.query(
        'SHOW TABLES',
        (error, results) => {
          if (error) {
            return reject(error);
          }

          resolve(
            results.map(
              r => r.Tables_in_conference
            )
          );
        }
      );
    });

  for (const tableName of poolTables) {
    if (!tableName.startsWith('pools_')) {
      continue;
    }

    const rows =
      await new Promise((resolve, reject) => {
        database.query(
          `SELECT * FROM ${tableName} WHERE pool_peerIds LIKE ?`,
          [`%${peerId}%`],
          (error, results) => {
            if (error) {
              return reject(error);
            }

            resolve(results);
          }
        );
      });

    if (
      rows &&
      rows.length > 0
    ) {
      return rows[0].pool_key;
    }
  }

  return null;
}


// ═══════════════════════════════════════════
// РОЛЬ ПОЛЬЗОВАТЕЛЯ
// ═══════════════════════════════════════════

async function getUserRole(
  conferenceId,
  userId
) {
  return new Promise((resolve, reject) => {
    database.query(
      `SELECT role_id FROM roles_${conferenceId} WHERE user_id = ? LIMIT 1`,
      [userId],
      (error, results) => {
        if (error) {
          return reject(error);
        }

        resolve(
          results &&
          results[0] &&
          results[0].role_id
            ? results[0].role_id
            : 0
        );
      }
    );
  });
}


// ═══════════════════════════════════════════
// VIP
// ═══════════════════════════════════════════

async function getUserVip(userId) {
  return new Promise((resolve, reject) => {
    database.query(
      'SELECT * FROM vip_users WHERE user_id = ?',
      [userId],
      (error, results) => {
        if (error) {
          return reject(error);
        }

        resolve(
          results &&
          results[0] &&
          results[0].vip
            ? results[0].vip
            : null
        );
      }
    );
  });
}


// ═══════════════════════════════════════════
// TECH
// ═══════════════════════════════════════════

async function getUserTech(userId) {
  return new Promise((resolve, reject) => {
    database.query(
      'SELECT * FROM agents WHERE user_id = ?',
      [userId],
      (error, results) => {
        if (error) {
          return reject(error);
        }

        resolve(
          results &&
          results[0] &&
          results[0].agent_access
            ? results[0].agent_access
            : null
        );
      }
    );
  });
}


// ═══════════════════════════════════════════
// VIP STATUS
// ═══════════════════════════════════════════

async function getUserVipStatus(userId) {
  return new Promise((resolve, reject) => {
    database.query(
      'SELECT * FROM vip_users WHERE user_id = ?',
      [userId],
      (error, results) => {
        if (error) {
          return reject(error);
        }

        resolve(
          results &&
          results[0] &&
          results[0].vip
            ? '(VIP-Пользователь)'
            : ''
        );
      }
    );
  });
}


// ═══════════════════════════════════════════
// ПРОВЕРКА ТАБЛИЦЫ
// ═══════════════════════════════════════════

async function checkIfTableExists(tableName) {
  return new Promise((resolve) => {
    database.query(
      `SHOW TABLES LIKE '${tableName}'`,
      (error, results) => {
        resolve(
          !error &&
          results &&
          results.length > 0
        );
      }
    );
  });
}


// ═══════════════════════════════════════════
// НАЗВАНИЕ РОЛИ
// ═══════════════════════════════════════════

function getRoleName(roleId) {
  const roles = {
    20: 'Модератор',
    40: 'Администратор',
    60: 'Спец. Администратор',
    80: 'Руководитель',
    100: 'Владелец'
  };

  return roles[roleId] ||
    'Пользователь';
}


function getRoleNamezov(roleId) {
  const roles = {
    20: 'Модератором',
    40: 'Администратором',
    60: 'Спец администратором',
    80: 'Руководителем',
    100: 'Владельцем'
  };

  return roles[roleId] ||
    'Пользователь';
}


// ═══════════════════════════════════════════
// НАЗВАНИЕ УСТРОЙСТВА
// ═══════════════════════════════════════════

function getDeviceName(platform) {
  switch (platform) {
    case 1:
      return 'Мобильная версия сайта или мобильное приложение';

    case 2:
      return 'Приложение для iPhone';

    case 3:
      return 'Приложение для iPad';

    case 4:
      return 'Приложение для Android';

    case 5:
      return 'Приложение для Windows Phone';

    case 6:
      return 'Приложение для Windows 10';

    case 7:
      return 'Полная версия сайта (ПК)';

    default:
      return 'Неизвестное устройство';
  }
}


// ═══════════════════════════════════════════
// ИЗВЛЕЧЕНИЕ ЧИСЛОВОГО ID
// ═══════════════════════════════════════════

async function extractNumericId(input) {
  try {
    if (typeof input === 'number') {
      return input;
    }

    if (
      input === null ||
      input === undefined ||
      typeof input !== 'string'
    ) {
      return null;
    }

    const value =
      input.trim();

    // Просто ID
    if (/^\d+$/.test(value)) {
      return parseInt(
        value,
        10
      );
    }

    // [id123|Имя]
    let match =
      value.match(
        /\[id(\d+)\|[^\]]*\]/
      );

    if (match) {
      return parseInt(
        match[1],
        10
      );
    }

    // vk.com/id123
    match =
      value.match(
        /(?:https?:\/\/)?(?:vk\.com|m\.vk\.com)\/id(\d+)/i
      );

    if (match) {
      return parseInt(
        match[1],
        10
      );
    }

    // vk.com/username
    match =
      value.match(
        /(?:https?:\/\/)?(?:vk\.com|m\.vk\.com)\/([a-zA-Z0-9_.]+)/i
      );

    if (match) {
      const identifier =
        match[1];

      if (/^\d+$/.test(identifier)) {
        return parseInt(
          identifier,
          10
        );
      }

      const users =
        await vk.api.users.get({
          user_ids: [identifier]
        });

      if (
        users &&
        users[0] &&
        users[0].id
      ) {
        return Number(
          users[0].id
        );
      }
    }

    return null;

  } catch (error) {
    console.error(
      'extractNumericId error:',
      error.message
    );

    return null;
  }
}

global.extractNumericId =
  extractNumericId;


// ═══════════════════════════════════════════
// ДАННЫЕ КОНФЕРЕНЦИИ
// ═══════════════════════════════════════════

async function getConferenceData(
  conferenceId
) {
  return new Promise((resolve, reject) => {
    database.query(
      'SELECT * FROM conferences WHERE conference_id = ?',
      [conferenceId],
      (error, results) => {
        if (error) {
          return reject(error);
        }

        resolve(
          results &&
          results[0]
            ? results[0]
            : null
        );
      }
    );
  });
}


// ═══════════════════════════════════════════
// IQ
// ═══════════════════════════════════════════

async function getIq(userId) {
  return 100;
}


// ═══════════════════════════════════════════
// СЧЁТЧИК СООБЩЕНИЙ
// ═══════════════════════════════════════════

async function incrementMessageCount(
  conferenceId,
  userId
) {
  return new Promise((resolve, reject) => {
    database.query(
      `INSERT INTO conference_stats_${conferenceId}
      (user_id, message_count)
      VALUES (?, 1)
      ON DUPLICATE KEY UPDATE
      message_count = message_count + 1;`,
      [userId],
      (error, results) => {
        if (error) {
          if (
            error.code ===
            'ER_NO_SUCH_TABLE'
          ) {
            return resolve();
          }

          return reject(error);
        }

        resolve(results);
      }
    );
  });
}


// ═══════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════

module.exports = {
  checkUserRole,
  checkIfTableExists,
  getUserRole,
  getRoleName,
  getRoleNamezov,
  getDeviceName,
  getpoolkey,
  getUserVip,
  getUsername,
  getUserTech,
  getUserVipStatus,
  getAgentInfo,
  getlink,
  getGroupLink,
  extractNumericId,
  getConferenceData,
  getIq,
  incrementMessageCount,

  getVkUser,
  getUserIdByUsername,
  getUserIdFromInput
};