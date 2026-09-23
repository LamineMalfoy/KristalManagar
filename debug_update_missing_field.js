// Диагностика UPDATE для файла без поля access
const { query } = require('./filedb.js');
const path = require('path');
const fs = require('fs');
const util = require('util');
const databaseQuery = util.promisify(query);

async function debugUpdateMissingField() {
  console.log('🔍 ДИАГНОСТИКА UPDATE ДЛЯ ФАЙЛА БЕЗ ACCESS');
  
  try {
    const testUserId = 638700620; // @vadimkarpik
    const filePath = path.join(__dirname, 'data', 'sysadmins', `${testUserId}.json`);
    
    // 1. Убеждаемся что файл существует без поля access
    console.log('\n=== ШАГ 1: ПОДГОТОВКА ===');
    const fileWithoutAccess = { userid: testUserId };
    fs.writeFileSync(filePath, JSON.stringify(fileWithoutAccess, null, 2));
    console.log('Создан файл без access:', fileWithoutAccess);
    
    // 2. Проверяем SELECT
    console.log('\n=== ШАГ 2: SELECT ЗАПРОС ===');
    const selectResult = await databaseQuery('SELECT * FROM sysadmins WHERE userid = ?', [testUserId]);
    console.log('SELECT результат:', selectResult);
    
    // 3. Выполняем UPDATE (как в givezam)
    console.log('\n=== ШАГ 3: UPDATE ЗАПРОС ===');
    const updateQuery = `UPDATE sysadmins SET access = 3 WHERE userid = ?`;
    console.log('SQL запрос:', updateQuery);
    console.log('Параметры:', [testUserId]);
    
    const updateResult = await databaseQuery(updateQuery, [testUserId]);
    console.log('UPDATE результат:', updateResult);
    
    // 4. Проверяем файл после UPDATE
    console.log('\n=== ШАГ 4: СОСТОЯНИЕ ПОСЛЕ UPDATE ===');
    const dataAfterUpdate = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    console.log('Данные в файле после UPDATE:', dataAfterUpdate);
    
    // 5. Финальный SELECT
    console.log('\n=== ШАГ 5: ФИНАЛЬНЫЙ SELECT ===');
    const finalSelect = await databaseQuery('SELECT * FROM sysadmins WHERE userid = ?', [testUserId]);
    console.log('Финальный SELECT:', finalSelect);
    
    // 6. Проверяем отображение в sysadmins
    console.log('\n=== ШАГ 6: ПРОВЕРКА ОТОБРАЖЕНИЯ ===');
    const allAdmins = await databaseQuery('SELECT userid, access FROM sysadmins ORDER BY access DESC', []);
    console.log('Все администраторы для отображения:', allAdmins);
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    console.error('Stack:', error.stack);
  }
}

debugUpdateMissingField().catch(console.error);
