// Диагностика проблемы с null и insert
const { query } = require('./filedb.js');
const path = require('path');
const fs = require('fs');
const util = require('util');
const databaseQuery = util.promisify(query);

async function debugNullInsert() {
  console.log('🔍 ДИАГНОСТИКА NULL + INSERT');
  
  try {
    const testUserId = 638700620; // @vadimkarpik
    const filePath = path.join(__dirname, 'data', 'sysadmins', `${testUserId}.json`);
    
    // 1. Проверяем исходное состояние
    console.log('\n=== ШАГ 1: ИСХОДНОЕ СОСТОЯНИЕ ===');
    if (fs.existsSync(filePath)) {
      const currentData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      console.log('Файл существует:', currentData);
    } else {
      console.log('Файл НЕ существует');
    }
    
    // 2. Проверяем SELECT запрос
    console.log('\n=== ШАГ 2: SELECT ЗАПРОС ===');
    const selectResult = await databaseQuery('SELECT * FROM sysadmins WHERE userid = ?', [testUserId]);
    console.log('Результат SELECT:', selectResult);
    
    // 3. Симулируем INSERT (как в givezam)
    console.log('\n=== ШАГ 3: INSERT ЗАПРОС ===');
    if (selectResult.length === 0) {
      console.log('Записи нет, выполняем INSERT...');
      const insertQuery = `INSERT INTO sysadmins (userid, access) VALUES (?, ?)`;
      console.log('SQL запрос:', insertQuery);
      console.log('Параметры:', [testUserId, 3]);
      
      const insertResult = await databaseQuery(insertQuery, [testUserId, 3]);
      console.log('Результат INSERT:', insertResult);
    } else {
      console.log('Запись уже существует, INSERT не нужен');
    }
    
    // 4. Проверяем состояние после INSERT
    console.log('\n=== ШАГ 4: СОСТОЯНИЕ ПОСЛЕ INSERT ===');
    if (fs.existsSync(filePath)) {
      const finalData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      console.log('Данные в файле после INSERT:', finalData);
    } else {
      console.log('Файл все еще НЕ существует после INSERT');
    }
    
    // 5. Финальный SELECT
    console.log('\n=== ШАГ 5: ФИНАЛЬНЫЙ SELECT ===');
    const finalSelect = await databaseQuery('SELECT * FROM sysadmins WHERE userid = ?', [testUserId]);
    console.log('Финальный SELECT:', finalSelect);
    
    // 6. Проверяем все файлы в директории
    console.log('\n=== ШАГ 6: ВСЕ ФАЙЛЫ В SYSADMINS ===');
    const sysadminsDir = path.join(__dirname, 'data', 'sysadmins');
    const files = fs.readdirSync(sysadminsDir);
    files.forEach(file => {
      const fileData = JSON.parse(fs.readFileSync(path.join(sysadminsDir, file), 'utf8'));
      console.log(`${file}:`, fileData);
    });
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    console.error('Stack:', error.stack);
  }
}

debugNullInsert().catch(console.error);
