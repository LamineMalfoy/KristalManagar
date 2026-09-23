// Диагностика проблемы с отображением в /sysadmins
const { query } = require('./filedb.js');
const path = require('path');
const fs = require('fs');
const util = require('util');
const databaseQuery = util.promisify(query);

async function debugSysadmins() {
  console.log('🔍 ДИАГНОСТИКА SYSADMINS');
  
  try {
    // 1. Проверяем файлы в директории sysadmins
    console.log('\n=== ФАЙЛЫ В ДИРЕКТОРИИ SYSADMINS ===');
    const sysadminsDir = path.join(__dirname, 'data', 'sysadmins');
    const files = fs.readdirSync(sysadminsDir);
    
    files.forEach(file => {
      const filePath = path.join(sysadminsDir, file);
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      console.log(`${file}: ${JSON.stringify(data)}`);
    });
    
    // 2. Проверяем SQL запрос SELECT
    console.log('\n=== РЕЗУЛЬТАТ SQL ЗАПРОСА ===');
    const sqlQuery = 'SELECT userid, access FROM sysadmins ORDER BY access DESC';
    const result = await databaseQuery(sqlQuery, []);
    console.log('Результат запроса:', result);
    
    // 3. Проверяем каждый файл отдельно
    console.log('\n=== ПРОВЕРКА КАЖДОГО ФАЙЛА ===');
    for (const file of files) {
      const userId = file.replace('.json', '');
      const selectResult = await databaseQuery('SELECT * FROM sysadmins WHERE userid = ?', [parseInt(userId)]);
      console.log(`Пользователь ${userId}:`, selectResult);
    }
    
    // 4. Тестируем создание нового администратора
    console.log('\n=== ТЕСТ СОЗДАНИЯ АДМИНИСТРАТОРА ===');
    const testUserId = 999999999;
    
    // Создаем запись заместителя
    await databaseQuery('INSERT INTO sysadmins (userid, access) VALUES (?, ?)', [testUserId, 3]);
    console.log('Создана тестовая запись заместителя');
    
    // Проверяем что запись появилась в SELECT
    const afterInsert = await databaseQuery('SELECT userid, access FROM sysadmins ORDER BY access DESC', []);
    console.log('После вставки:', afterInsert);
    
    // Удаляем тестовую запись
    await databaseQuery('DELETE FROM sysadmins WHERE userid = ?', [testUserId]);
    console.log('Тестовая запись удалена');
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    console.error('Stack:', error.stack);
  }
}

debugSysadmins().catch(console.error);
