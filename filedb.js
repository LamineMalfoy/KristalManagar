const fs = require('fs');
const path = require('path');
const util = require('util');
const logger = require('./logger.js');

// Создаем директорию для хранения данных, если она не существует
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR);
}

// Создаем директории для таблиц
const TABLES = [
  'conference',
  'roles',
  'nicknames',
  'userinfo',
  'blockedusers',
  'pools',
  'custom_roles',
  'sysbanned',
  'sysadmins',
  'tech',
  'agents',
  'testers',
  'vip_users',
  'user_balances',
  'user_dailies',
  'casino_games',
  'casino_bets',
  'tickets',
  'report_banned',
  'user_reputation',
  'reputation_limits',
  'user_businesses',
  'user_slots'
];

TABLES.forEach(table => {
  const tableDir = path.join(DATA_DIR, table);
  if (!fs.existsSync(tableDir)) {
    fs.mkdirSync(tableDir);
  }
});

const readFileAsync = util.promisify(fs.readFile);
const writeFileAsync = util.promisify(fs.writeFile);
const readdirAsync = util.promisify(fs.readdir);
const unlinkAsync = util.promisify(fs.unlink);

function query(sql, values, callback) {
  if (typeof values === 'function' && !callback) {
    callback = values;
    values = [];
  }

  if (!Array.isArray(values) && typeof values === 'object') {
    const newValues = [];
    Object.keys(values).forEach(key => {
      const paramIndex = sql.indexOf(`:${key}`);
      if (paramIndex !== -1) newValues.push(values[key]);
    });
    values = newValues;
  }

  sql = sql.trim().toLowerCase();

  try {
    if (sql.startsWith('insert into')) {
      handleInsert(sql, values, callback);
    } else if (sql.startsWith('select')) {
      handleSelect(sql, values, callback);
    } else if (sql.startsWith('update')) {
      handleUpdate(sql, values, callback);
    } else if (sql.startsWith('delete')) {
      handleDelete(sql, values, callback);
    } else if (sql.startsWith('create table')) {
      const tableName = extractTableName(sql);
      const tableDir = path.join(DATA_DIR, tableName);
      if (!fs.existsSync(tableDir)) fs.mkdirSync(tableDir);
      if (callback) callback(null, { affectedRows: 0 });
    } else if (sql.startsWith('show tables')) {
      fs.readdir(DATA_DIR, (err, files) => {
        if (err) { if (callback) callback(err); return; }
        const tables = files.filter(file =>
          fs.statSync(path.join(DATA_DIR, file)).isDirectory()
        ).map(dir => ({ Tables_in_bot_zakaz: dir }));
        if (callback) callback(null, tables);
      });
    } else {
      if (callback) callback(new Error('Неподдерживаемый запрос: ' + sql));
    }
  } catch (error) {
    logger.error('Ошибка выполнения запроса:', error);
    if (callback) callback(error);
  }
}

// ─── INSERT ───
function handleInsert(sql, values, callback) {
  try {
    const tableName = extractTableName(sql);
    const tableDir = path.join(DATA_DIR, tableName);

    if (!fs.existsSync(tableDir)) fs.mkdirSync(tableDir);

    let data = {};

    if (values.length > 0 && typeof values[0] === 'object' && !Array.isArray(values[0]) && values[0] !== null) {
      data = values[0];
    } else {
      const fields = extractFields(sql);
      fields.forEach((field, index) => {
        data[field] = values[index];
      });
    }

    if (!data || typeof data !== 'object') {
      if (callback) callback(new Error('Некорректные данные для INSERT'));
      return;
    }

    // ─── user_businesses: много бизнесов на юзера ───
    if (tableName === 'user_businesses') {
      const uidFile = path.join(tableDir, '_last_uid.json');
      let lastUid = 0;
      try {
        if (fs.existsSync(uidFile)) {
          lastUid = JSON.parse(fs.readFileSync(uidFile, 'utf8')).last_uid || 0;
        }
      } catch (e) { lastUid = 0; }

      const newUid = lastUid + 1;
      fs.writeFileSync(uidFile, JSON.stringify({ last_uid: newUid }, null, 2));

      data.uid = newUid;

      const fileName = `${data.user_id}_${newUid}.json`;
      const filePath = path.join(tableDir, fileName);

      fs.writeFile(filePath, JSON.stringify(data, null, 2), (err) => {
        if (err) {
          if (callback) callback(err);
          return;
        }
        if (callback) callback(null, { affectedRows: 1, insertId: newUid });
      });

      return;
    }

    // ─── Стандартный INSERT ───
    let fileName = '';
    if (tableName === 'tickets') {
      const lastIdPath = path.join(DATA_DIR, 'tickets', 'last_id.json');
      let lastId = 0;
      try {
        if (fs.existsSync(lastIdPath)) {
          lastId = JSON.parse(fs.readFileSync(lastIdPath, 'utf8')).last_id || 0;
        }
      } catch (e) { lastId = 0; }
      const newId = lastId + 1;
      fs.writeFileSync(lastIdPath, JSON.stringify({ last_id: newId }, null, 2));
      data.id = newId;
      fileName = `${newId}.json`;
    } else if (data.userid) {
      fileName = `${data.userid}.json`;
    } else if (data.user_id) {
      fileName = `${data.user_id}.json`;
    } else if (data.id) {
      fileName = `${data.id}.json`;
    } else if (data.conference_id) {
      fileName = `${data.conference_id}.json`;
    } else {
      fileName = `${Date.now()}.json`;
    }

    const filePath = path.join(tableDir, fileName);

    const hasOnDuplicate = sql.includes('on duplicate key update');
    if (hasOnDuplicate) {
      if (fs.existsSync(filePath)) {
        try {
          let existingData = {};
          const fileContent = fs.readFileSync(filePath, 'utf8');
          existingData = fileContent && fileContent.trim() ? JSON.parse(fileContent) : {};
          Object.keys(data).forEach(key => {
            existingData[key] = data[key];
          });
          data = existingData;
        } catch (error) {
          logger.error('Ошибка при чтении существующего файла:', error);
        }
      }
    }

    fs.writeFile(filePath, JSON.stringify(data, null, 2), (err) => {
      if (err) {
        if (callback) callback(err);
        return;
      }
      if (callback) callback(null, {
        affectedRows: 1,
        insertId: data.id || data.user_id || data.userid || data.conference_id || Date.now()
      });
    });
  } catch (error) {
    logger.error('Ошибка при INSERT:', error);
    if (callback) callback(error);
  }
}

// ─── SELECT ───
function handleSelect(sql, values, callback) {
  try {
    const tableName = extractTableName(sql);
    const tableDir = path.join(DATA_DIR, tableName);

    if (!fs.existsSync(tableDir)) {
      if (callback) callback(null, []);
      return;
    }

    const whereClause = extractWhereClause(sql);
    const conditions = parseWhereConditions(whereClause, values);

    fs.readdir(tableDir, (err, files) => {
      if (err) {
        if (callback) callback(err);
        return;
      }

      const readPromises = files.filter(file => file.endsWith('.json') && !file.startsWith('_'))
        .map(file => {
          const filePath = path.join(tableDir, file);
          return readFileAsync(filePath, 'utf8')
            .then(content => {
              if (!content || content.trim() === '') return null;
              try { return JSON.parse(content); } catch { return null; }
            })
            .catch(() => null);
        });

      Promise.all(readPromises).then(results => {
        const filtered = results.filter(item => item !== null).filter(item => {
          if (conditions.length === 0) return true;
          return conditions.every(condition => {
            const { field, operator, value } = condition;
            if (!(field in item)) return false;
            const fv = item[field];
            if (fv === null || fv === undefined) {
              return operator === '!=' || operator === '<>';
            }
            switch (operator) {
              case '=':
                if (field === 'user_id' || field === 'role_id' || field === 'uid' || field === 'userid') {
                  return (String(fv) == String(value)) || (Number(fv) === Number(value));
                }
                return fv == value;
              case '!=':
                return fv != value;
              case '>': return Number(fv) > Number(value);
              case '<': return Number(fv) < Number(value);
              case '>=': return Number(fv) >= Number(value);
              case '<=': return Number(fv) <= Number(value);
              case 'LIKE':
                const regex = new RegExp(String(value).replace(/%/g, '.*'));
                return regex.test(String(fv));
              default: return false;
            }
          });
        });
        if (callback) callback(null, filtered);
      }).catch(err => {
        if (callback) callback(err);
      });
    });
  } catch (error) {
    logger.error('Ошибка при SELECT:', error);
    if (callback) callback(error);
  }
}

// ─── UPDATE ───
function handleUpdate(sql, values, callback) {
  // ─── Спец: user_businesses с uid ───
  if (sql.includes('user_businesses') && sql.includes('uid')) {
    const userId = values[values.length - 2];
    const uid = values[values.length - 1];
    const filePath = path.join(DATA_DIR, 'user_businesses', `${userId}_${uid}.json`);

    try {
      if (!fs.existsSync(filePath)) {
        if (callback) callback(null, { affectedRows: 0 });
        return;
      }
      const existing = JSON.parse(fs.readFileSync(filePath, 'utf8'));

      const setMatch = sql.match(/set\s+(.+?)\s+where/i);
      if (setMatch) {
        const sets = setMatch[1].split(',').map(s => s.trim());
        let valueIdx = 0;
        sets.forEach(part => {
          const m = part.match(/(\w+)\s*=\s*(\?|\d+)/);
          if (!m) return;
          const field = m[1];
          let val;
          if (m[2] === '?') val = values[valueIdx++];
          else val = parseInt(m[2]);
          existing[field] = val;
        });
      }

      fs.writeFileSync(filePath, JSON.stringify(existing, null, 2));
      if (callback) callback(null, { affectedRows: 1 });
    } catch (e) {
      logger.error('Ошибка UPDATE user_businesses:', e);
      if (callback) callback(e);
    }
    return;
  }

  // ─── Стандартный UPDATE ───
  try {
    const tableName = extractTableName(sql);
    const tableDir = path.join(DATA_DIR, tableName);

    if (!fs.existsSync(tableDir)) {
      if (callback) callback(null, { affectedRows: 0 });
      return;
    }

    const setClause = extractSetClause(sql);
    const fieldsToUpdate = parseSetClause(setClause);

    let updateValues = [];
    let whereValues = [];

    if (values.length > 0 && typeof values[0] === 'object' && !Array.isArray(values[0])) {
      const updateData = values[0];
      fieldsToUpdate.forEach(field => {
        if (field.value === null) field.value = updateData[field.name];
      });
      whereValues = values.slice(1);
    } else {
      const paramCount = fieldsToUpdate.filter(f => f.value === null).length;
      updateValues = values.slice(0, paramCount);
      whereValues = values.slice(paramCount);
      let i = 0;
      fieldsToUpdate.forEach(field => {
        if (field.value === null) field.value = updateValues[i++];
      });
    }

    const whereClause = extractWhereClause(sql);
    const conditions = parseWhereConditions(whereClause, whereValues);

    fs.readdir(tableDir, (err, files) => {
      if (err) { if (callback) callback(err); return; }

      const promises = files.filter(f => f.endsWith('.json') && !f.startsWith('_')).map(file => {
        const filePath = path.join(tableDir, file);
        return readFileAsync(filePath, 'utf8').then(content => {
          try {
            if (!content || content.trim() === '') return false;
            let data = JSON.parse(content);

            const shouldUpdate = conditions.every(condition => {
              const { field, operator, value } = condition;
              if (!(field in data)) return false;
              const fv = data[field];
              if (fv === null || fv === undefined) return operator === '!=' || operator === '<>';
              switch (operator) {
                case '=':
                  if (field === 'user_id' || field === 'role_id' || field === 'userid') {
                    return (String(fv) == String(value)) || (Number(fv) === Number(value));
                  }
                  return String(fv) == String(value);
                case '!=': return String(fv) != String(value);
                case '>': return Number(fv) > Number(value);
                case '<': return Number(fv) < Number(value);
                case '>=': return Number(fv) >= Number(value);
                case '<=': return Number(fv) <= Number(value);
                case 'LIKE':
                  const regex = new RegExp(String(value).replace(/%/g, '.*'));
                  return regex.test(String(fv));
                default: return false;
              }
            });

            if (shouldUpdate) {
              fieldsToUpdate.forEach(field => {
                if (typeof data[field.name] === 'boolean') {
                  data[field.name] = Boolean(field.value === true || field.value === 'true' || field.value === 1 || field.value === '1');
                } else {
                  data[field.name] = field.value;
                }
              });
              return writeFileAsync(filePath, JSON.stringify(data, null, 2)).then(() => true);
            }
            return false;
          } catch (e) {
            logger.error(`Ошибка парсинга ${filePath}:`, e);
            return false;
          }
        }).catch(() => false);
      });

      Promise.all(promises).then(results => {
        const affectedRows = results.filter(r => r).length;
        if (callback) callback(null, { affectedRows });
      }).catch(err => { if (callback) callback(err); });
    });
  } catch (error) {
    logger.error('Ошибка при UPDATE:', error);
    if (callback) callback(error);
  }
}

// ─── DELETE ───
function handleDelete(sql, values, callback) {
  // ─── Спец: user_businesses с uid ───
  if (sql.includes('user_businesses') && sql.includes('uid')) {
    const userId = values[values.length - 2];
    const uid = values[values.length - 1];
    const filePath = path.join(DATA_DIR, 'user_businesses', `${userId}_${uid}.json`);

    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        if (callback) callback(null, { affectedRows: 1 });
      } else {
        if (callback) callback(null, { affectedRows: 0 });
      }
    } catch (e) {
      logger.error('Ошибка DELETE user_businesses:', e);
      if (callback) callback(e);
    }
    return;
  }

  // ─── Стандартный DELETE ───
  try {
    const tableName = extractTableName(sql);
    const tableDir = path.join(DATA_DIR, tableName);

    if (!fs.existsSync(tableDir)) {
      if (callback) callback(null, { affectedRows: 0 });
      return;
    }

    const whereClause = extractWhereClause(sql);
    const conditions = parseWhereConditions(whereClause, values);

    fs.readdir(tableDir, (err, files) => {
      if (err) { if (callback) callback(err); return; }

      const promises = files.filter(f => f.endsWith('.json') && !f.startsWith('_')).map(file => {
        const filePath = path.join(tableDir, file);
        return readFileAsync(filePath, 'utf8').then(content => {
          try {
            let data = content && content.trim() ? JSON.parse(content) : {};
            const shouldDelete = conditions.every(condition => {
              const { field, operator, value } = condition;
              if (!(field in data)) return false;
              const fv = data[field];
              if (fv === null || fv === undefined) return operator === '!=' || operator === '<>';
              switch (operator) {
                case '=':
                  if (field === 'user_id' || field === 'role_id' || field === 'userid') {
                    return (String(fv) == String(value)) || (Number(fv) === Number(value));
                  }
                  return fv == value;
                case '!=': return fv != value;
                case '>': return Number(fv) > Number(value);
                case '<': return Number(fv) < Number(value);
                case '>=': return Number(fv) >= Number(value);
                case '<=': return Number(fv) <= Number(value);
                case 'LIKE':
                  const regex = new RegExp(String(value).replace(/%/g, '.*'));
                  return regex.test(String(fv));
                default: return false;
              }
            });
            if (shouldDelete) return unlinkAsync(filePath).then(() => true);
            return false;
          } catch (e) { return false; }
        }).catch(() => false);
      });

      Promise.all(promises).then(results => {
        const affectedRows = results.filter(r => r).length;
        if (callback) callback(null, { affectedRows });
      }).catch(err => { if (callback) callback(err); });
    });
  } catch (error) {
    logger.error('Ошибка при DELETE:', error);
    if (callback) callback(error);
  }
}

// ─── Вспомогательные ───
function extractTableName(sql) {
  let match;
  if (sql.startsWith('insert into')) match = sql.match(/insert\s+into\s+`?(\w+)`?\s/i);
  else if (sql.startsWith('select')) match = sql.match(/from\s+`?(\w+)`?/i);
  else if (sql.startsWith('update')) match = sql.match(/update\s+`?(\w+)`?\s/i);
  else if (sql.startsWith('delete')) match = sql.match(/from\s+`?(\w+)`?\s/i);
  else if (sql.startsWith('create table')) match = sql.match(/create\s+table\s+(?:if\s+not\s+exists\s+)?`?(\w+)`?/i);
  return match && match[1] ? match[1] : '';
}

function extractFields(sql) {
  if (sql.includes('set ?')) return [];
  const match = sql.match(/\(([^)]+)\)\s+values\s*\(/i);
  if (!match || !match[1]) return [];
  return match[1].split(',').map(f => f.trim().replace(/`/g, '')).filter(f => f.length > 0);
}

function extractWhereClause(sql) {
  const match = sql.match(/where\s+(.+?)(?:$|order\s+by|group\s+by|having|limit|offset)/i);
  return match && match[1] ? match[1].trim() : '';
}

function parseWhereConditions(whereClause, values) {
  if (!whereClause) return [];
  return whereClause.split(/\s+and\s+/i).map((cond, idx) => {
    const match = cond.match(/([\w_]+)\s*(=|!=|>|<|>=|<=|LIKE)\s*\?/i);
    if (!match) return null;
    let value = values[idx];
    if (match[1] === 'status') {
      if (value === false || value === 'false' || value === 0 || value === '0') value = false;
      if (value === true || value === 'true' || value === 1 || value === '1') value = true;
    }
    return { field: match[1], operator: match[2], value };
  }).filter(Boolean);
}

function extractSetClause(sql) {
  const match = sql.match(/set\s+(.+?)(?:\s+where|$)/i);
  return match && match[1] ? match[1].trim() : '';
}

function parseSetClause(setClause) {
  if (!setClause) return [];
  const fields = [];
  setClause.split(',').map(p => p.trim()).forEach(part => {
    let m = part.match(/(\w+)\s*=\s*\?/i);
    if (m) {
      fields.push({ name: m[1], value: null });
    } else {
      m = part.match(/(\w+)\s*=\s*([\d]+|'[^']*'|"[^"]*")/i);
      if (m) {
        let v = m[2];
        if (v.startsWith("'") || v.startsWith('"')) v = v.slice(1, -1);
        else if (/^\d+$/.test(v)) v = parseInt(v);
        fields.push({ name: m[1], value: v });
      }
    }
  });
  return fields;
}

// ─── Функции баланса ───
async function getUserBalance(userId) {
  try {
    const filePath = path.join(DATA_DIR, 'user_balances', `${userId}.json`);
    if (!fs.existsSync(filePath)) {
      await writeFileAsync(filePath, JSON.stringify({ balance: 10000, btc: 0 }));
      return 10000;
    }
    const data = JSON.parse(await readFileAsync(filePath));
    return data.balance;
  } catch (error) {
    logger.error('Ошибка при получении баланса:', error);
    return 10000;
  }
}

async function updateUserBalance(userId, newBalance) {
  try {
    const filePath = path.join(DATA_DIR, 'user_balances', `${userId}.json`);
    const data = fs.existsSync(filePath)
      ? JSON.parse(await readFileAsync(filePath))
      : { balance: 10000, btc: 0 };
    data.balance = newBalance;
    await writeFileAsync(filePath, JSON.stringify(data));
    return true;
  } catch (error) {
    logger.error('Ошибка при обновлении баланса:', error);
    return false;
  }
}

async function getLastDaily(userId) {
  try {
    const filePath = path.join(DATA_DIR, 'user_dailies', `${userId}.json`);
    if (!fs.existsSync(filePath)) return null;
    const raw = JSON.parse(await readFileAsync(filePath));
    const last_daily = typeof raw.last_daily === 'number' ? raw.last_daily
                      : typeof raw.lastDaily === 'number' ? raw.lastDaily
                      : null;
    const streak = typeof raw.streak === 'number' ? raw.streak : 1;
    if (last_daily === null) return null;
    return { userId, last_daily, streak };
  } catch (error) {
    logger.error('Ошибка при получении информации о бонусе:', error);
    return null;
  }
}

async function setLastDaily(userId, streak = 1) {
  const filePath = path.join(DATA_DIR, 'user_dailies', `${userId}.json`);
  const now = Date.now();
  const data = {
    userId: userId,
    last_daily: now,
    lastDaily: now,
    streak: streak
  };
  try {
    await writeFileAsync(filePath, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    logger.error('Ошибка при сохранении ежедневного бонуса:', error);
    return false;
  }
}

async function getUserBTC(userId) {
  const filePath = path.join(DATA_DIR, 'user_balances', `${userId}.json`);
  try {
    if (!fs.existsSync(filePath)) return 0;
    const data = await readFileAsync(filePath, 'utf8');
    const balance = JSON.parse(data);
    return balance.btc || 0;
  } catch (error) {
    logger.error('Ошибка при получении BTC баланса:', error);
    return 0;
  }
}

async function updateUserBTC(userId, newAmount) {
  const balanceDir = path.join(DATA_DIR, 'user_balances');
  const filePath = path.join(balanceDir, `${userId}.json`);
  try {
    if (!fs.existsSync(balanceDir)) {
      fs.mkdirSync(balanceDir, { recursive: true });
    }
    let balance = { userId: userId, dollars: 0, btc: 0 };
    if (fs.existsSync(filePath)) {
      const data = await readFileAsync(filePath, 'utf8');
      balance = JSON.parse(data);
    }
    balance.btc = newAmount;
    await writeFileAsync(filePath, JSON.stringify(balance, null, 2));
    return newAmount;
  } catch (error) {
    logger.error('Ошибка при обновлении BTC баланса:', error);
    throw error;
  }
}

async function getUserResources(userId) {
  const fs = require('fs');
  const path = require('path');
  try {
    const resourcesDir = path.join(__dirname, 'data', 'user_resources');
    if (!fs.existsSync(resourcesDir)) {
      fs.mkdirSync(resourcesDir, { recursive: true });
    }
    const filePath = path.join(resourcesDir, `${userId}.json`);
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      const resources = JSON.parse(data);
      return {
        stone: resources.stone || 0,
        coal: resources.coal || 0,
        iron: resources.iron || 0,
        gold: resources.gold || 0,
        diamond: resources.diamond || 0
      };
    }
    return { stone: 0, coal: 0, iron: 0, gold: 0, diamond: 0 };
  } catch (error) {
    logger.error(`Ошибка при получении ресурсов пользователя ${userId}:`, error);
    return { stone: 0, coal: 0, iron: 0, gold: 0, diamond: 0 };
  }
}

async function updateUserResources(userId, resourceType, amount) {
  const fs = require('fs');
  const path = require('path');
  try {
    const resourcesDir = path.join(__dirname, 'data', 'user_resources');
    if (!fs.existsSync(resourcesDir)) {
      fs.mkdirSync(resourcesDir, { recursive: true });
    }
    const filePath = path.join(resourcesDir, `${userId}.json`);
    let resources = { stone: 0, coal: 0, iron: 0, gold: 0, diamond: 0 };
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      resources = { ...resources, ...JSON.parse(data) };
    }
    if (resources.hasOwnProperty(resourceType)) {
      resources[resourceType] = Math.max(0, resources[resourceType] + amount);
    }
    fs.writeFileSync(filePath, JSON.stringify(resources, null, 2));
    return true;
  } catch (error) {
    logger.error(`Ошибка при обновлении ресурсов пользователя ${userId}:`, error);
    return false;
  }
}

async function exchangeResources(userId, resourceType, amount) {
  try {
    const resources = await getUserResources(userId);
    if (!resources.hasOwnProperty(resourceType)) {
      return { success: false, error: 'Неизвестный тип ресурса' };
    }
    if (resources[resourceType] < amount) {
      return { success: false, error: `Недостаточно ресурса "${resourceType}"` };
    }
    const exchangeRates = { stone: 180, coal: 230, iron: 350, gold: 500, diamond: 1000 };
    const totalMoney = amount * exchangeRates[resourceType];
    const updateResult = await updateUserResources(userId, resourceType, -amount);
    if (!updateResult) {
      return { success: false, error: 'Ошибка при обновлении ресурсов' };
    }
    const currentBalance = await getUserBalance(userId);
    const balanceResult = await updateUserBalance(userId, currentBalance + totalMoney);
    if (!balanceResult) {
      await updateUserResources(userId, resourceType, amount);
      return { success: false, error: 'Ошибка при обновлении баланса' };
    }
    return { success: true, resourceType, amount, totalMoney, rate: exchangeRates[resourceType] };
  } catch (error) {
    logger.error(`Ошибка при обмене ресурсов пользователя ${userId}:`, error);
    return { success: false, error: 'Произошла ошибка при обмене' };
  }
}

function getUserVipStatus(userId) {
  const vipFilePath = path.join(__dirname, 'data', 'vip_users', `${userId}.json`);
  if (!fs.existsSync(vipFilePath)) return null;
  try {
    const vipData = JSON.parse(fs.readFileSync(vipFilePath, 'utf8'));
    if (!vipData.is_permanent && vipData.expiry_date) {
      const now = new Date();
      const expiry = new Date(vipData.expiry_date);
      if (now > expiry) {
        fs.unlinkSync(vipFilePath);
        return null;
      }
    }
    return {
      isVip: true,
      expiryDate: vipData.expiry_date,
      grantedBy: vipData.granted_by,
      isPermanent: vipData.is_permanent === 1
    };
  } catch (error) {
    logger.error('Ошибка при чтении VIP статуса:', error);
    return null;
  }
}

function getInviterInfo(peerId, userId) {
  const cacheDir = path.join(__dirname, 'data', 'inviter_cache');
  if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
  const cacheFilePath = path.join(cacheDir, `${peerId}_${userId}.json`);
  if (!fs.existsSync(cacheFilePath)) return null;
  try {
    const cacheData = JSON.parse(fs.readFileSync(cacheFilePath, 'utf8'));
    return cacheData.inviterId;
  } catch (error) {
    logger.error('Ошибка при чтении кэша пригласившего:', error);
    return null;
  }
}

function setInviterInfo(peerId, userId, inviterId) {
  const cacheDir = path.join(__dirname, 'data', 'inviter_cache');
  if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
  const cacheFilePath = path.join(cacheDir, `${peerId}_${userId}.json`);
  try {
    const cacheData = {
      peerId: peerId,
      userId: userId,
      inviterId: inviterId,
      cachedAt: new Date().toISOString()
    };
    fs.writeFileSync(cacheFilePath, JSON.stringify(cacheData, null, 2), 'utf8');
    return true;
  } catch (error) {
    logger.error('Ошибка при записи кэша пригласившего:', error);
    return false;
  }
}

async function setUserVipStatus(userId, expiryDate, grantedBy, isPermanent = false) {
  const fs = require('fs');
  const path = require('path');
  try {
    const vipDir = path.join(__dirname, 'data', 'vip_users');
    if (!fs.existsSync(vipDir)) fs.mkdirSync(vipDir, { recursive: true });
    const vipFile = path.join(vipDir, `${userId}.json`);
    const vipData = {
      userid: userId,
      expiry_date: expiryDate ? expiryDate.toISOString() : null,
      granted_by: grantedBy,
      granted_date: new Date().toISOString(),
      is_permanent: isPermanent ? 1 : 0
    };
    fs.writeFileSync(vipFile, JSON.stringify(vipData, null, 2));
    return true;
  } catch (error) {
    logger.error(`Ошибка при установке VIP статуса пользователя ${userId}:`, error);
    return false;
  }
}

async function removeUserVipStatus(userId) {
  const fs = require('fs');
  const path = require('path');
  try {
    const vipFile = path.join(__dirname, 'data', 'vip_users', `${userId}.json`);
    if (fs.existsSync(vipFile)) {
      fs.unlinkSync(vipFile);
      return true;
    }
    return false;
  } catch (error) {
    logger.error(`Ошибка при удалении VIP статуса пользователя ${userId}:`, error);
    return false;
  }
}

async function getUserReputation(userId) {
  const fs = require('fs');
  const path = require('path');
  try {
    const repFile = path.join(__dirname, 'data', 'user_reputation', `${userId}.json`);
    if (!fs.existsSync(repFile)) return 0;
    const data = fs.readFileSync(repFile, 'utf8');
    const repData = JSON.parse(data);
    return repData.reputation || 0;
  } catch (error) {
    logger.error(`Ошибка при получении репутации пользователя ${userId}:`, error);
    return 0;
  }
}

async function updateUserReputation(userId, change, grantedBy = null) {
  const fs = require('fs');
  const path = require('path');
  try {
    const repDir = path.join(__dirname, 'data', 'user_reputation');
    if (!fs.existsSync(repDir)) fs.mkdirSync(repDir, { recursive: true });
    const repFile = path.join(repDir, `${userId}.json`);
    let currentRep = 0;
    let repData = {
      userid: userId,
      reputation: 0,
      last_updated: new Date().toISOString(),
      history: []
    };
    if (fs.existsSync(repFile)) {
      const data = fs.readFileSync(repFile, 'utf8');
      repData = JSON.parse(data);
      currentRep = repData.reputation || 0;
    }
    const newRep = Math.max(0, currentRep + change);
    repData.reputation = newRep;
    repData.last_updated = new Date().toISOString();
    if (!repData.history) repData.history = [];
    repData.history.push({
      change: change,
      granted_by: grantedBy,
      timestamp: new Date().toISOString(),
      new_total: newRep
    });
    if (repData.history.length > 50) {
      repData.history = repData.history.slice(-50);
    }
    fs.writeFileSync(repFile, JSON.stringify(repData, null, 2));
    return newRep;
  } catch (error) {
    logger.error(`Ошибка при обновлении репутации пользователя ${userId}:`, error);
    return null;
  }
}

async function getAllUsersWithReputation() {
  const fs = require('fs');
  const path = require('path');
  try {
    const repDir = path.join(__dirname, 'data', 'user_reputation');
    if (!fs.existsSync(repDir)) return [];
    const files = fs.readdirSync(repDir);
    const users = [];
    for (const file of files) {
      if (file.endsWith('.json')) {
        const userId = file.replace('.json', '');
        const filePath = path.join(repDir, file);
        try {
          const data = fs.readFileSync(filePath, 'utf8');
          const repData = JSON.parse(data);
          const reputation = repData.reputation || 0;
          if (reputation > 0) {
            users.push({ userId: parseInt(userId), reputation: reputation });
          }
        } catch (fileError) {
          logger.error(`Ошибка при чтении файла репутации ${file}:`, fileError);
        }
      }
    }
    users.sort((a, b) => b.reputation - a.reputation);
    return users;
  } catch (error) {
    logger.error('Ошибка при чтении директории репутации:', error);
    return [];
  }
}

async function checkReputationLimit(userId) {
  const fs = require('fs');
  const path = require('path');
  try {
    const limitDir = path.join(__dirname, 'data', 'reputation_limits');
    if (!fs.existsSync(limitDir)) fs.mkdirSync(limitDir, { recursive: true });
    const limitFile = path.join(limitDir, `${userId}.json`);
    if (!fs.existsSync(limitFile)) {
      return { canGive: true, remaining: 2, resetTime: null };
    }
    const data = fs.readFileSync(limitFile, 'utf8');
    const limitData = JSON.parse(data);
    const now = new Date();
    const fiveHoursAgo = new Date(now.getTime() - 5 * 60 * 60 * 1000);
    const recentGives = limitData.gives.filter(give => new Date(give.timestamp) > fiveHoursAgo);
    const remaining = Math.max(0, 2 - recentGives.length);
    const canGive = remaining > 0;
    let resetTime = null;
    if (recentGives.length > 0) {
      const oldestGive = recentGives.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))[0];
      resetTime = new Date(new Date(oldestGive.timestamp).getTime() + 5 * 60 * 60 * 1000);
    }
    return { canGive, remaining, resetTime };
  } catch (error) {
    logger.error(`Ошибка при проверке лимита репутации для ${userId}:`, error);
    return { canGive: true, remaining: 2, resetTime: null };
  }
}

async function recordReputationGive(userId, targetId) {
  const fs = require('fs');
  const path = require('path');
  try {
    const limitDir = path.join(__dirname, 'data', 'reputation_limits');
    if (!fs.existsSync(limitDir)) fs.mkdirSync(limitDir, { recursive: true });
    const limitFile = path.join(limitDir, `${userId}.json`);
    let limitData = { userid: userId, gives: [], takes: [] };
    if (fs.existsSync(limitFile)) {
      const data = fs.readFileSync(limitFile, 'utf8');
      limitData = JSON.parse(data);
      if (!limitData.takes) limitData.takes = [];
    }
    limitData.gives.push({ target: targetId, timestamp: new Date().toISOString() });
    const fiveHoursAgo = new Date(Date.now() - 5 * 60 * 60 * 1000);
    limitData.gives = limitData.gives.filter(give => new Date(give.timestamp) > fiveHoursAgo);
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    limitData.takes = limitData.takes.filter(take => new Date(take.timestamp) > twentyFourHoursAgo);
    fs.writeFileSync(limitFile, JSON.stringify(limitData, null, 2));
    return true;
  } catch (error) {
    logger.error(`Ошибка при записи лимита репутации для ${userId}:`, error);
    return false;
  }
}

async function checkReputationTakeLimit(userId) {
  const fs = require('fs');
  const path = require('path');
  try {
    const limitDir = path.join(__dirname, 'data', 'reputation_limits');
    if (!fs.existsSync(limitDir)) fs.mkdirSync(limitDir, { recursive: true });
    const limitFile = path.join(limitDir, `${userId}.json`);
    if (!fs.existsSync(limitFile)) return { canTake: true, resetTime: null };
    const data = fs.readFileSync(limitFile, 'utf8');
    const limitData = JSON.parse(data);
    if (!limitData.takes) return { canTake: true, resetTime: null };
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentTakes = limitData.takes.filter(take => new Date(take.timestamp) > twentyFourHoursAgo);
    const canTake = recentTakes.length === 0;
    let resetTime = null;
    if (recentTakes.length > 0) {
      const latestTake = recentTakes.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
      resetTime = new Date(new Date(latestTake.timestamp).getTime() + 24 * 60 * 60 * 1000);
    }
    return { canTake, resetTime };
  } catch (error) {
    logger.error(`Ошибка при проверке лимита снятия репутации для ${userId}:`, error);
    return { canTake: true, resetTime: null };
  }
}

async function recordReputationTake(userId, targetId) {
  const fs = require('fs');
  const path = require('path');
  try {
    const limitDir = path.join(__dirname, 'data', 'reputation_limits');
    if (!fs.existsSync(limitDir)) fs.mkdirSync(limitDir, { recursive: true });
    const limitFile = path.join(limitDir, `${userId}.json`);
    let limitData = { userid: userId, gives: [], takes: [] };
    if (fs.existsSync(limitFile)) {
      const data = fs.readFileSync(limitFile, 'utf8');
      limitData = JSON.parse(data);
      if (!limitData.takes) limitData.takes = [];
    }
    limitData.takes.push({ target: targetId, timestamp: new Date().toISOString() });
    const fiveHoursAgo = new Date(Date.now() - 5 * 60 * 60 * 1000);
    limitData.gives = limitData.gives.filter(give => new Date(give.timestamp) > fiveHoursAgo);
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    limitData.takes = limitData.takes.filter(take => new Date(take.timestamp) > twentyFourHoursAgo);
    fs.writeFileSync(limitFile, JSON.stringify(limitData, null, 2));
    return true;
  } catch (error) {
    logger.error(`Ошибка при записи лимита снятия репутации для ${userId}:`, error);
    return false;
  }
}

module.exports = {
  query,
  getUserBalance,
  updateUserBalance,
  getLastDaily,
  setLastDaily,
  getUserBTC,
  updateUserBTC,
  getUserResources,
  updateUserResources,
  exchangeResources,
  getUserVipStatus,
  setUserVipStatus,
  removeUserVipStatus,
  getUserReputation,
  updateUserReputation,
  getAllUsersWithReputation,
  checkReputationLimit,
  recordReputationGive,
  checkReputationTakeLimit,
  recordReputationTake,
  databaseQuery: query
};