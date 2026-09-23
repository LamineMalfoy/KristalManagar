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
  'sysadmins',        // Добавляем таблицу для системных администраторов
  'tech',
  'agents',
  'testers',
  'vip_users',
  'user_balances',    // Для хранения балансов пользователей
  'user_dailies',     // Для ежедневных бонусов
  'casino_games',     // Для истории игр
  'casino_bets',      // Для ставок
  'tickets',          // Для тикетов поддержки
  'report_banned',    // Для заблокированных в системе репортов
  'user_reputation',  // Для хранения репутации пользователей
  'reputation_limits' // Для лимитов выдачи репутации
];

// Создаем директории для каждой "таблицы"
TABLES.forEach(table => {
  const tableDir = path.join(DATA_DIR, table);
  if (!fs.existsSync(tableDir)) {
    fs.mkdirSync(tableDir);
  }
});

// Асинхронные версии функций fs
const readFileAsync = util.promisify(fs.readFile);
const writeFileAsync = util.promisify(fs.writeFile);
const readdirAsync = util.promisify(fs.readdir);
const unlinkAsync = util.promisify(fs.unlink);

/**
 * Обработка SQL-запроса и преобразование его в операции с файлами
 * @param {string} sql - SQL запрос
 * @param {Array|Object} values - Параметры запроса
 * @param {Function} callback - Callback функция
 */
function query(sql, values, callback) {
  // Если values - функция и callback не передан, значит values это callback
  if (typeof values === 'function' && !callback) {
    callback = values;
    values = [];
  }

  // Нормализация значений для совместимости
  if (!Array.isArray(values) && typeof values === 'object') {
    const newValues = [];
    Object.keys(values).forEach(key => {
      // Извлечь индекс или имя параметра из SQL и добавить значение в массив
      const paramIndex = sql.indexOf(`:${key}`);
      if (paramIndex !== -1) {
        newValues.push(values[key]);
      }
    });
    values = newValues;
  }

  // Примитивный парсинг SQL-запроса
  sql = sql.trim().toLowerCase();

  try {
    // INSERT запрос
    if (sql.startsWith('insert into')) {
      handleInsert(sql, values, callback);
    }
    // SELECT запрос
    else if (sql.startsWith('select')) {
      handleSelect(sql, values, callback);
    }
    // UPDATE запрос
    else if (sql.startsWith('update')) {
      handleUpdate(sql, values, callback);
    }
    // DELETE запрос
    else if (sql.startsWith('delete')) {
      handleDelete(sql, values, callback);
    }
    // CREATE TABLE запрос
    else if (sql.startsWith('create table')) {
      // Просто создать директорию, если она еще не существует
      const tableName = extractTableName(sql);
      const tableDir = path.join(DATA_DIR, tableName);
      
      if (!fs.existsSync(tableDir)) {
        fs.mkdirSync(tableDir);
      }
      
      if (callback) callback(null, { affectedRows: 0 });
    }
    // SHOW TABLES запрос
    else if (sql.startsWith('show tables')) {
      fs.readdir(DATA_DIR, (err, files) => {
        if (err) {
          if (callback) callback(err);
          return;
        }
        
        const tables = files.filter(file => 
          fs.statSync(path.join(DATA_DIR, file)).isDirectory()
        ).map(dir => ({ 
          Tables_in_bot_zakaz: dir 
        }));
        
        if (callback) callback(null, tables);
      });
    }
    // Другие запросы
    else {
      if (callback) callback(new Error('Неподдерживаемый запрос: ' + sql));
    }
  } catch (error) {
    logger.error('Ошибка выполнения запроса:', error);
    if (callback) callback(error);
  }
}

/**
 * Обработка INSERT запроса
 */
function handleInsert(sql, values, callback) {
  try {
    const tableName = extractTableName(sql);
    const tableDir = path.join(DATA_DIR, tableName);
    
    // Проверяем существование директории таблицы
    if (!fs.existsSync(tableDir)) {
      fs.mkdirSync(tableDir);
    }

    // Создаем объект данных
    let data = {};
    
    // Если values[0] это объект (для INSERT INTO table SET ?)
    if (values.length > 0 && typeof values[0] === 'object' && !Array.isArray(values[0]) && values[0] !== null) {
      data = values[0];
    } else {
      // Извлекаем поля из запроса
      const fields = extractFields(sql);
      logger.debug('Извлеченные поля:', fields);
      logger.debug('Значения:', values);
      // Создаем объект данных из массива значений
      fields.forEach((field, index) => {
        data[field] = values[index];
      });
    }
    if (!data || typeof data !== 'object') {
      logger.error('Ошибка: data для INSERT не определён или не объект:', data);
      if (callback) callback(new Error('Некорректные данные для INSERT'));
      return;
    }
    
    logger.debug('Созданный объект данных:', data);
    
    // Если есть primary key (user_id или id), используем его как имя файла
    let fileName = '';
    if (tableName === 'tickets') {
      // Для тикетов используем автоинкремент
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
      // Если нет primary key, используем timestamp
      const timestamp = Date.now();
      fileName = `${timestamp}.json`;
    }
    
    const filePath = path.join(tableDir, fileName);
    
    // Проверяем, есть ли ON DUPLICATE KEY UPDATE
    const hasOnDuplicate = sql.includes('on duplicate key update');
    if (hasOnDuplicate) {
      // Если файл существует, читаем его и обновляем
      if (fs.existsSync(filePath)) {
        try {
          let existingData = {};
          const fileContent = fs.readFileSync(filePath, 'utf8');
          existingData = fileContent && fileContent.trim() ? JSON.parse(fileContent) : {};
          // Обновляем только поля, которые есть в data
          Object.keys(data).forEach(key => {
            existingData[key] = data[key];
          });
          data = existingData;
        } catch (error) {
          logger.error('Ошибка при чтении существующего файла:', error);
        }
      }
    }
    
    // Сохраняем данные в файл
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

/**
 * Обработка SELECT запроса
 */
function handleSelect(sql, values, callback) {
  try {
    const tableName = extractTableName(sql);
    const tableDir = path.join(DATA_DIR, tableName);
    
    // Проверяем существование директории таблицы
    if (!fs.existsSync(tableDir)) {
      if (callback) callback(null, []);
      return;
    }

    // Проверяем условие WHERE
    const whereClause = extractWhereClause(sql);
    const conditions = parseWhereConditions(whereClause, values);
    
    fs.readdir(tableDir, (err, files) => {
      if (err) {
        if (callback) callback(err);
        return;
      }
      
      // Массив промисов для чтения файлов
      const readPromises = files.filter(file => file.endsWith('.json'))
        .map(file => {
          const filePath = path.join(tableDir, file);
          return readFileAsync(filePath, 'utf8')
            .then(content => {
              try {
                // Проверяем, что файл не пустой
                if (!content || content.trim() === '') {
                  // Пустой файл - это нормально для новых пользователей
                  return null;
                }
                let data = {};
                try {
                  data = content && content.trim() ? JSON.parse(content) : {};
                } catch { data = {}; }
                return data;
              } catch (e) {
                logger.error(`Ошибка парсинга файла ${filePath}:`, e);
                return null;
              }
            })
            .catch(error => {
              logger.error(`Ошибка чтения файла ${filePath}:`, error);
              return null;
            });
        });
      
      Promise.all(readPromises)
        .then(results => {
          // Защита от null
          const filteredResults = results
            .filter(item => item !== null)
            .filter(item => {
              if (!item) return false;
              if (conditions.length === 0) return true;
              
              // Проверяем каждое условие
              return conditions.every(condition => {
                const { field, operator, value } = condition;
                
                // Если поле не существует в записи
                if (!(field in item)) return false;
                
                // Защита от null/undefined
                const fieldValue = item[field];
                if (fieldValue === null || fieldValue === undefined) {
                  return operator === '!=' || operator === '<>'; // Только неравенство вернет true для null
                }
                
                switch (operator) {
                  case '=':
                    if (field === 'status') {
                      return fieldValue === value;
                    }
                    if (field === 'user_id' || field === 'role_id') {
                      return (String(fieldValue) == String(value)) || (Number(fieldValue) === Number(value));
                    }
                    return fieldValue == value;
                  case '!=':
                    if (field === 'status') {
                      return fieldValue !== value;
                    }
                    if (field === 'user_id' || field === 'role_id') {
                      return (String(fieldValue) != String(value)) && (Number(fieldValue) !== Number(value));
                    }
                    return fieldValue != value;
                  case '>':
                    return Number(fieldValue) > Number(value);
                  case '<':
                    return Number(fieldValue) < Number(value);
                  case '>=':
                    return Number(fieldValue) >= Number(value);
                  case '<=':
                    return Number(fieldValue) <= Number(value);
                  case 'LIKE':
                    if (typeof value !== 'string') return false;
                    const regex = new RegExp(value.replace(/%/g, '.*'));
                    return regex.test(String(fieldValue));
                  default:
                    return false;
                }
              });
            });
          
          if (callback) callback(null, filteredResults);
        })
        .catch(error => {
          logger.error('Ошибка при обработке файлов:', error);
          if (callback) callback(error);
        });
    });
  } catch (error) {
    logger.error('Ошибка при SELECT:', error);
    if (callback) callback(error);
  }
}

/**
 * Обработка UPDATE запроса
 */
function handleUpdate(sql, values, callback) {
  try {
    const tableName = extractTableName(sql);
    const tableDir = path.join(DATA_DIR, tableName);
    
    // Проверяем существование директории таблицы
    if (!fs.existsSync(tableDir)) {
      if (callback) callback(null, { affectedRows: 0 });
      return;
    }

    // Извлекаем поля и значения из SET
    const setClause = extractSetClause(sql);
    const fieldsToUpdate = parseSetClause(setClause);
    
    // Получаем значения для обновления из параметров
    let updateValues = [];
    let whereValues = [];
    
    if (values.length > 0 && typeof values[0] === 'object' && !Array.isArray(values[0])) {
      // Если values[0] это объект, используем его
      const updateData = values[0];
      fieldsToUpdate.forEach(field => {
        if (field.value === null) {
          // Для параметризованных полей берем значение из объекта
          field.value = updateData[field.name];
        }
        // Для литеральных значений оставляем как есть
      });
      whereValues = values.slice(1); // Остальные значения для WHERE
    } else {
      // Иначе используем массив значений
      // Считаем количество параметризованных полей (value === null)
      const parameterizedFieldCount = fieldsToUpdate.filter(field => field.value === null).length;
      
      updateValues = values.slice(0, parameterizedFieldCount);
      whereValues = values.slice(parameterizedFieldCount);
      
      let paramIndex = 0;
      fieldsToUpdate.forEach((field) => {
        if (field.value === null) {
          // Параметризованное поле - берем значение из параметров
          field.value = updateValues[paramIndex++];
        }
        // Литеральные поля уже содержат правильные значения
      });
    }
    
    logger.debug('Поля для обновления:', fieldsToUpdate);
    logger.debug('Значения для WHERE:', whereValues);
    
    // Проверяем условие WHERE
    const whereClause = extractWhereClause(sql);
    const conditions = parseWhereConditions(whereClause, whereValues);
    
    fs.readdir(tableDir, (err, files) => {
      if (err) {
        if (callback) callback(err);
        return;
      }
      
      const updatePromises = files.filter(file => file.endsWith('.json'))
        .map(file => {
          const filePath = path.join(tableDir, file);
          return readFileAsync(filePath, 'utf8')
            .then(content => {
              try {
                // Проверяем, что файл не пустой
                if (!content || content.trim() === '') {
                  logger.error(`Файл ${filePath} пустой`);
                  return false;
                }
                let data = {};
                try {
                  data = content && content.trim() ? JSON.parse(content) : {};
                } catch { data = {}; }
                
                // Проверяем, соответствует ли запись условиям WHERE
                const shouldUpdate = conditions.every(condition => {
                  const { field, operator, value } = condition;
                  // Если поле не существует в записи
                  if (!(field in data)) {
                    logger.debug(`Поле ${field} не найдено в записи:`, data);
                    return false;
                  }
                  
                  // Защита от null/undefined
                  const fieldValue = data[field];
                  if (fieldValue === null || fieldValue === undefined) {
                    logger.debug(`Значение поля ${field} равно null или undefined`);
                    return operator === '!=' || operator === '<>'; // Только неравенство вернет true для null
                  }
                  
                  let result = false;
                  let compareValue = value;
                  // Для role_id и user_id сравниваем и как строки, и как числа
                  if (field === 'user_id' || field === 'role_id') {
                    switch (operator) {
                      case '=':
                        result = (String(fieldValue) == String(compareValue)) || (Number(fieldValue) === Number(compareValue));
                        break;
                      case '!=':
                        result = (String(fieldValue) != String(compareValue)) && (Number(fieldValue) !== Number(compareValue));
                        break;
                      default:
                        // Для других операторов оставляем стандартную обработку ниже
                        break;
                    }
                  }
                  if (operator === '=' && (field === 'user_id' || field === 'role_id')) {
                    // Уже обработали выше
                  } else {
                    switch (operator) {
                      case '=':
                        result = String(fieldValue) == String(compareValue);
                        break;
                      case '!=':
                        result = String(fieldValue) != String(compareValue);
                        break;
                      case '>':
                        result = Number(fieldValue) > Number(compareValue);
                        break;
                      case '<':
                        result = Number(fieldValue) < Number(compareValue);
                        break;
                      case '>=':
                        result = Number(fieldValue) >= Number(compareValue);
                        break;
                      case '<=':
                        result = Number(fieldValue) <= Number(compareValue);
                        break;
                      case 'LIKE':
                        if (typeof value !== 'string') return false;
                        const regex = new RegExp(value.replace(/%/g, '.*'));
                        result = regex.test(String(fieldValue));
                        break;
                      default:
                        return false;
                    }
                  }
                  logger.debug(`Проверка условия: ${field} ${operator} ${compareValue} = ${result} (значение в данных: ${fieldValue})`);
                  return result;
                });
                
                logger.debug(`Файл ${file} должен обновляться: ${shouldUpdate}`);
                
                if (shouldUpdate) {
                  // Обновляем поля
                  fieldsToUpdate.forEach(field => {
                    // Приведение типа для булевых значений
                    if (typeof data[field.name] === 'boolean') {
                      data[field.name] = Boolean(field.value === true || field.value === 'true' || field.value === 1 || field.value === '1');
                    } else {
                      data[field.name] = field.value;
                    }
                  });
                  // Сохраняем обновленные данные
                  return writeFileAsync(filePath, JSON.stringify(data, null, 2))
                    .then(() => {
                      logger.debug(`Файл ${file} успешно обновлен`);
                      return true;
                    }); // Запись обновлена
                }
                
                return false; // Запись не соответствует условию
              } catch (e) {
                logger.error(`Ошибка парсинга файла ${filePath}:`, e);
                return false;
              }
            })
            .catch(error => {
              logger.error(`Ошибка чтения файла ${filePath}:`, error);
              return false;
            });
        });
      
      Promise.all(updatePromises)
        .then(results => {
          // Защита от null
          const safeResults = results.filter(result => result);
          const affectedRows = safeResults.length;
          if (callback) callback(null, { affectedRows });
        })
        .catch(error => {
          logger.error('Ошибка при обновлении файлов:', error);
          if (callback) callback(error);
        });
    });
  } catch (error) {
    logger.error('Ошибка при UPDATE:', error);
    if (callback) callback(error);
  }
}

/**
 * Обработка DELETE запроса
 */
function handleDelete(sql, values, callback) {
  try {
    const tableName = extractTableName(sql);
    const tableDir = path.join(DATA_DIR, tableName);
    
    // Проверяем существование директории таблицы
    if (!fs.existsSync(tableDir)) {
      if (callback) callback(null, { affectedRows: 0 });
      return;
    }

    // Проверяем условие WHERE
    const whereClause = extractWhereClause(sql);
    const conditions = parseWhereConditions(whereClause, values);
    
    fs.readdir(tableDir, (err, files) => {
      if (err) {
        if (callback) callback(err);
        return;
      }
      
      const deletePromises = files.filter(file => file.endsWith('.json'))
        .map(file => {
          const filePath = path.join(tableDir, file);
          return readFileAsync(filePath, 'utf8')
            .then(content => {
              try {
                let data = {};
                try {
                  data = content && content.trim() ? JSON.parse(content) : {};
                } catch { data = {}; }
                
                // Проверяем, соответствует ли запись условиям WHERE
                const shouldDelete = conditions.every(condition => {
                  const { field, operator, value } = condition;
                  
                  // Если поле не существует в записи
                  if (!(field in data)) return false;
                  
                  // Защита от null/undefined
                  const fieldValue = data[field];
                  if (fieldValue === null || fieldValue === undefined) {
                    return operator === '!=' || operator === '<>'; // Только неравенство вернет true для null
                  }
                  
                  switch (operator) {
                    case '=':
                      if (field === 'user_id' || field === 'role_id') {
                        return (String(fieldValue) == String(value)) || (Number(fieldValue) === Number(value));
                      }
                      return fieldValue == value;
                    case '!=':
                      if (field === 'user_id' || field === 'role_id') {
                        return (String(fieldValue) != String(value)) && (Number(fieldValue) !== Number(value));
                      }
                      return fieldValue != value;
                    case '>':
                      return Number(fieldValue) > Number(value);
                    case '<':
                      return Number(fieldValue) < Number(value);
                    case '>=':
                      return Number(fieldValue) >= Number(value);
                    case '<=':
                      return Number(fieldValue) <= Number(value);
                    case 'LIKE':
                      if (typeof value !== 'string') return false;
                      const regex = new RegExp(value.replace(/%/g, '.*'));
                      return regex.test(String(fieldValue));
                    default:
                      return false;
                  }
                });
                
                if (shouldDelete) {
                  // Удаляем файл
                  return unlinkAsync(filePath)
                    .then(() => true); // Запись удалена
                }
                
                return false; // Запись не соответствует условию
              } catch (e) {
                logger.error(`Ошибка парсинга файла ${filePath}:`, e);
                return false;
              }
            })
            .catch(error => {
              logger.error(`Ошибка чтения файла ${filePath}:`, error);
              return false;
            });
        });
      
      Promise.all(deletePromises)
        .then(results => {
          // Защита от null
          const safeResults = results.filter(result => result);
          const affectedRows = safeResults.length;
          if (callback) callback(null, { affectedRows });
        })
        .catch(error => {
          logger.error('Ошибка при удалении файлов:', error);
          if (callback) callback(error);
        });
    });
  } catch (error) {
    logger.error('Ошибка при DELETE:', error);
    if (callback) callback(error);
  }
}

/**
 * Вспомогательные функции для работы с SQL
 */

// Извлечение имени таблицы из SQL запроса
function extractTableName(sql) {
  let match;

  // Для INSERT запросов
  if (sql.startsWith('insert into')) {
    match = sql.match(/insert\s+into\s+`?(\w+)`?\s/i);
  }
  // Для SELECT запросов
  else if (sql.startsWith('select')) {
    match = sql.match(/from\s+`?(\w+)`?/i);
  }
  // Для UPDATE запросов
  else if (sql.startsWith('update')) {
    match = sql.match(/update\s+`?(\w+)`?\s/i);
  }
  // Для DELETE запросов
  else if (sql.startsWith('delete')) {
    match = sql.match(/from\s+`?(\w+)`?\s/i);
  }
  // Для CREATE TABLE запросов
  else if (sql.startsWith('create table')) {
    match = sql.match(/create\s+table\s+(?:if\s+not\s+exists\s+)?`?(\w+)`?/i);
  }

  return match && match[1] ? match[1] : '';
}

// Извлечение полей из INSERT запроса
function extractFields(sql) {
  // Для запросов типа INSERT INTO table SET ?
  if (sql.includes('set ?')) {
    // В этом случае поля будут в объекте values[0]
    return [];
  }
  
  const match = sql.match(/\(([^)]+)\)\s+values\s*\(/i);
  if (!match || !match[1]) return [];
  
  return match[1].split(',')
    .map(field => field.trim().replace(/`/g, ''))
    .filter(field => field.length > 0);
}

// Извлечение условия WHERE из запроса
function extractWhereClause(sql) {
  const match = sql.match(/where\s+(.+?)(?:$|order\s+by|group\s+by|having|limit|offset)/i);
  return match && match[1] ? match[1].trim() : '';
}

// Парсинг условий WHERE
function parseWhereConditions(whereClause, values) {
  if (!whereClause) return [];
  // Разбиваем условия по AND
  const conditions = whereClause.split(/\s+and\s+/i).map((cond, idx) => {
    const match = cond.match(/([\w_]+)\s*(=|!=|>|<|>=|<=|LIKE)\s*\?/i);
    if (!match) return null;
    let value = values[idx];
    // Специальная обработка для булевых значений
    if (match[1] === 'status') {
      if (value === false || value === 'false' || value === 0 || value === '0') value = false;
      if (value === true || value === 'true' || value === 1 || value === '1') value = true;
    }
    return {
      field: match[1],
      operator: match[2],
      value: value
    };
  }).filter(Boolean);
  return conditions;
}

// Извлечение SET клаузы из UPDATE запроса
function extractSetClause(sql) {
  const match = sql.match(/set\s+(.+?)(?:\s+where|$)/i);
  return match && match[1] ? match[1].trim() : '';
}

// Парсинг SET клаузы
function parseSetClause(setClause) {
  if (!setClause) return [];
  
  const fields = [];
  
  // Разбиваем SET клаузу на отдельные части по запятой
  const setParts = setClause.split(',').map(part => part.trim());
  
  setParts.forEach(part => {
    // Ищем сначала параметризованные запросы с ?
    let assignMatch = part.match(/(\w+)\s*=\s*\?/i);
    if (assignMatch) {
      fields.push({
        name: assignMatch[1],
        value: null // Значение будет установлено позже
      });
    } else {
      // Ищем литеральные значения (числа, строки)
      assignMatch = part.match(/(\w+)\s*=\s*([\d]+|'[^']*'|"[^"]*")/i);
      if (assignMatch) {
        let value = assignMatch[2];
        // Убираем кавычки для строк и преобразуем числа
        if (value.startsWith("'") || value.startsWith('"')) {
          value = value.slice(1, -1); // Убираем кавычки
        } else if (/^\d+$/.test(value)) {
          value = parseInt(value); // Преобразуем в число
        }
        
        fields.push({
          name: assignMatch[1],
          value: value
        });
      }
    }
  });
  
  return fields;
}

// Функции для работы с балансом
async function getUserBalance(userId) {
  try {
    const filePath = path.join(DATA_DIR, 'user_balances', `${userId}.json`);
    if (!fs.existsSync(filePath)) {
      // Создаем новый баланс для пользователя
      await writeFileAsync(filePath, JSON.stringify({ balance: 10000, btc: 0 }));
      return 10000;
    }
    const data = JSON.parse(await readFileAsync(filePath));
    return data.balance;
  } catch (error) {
    logger.error('Ошибка при получении баланса:', error);
    return 10000; // Возвращаем начальный баланс в случае ошибки
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

// Функции для работы с ежедневными бонусами
async function getLastDaily(userId) {
  try {
    const filePath = path.join(DATA_DIR, 'user_dailies', `${userId}.json`);
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const raw = JSON.parse(await readFileAsync(filePath));
    // Поддержка старых и новых схем полей
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
    // Записываем оба поля для совместимости
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

// Функции для работы с BTC балансом
async function getUserBTC(userId) {
  const filePath = path.join(DATA_DIR, 'user_balances', `${userId}.json`);
  
  try {
    if (!fs.existsSync(filePath)) {
      return 0;
    }
    
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
    // Убеждаемся что папка существует
    if (!fs.existsSync(balanceDir)) {
      fs.mkdirSync(balanceDir, { recursive: true });
    }
    
    let balance = { userId: userId, dollars: 0, btc: 0 };
    
    // Читаем текущий баланс, если файл существует
    if (fs.existsSync(filePath)) {
      const data = await readFileAsync(filePath, 'utf8');
      balance = JSON.parse(data);
    }
    
    // Устанавливаем новый BTC баланс
    balance.btc = newAmount;
    
    // Сохраняем обновленный баланс
    await writeFileAsync(filePath, JSON.stringify(balance, null, 2));
    
    return newAmount;
  } catch (error) {
    logger.error('Ошибка при обновлении BTC баланса:', error);
    throw error;
  }
}

// Функция для получения ресурсов пользователя
async function getUserResources(userId) {
  const fs = require('fs');
  const path = require('path');
  
  try {
    const resourcesDir = path.join(__dirname, 'data', 'user_resources');
    
    // Создаем директорию если её нет
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
    
    return {
      stone: 0,
      coal: 0,
      iron: 0,
      gold: 0,
      diamond: 0
    };
  } catch (error) {
    logger.error(`Ошибка при получении ресурсов пользователя ${userId}:`, error);
    return {
      stone: 0,
      coal: 0,
      iron: 0,
      gold: 0,
      diamond: 0
    };
  }
}

// Функция для обновления ресурсов пользователя
async function updateUserResources(userId, resourceType, amount) {
  const fs = require('fs');
  const path = require('path');
  
  try {
    const resourcesDir = path.join(__dirname, 'data', 'user_resources');
    
    // Создаем директорию если её нет
    if (!fs.existsSync(resourcesDir)) {
      fs.mkdirSync(resourcesDir, { recursive: true });
    }
    
    const filePath = path.join(resourcesDir, `${userId}.json`);
    
    // Получаем текущие ресурсы
    let resources = {
      stone: 0,
      coal: 0,
      iron: 0,
      gold: 0,
      diamond: 0
    };
    
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      resources = { ...resources, ...JSON.parse(data) };
    }
    
    // Обновляем конкретный ресурс
    if (resources.hasOwnProperty(resourceType)) {
      resources[resourceType] = Math.max(0, resources[resourceType] + amount);
    }
    
    // Сохраняем обновленные ресурсы
    fs.writeFileSync(filePath, JSON.stringify(resources, null, 2));
    
    return true;
  } catch (error) {
    logger.error(`Ошибка при обновлении ресурсов пользователя ${userId}:`, error);
    return false;
  }
}

// Функция для обмена ресурсов на деньги
async function exchangeResources(userId, resourceType, amount) {
  try {
    const resources = await getUserResources(userId);
    
    if (!resources.hasOwnProperty(resourceType)) {
      return { success: false, error: 'Неизвестный тип ресурса' };
    }
    
    if (resources[resourceType] < amount) {
      return { 
        success: false, 
        error: `У вас недостаточно ресурса "${resourceType}". Доступно: ${resources[resourceType]}` 
      };
    }
    
    // Курсы обмена ресурсов на доллары
    const exchangeRates = {
      stone: 180,    // Камень - 180$ за штуку
      coal: 230,     // Уголь - 230$ за штуку
      iron: 350,     // Железо - 350$ за штуку
      gold: 500,     // Золото - 500$ за штуку
      diamond: 1000  // Алмаз - 1000$ за штуку
    };
    
    const totalMoney = amount * exchangeRates[resourceType];
    
    // Убираем ресурсы
    const updateResult = await updateUserResources(userId, resourceType, -amount);
    if (!updateResult) {
      return { success: false, error: 'Ошибка при обновлении ресурсов' };
    }
    
    // Добавляем деньги
    const currentBalance = await getUserBalance(userId);
    const balanceResult = await updateUserBalance(userId, currentBalance + totalMoney);
    if (!balanceResult) {
      // Откатываем изменения ресурсов
      await updateUserResources(userId, resourceType, amount);
      return { success: false, error: 'Ошибка при обновлении баланса' };
    }
    
    return {
      success: true,
      resourceType,
      amount,
      totalMoney,
      rate: exchangeRates[resourceType]
    };
  } catch (error) {
    logger.error(`Ошибка при обмене ресурсов пользователя ${userId}:`, error);
    return { success: false, error: 'Произошла ошибка при обмене' };
  }
}

function getUserVipStatus(userId) {
  const vipFilePath = path.join(__dirname, 'data', 'vip_users', `${userId}.json`);
  
  if (!fs.existsSync(vipFilePath)) {
    return null;
  }
  
  try {
    const vipData = JSON.parse(fs.readFileSync(vipFilePath, 'utf8'));
    
    // Проверяем, не истек ли VIP статус
    if (!vipData.is_permanent && vipData.expiry_date) {
      const now = new Date();
      const expiry = new Date(vipData.expiry_date);
      
      if (now > expiry) {
        // VIP статус истек, удаляем файл
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

// Функции кэширования информации о пригласивших
function getInviterInfo(peerId, userId) {
  const cacheDir = path.join(__dirname, 'data', 'inviter_cache');
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }
  
  const cacheFilePath = path.join(cacheDir, `${peerId}_${userId}.json`);
  
  if (!fs.existsSync(cacheFilePath)) {
    return null;
  }
  
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
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }
  
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

// Функция для установки VIP статуса (используется в givevip.js)
async function setUserVipStatus(userId, expiryDate, grantedBy, isPermanent = false) {
  const fs = require('fs');
  const path = require('path');
  
  try {
    const vipDir = path.join(__dirname, 'data', 'vip_users');
    
    // Создаем директорию если её нет
    if (!fs.existsSync(vipDir)) {
      fs.mkdirSync(vipDir, { recursive: true });
    }
    
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

// Функция для удаления VIP статуса (используется в removevip.js)
async function removeUserVipStatus(userId) {
  const fs = require('fs');
  const path = require('path');
  
  try {
    const vipFile = path.join(__dirname, 'data', 'vip_users', `${userId}.json`);
    
    if (fs.existsSync(vipFile)) {
      fs.unlinkSync(vipFile);
      return true;
    }
    
    return false; // Файл не существовал
  } catch (error) {
    logger.error(`Ошибка при удалении VIP статуса пользователя ${userId}:`, error);
    return false;
  }
}

// Функция для получения репутации пользователя
async function getUserReputation(userId) {
  const fs = require('fs');
  const path = require('path');
  
  try {
    const repFile = path.join(__dirname, 'data', 'user_reputation', `${userId}.json`);
    
    if (!fs.existsSync(repFile)) {
      return 0; // Если файла нет, репутация = 0
    }
    
    const data = fs.readFileSync(repFile, 'utf8');
    const repData = JSON.parse(data);
    return repData.reputation || 0;
  } catch (error) {
    logger.error(`Ошибка при получении репутации пользователя ${userId}:`, error);
    return 0;
  }
}

// Функция для обновления репутации пользователя
async function updateUserReputation(userId, change, grantedBy = null) {
  const fs = require('fs');
  const path = require('path');
  
  try {
    const repDir = path.join(__dirname, 'data', 'user_reputation');
    if (!fs.existsSync(repDir)) {
      fs.mkdirSync(repDir, { recursive: true });
    }
    
    const repFile = path.join(repDir, `${userId}.json`);
    let currentRep = 0;
    let repData = {
      userid: userId,
      reputation: 0,
      last_updated: new Date().toISOString(),
      history: []
    };
    
    // Читаем существующие данные
    if (fs.existsSync(repFile)) {
      const data = fs.readFileSync(repFile, 'utf8');
      repData = JSON.parse(data);
      currentRep = repData.reputation || 0;
    }
    
    // Обновляем репутацию
    const newRep = Math.max(0, currentRep + change); // Не даем репутации стать отрицательной
    repData.reputation = newRep;
    repData.last_updated = new Date().toISOString();
    
    // Добавляем запись в историю
    if (!repData.history) repData.history = [];
    repData.history.push({
      change: change,
      granted_by: grantedBy,
      timestamp: new Date().toISOString(),
      new_total: newRep
    });
    
    // Оставляем только последние 50 записей истории
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

// Функция для получения всех пользователей с репутацией для топа
async function getAllUsersWithReputation() {
  const fs = require('fs');
  const path = require('path');
  
  try {
    const repDir = path.join(__dirname, 'data', 'user_reputation');
    
    if (!fs.existsSync(repDir)) {
      return [];
    }
    
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
            users.push({
              userId: parseInt(userId),
              reputation: reputation
            });
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

// Функция для проверки лимита выдачи репутации (2 репа в 5 часов)
async function checkReputationLimit(userId) {
  const fs = require('fs');
  const path = require('path');
  
  try {
    const limitDir = path.join(__dirname, 'data', 'reputation_limits');
    if (!fs.existsSync(limitDir)) {
      fs.mkdirSync(limitDir, { recursive: true });
    }
    
    const limitFile = path.join(limitDir, `${userId}.json`);
    
    if (!fs.existsSync(limitFile)) {
      return { canGive: true, remaining: 2, resetTime: null };
    }
    
    const data = fs.readFileSync(limitFile, 'utf8');
    const limitData = JSON.parse(data);
    
    const now = new Date();
    const fiveHoursAgo = new Date(now.getTime() - 5 * 60 * 60 * 1000); // 5 часов назад
    
    // Фильтруем записи за последние 5 часов
    const recentGives = limitData.gives.filter(give => new Date(give.timestamp) > fiveHoursAgo);
    
    const remaining = Math.max(0, 2 - recentGives.length);
    const canGive = remaining > 0;
    
    // Время сброса лимита (самая старая запись + 5 часов)
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

// Функция для записи выдачи репутации в лимиты
async function recordReputationGive(userId, targetId) {
  const fs = require('fs');
  const path = require('path');
  
  try {
    const limitDir = path.join(__dirname, 'data', 'reputation_limits');
    if (!fs.existsSync(limitDir)) {
      fs.mkdirSync(limitDir, { recursive: true });
    }
    
    const limitFile = path.join(limitDir, `${userId}.json`);
    let limitData = {
      userid: userId,
      gives: [],
      takes: []
    };
    
    // Читаем существующие данные
    if (fs.existsSync(limitFile)) {
      const data = fs.readFileSync(limitFile, 'utf8');
      limitData = JSON.parse(data);
      if (!limitData.takes) limitData.takes = [];
    }
    
    // Добавляем новую запись
    limitData.gives.push({
      target: targetId,
      timestamp: new Date().toISOString()
    });
    
    // Очищаем старые записи (старше 5 часов)
    const fiveHoursAgo = new Date(Date.now() - 5 * 60 * 60 * 1000);
    limitData.gives = limitData.gives.filter(give => new Date(give.timestamp) > fiveHoursAgo);
    
    // Очищаем старые записи снятия репутации (старше 24 часов)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    limitData.takes = limitData.takes.filter(take => new Date(take.timestamp) > twentyFourHoursAgo);
    
    fs.writeFileSync(limitFile, JSON.stringify(limitData, null, 2));
    return true;
  } catch (error) {
    logger.error(`Ошибка при записи лимита репутации для ${userId}:`, error);
    return false;
  }
}

// Функция для проверки лимита снятия репутации (1 раз в 24 часа)
async function checkReputationTakeLimit(userId) {
  const fs = require('fs');
  const path = require('path');
  
  try {
    const limitDir = path.join(__dirname, 'data', 'reputation_limits');
    if (!fs.existsSync(limitDir)) {
      fs.mkdirSync(limitDir, { recursive: true });
    }
    
    const limitFile = path.join(limitDir, `${userId}.json`);
    
    if (!fs.existsSync(limitFile)) {
      return { canTake: true, resetTime: null };
    }
    
    const data = fs.readFileSync(limitFile, 'utf8');
    const limitData = JSON.parse(data);
    
    if (!limitData.takes) {
      return { canTake: true, resetTime: null };
    }
    
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    // Фильтруем записи за последние 24 часа
    const recentTakes = limitData.takes.filter(take => new Date(take.timestamp) > twentyFourHoursAgo);
    
    const canTake = recentTakes.length === 0;
    
    // Время сброса лимита (последняя запись + 24 часа)
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

// Функция для записи снятия репутации в лимиты
async function recordReputationTake(userId, targetId) {
  const fs = require('fs');
  const path = require('path');
  
  try {
    const limitDir = path.join(__dirname, 'data', 'reputation_limits');
    if (!fs.existsSync(limitDir)) {
      fs.mkdirSync(limitDir, { recursive: true });
    }
    
    const limitFile = path.join(limitDir, `${userId}.json`);
    let limitData = {
      userid: userId,
      gives: [],
      takes: []
    };
    
    // Читаем существующие данные
    if (fs.existsSync(limitFile)) {
      const data = fs.readFileSync(limitFile, 'utf8');
      limitData = JSON.parse(data);
      if (!limitData.takes) limitData.takes = [];
    }
    
    // Добавляем новую запись
    limitData.takes.push({
      target: targetId,
      timestamp: new Date().toISOString()
    });
    
    // Очищаем старые записи выдачи (старше 5 часов)
    const fiveHoursAgo = new Date(Date.now() - 5 * 60 * 60 * 1000);
    limitData.gives = limitData.gives.filter(give => new Date(give.timestamp) > fiveHoursAgo);
    
    // Очищаем старые записи снятия (старше 24 часов)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    limitData.takes = limitData.takes.filter(take => new Date(take.timestamp) > twentyFourHoursAgo);
    
    fs.writeFileSync(limitFile, JSON.stringify(limitData, null, 2));
    return true;
  } catch (error) {
    logger.error(`Ошибка при записи лимита снятия репутации для ${userId}:`, error);
    return false;
  }
}

// Экспортируем функции
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
  databaseQuery: query // Добавляем алиас для совместимости
};