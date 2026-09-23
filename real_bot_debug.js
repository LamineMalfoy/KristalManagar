// Диагностика реального состояния бота
const { query } = require('./filedb.js');
const path = require('path');
const fs = require('fs');
const util = require('util');
const databaseQuery = util.promisify(query);

async function realBotDebug() {
  console.log('🔍 ДИАГНОСТИКА РЕАЛЬНОГО СОСТОЯНИЯ БОТА');
  console.log('Время:', new Date().toLocaleString());
  
  try {
    // 1. Проверяем директорию sysadmins
    console.log('\n=== ДИРЕКТОРИЯ SYSADMINS ===');
    const sysadminsDir = path.join(__dirname, 'data', 'sysadmins');
    if (!fs.existsSync(sysadminsDir)) {
      console.log('❌ Директория sysadmins НЕ СУЩЕСТВУЕТ!');
      return;
    }
    
    const files = fs.readdirSync(sysadminsDir);
    console.log(`Найдено файлов: ${files.length}`);
    
    files.forEach(file => {
      if (file.endsWith('.json')) {
        const filePath = path.join(sysadminsDir, file);
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          const data = JSON.parse(content);
          console.log(`📄 ${file}: `, data);
        } catch (e) {
          console.log(`❌ Ошибка чтения ${file}:`, e.message);
        }
      }
    });
    
    // 2. Проверяем SELECT запросы
    console.log('\n=== SELECT ЗАПРОСЫ ===');
    
    // Все записи
    const allRecords = await databaseQuery('SELECT * FROM sysadmins', []);
    console.log('Все записи в sysadmins:', allRecords);
    
    // Только с access
    const withAccess = await databaseQuery('SELECT userid, access FROM sysadmins WHERE access IS NOT NULL', []);
    console.log('Записи с access:', withAccess);
    
    // Упорядоченные по access
    const ordered = await databaseQuery('SELECT userid, access FROM sysadmins ORDER BY access DESC', []);
    console.log('Упорядоченные по access:', ordered);
    
    // 3. Проверяем конкретного пользователя (замените на нужный ID)
    console.log('\n=== ПРОВЕРКА КОНКРЕТНОГО ПОЛЬЗОВАТЕЛЯ ===');
    const testUserId = 638700620; // @vadimkarpik
    
    const userCheck = await databaseQuery('SELECT * FROM sysadmins WHERE userid = ?', [testUserId]);
    console.log(`Пользователь ${testUserId}:`, userCheck);
    
    const userFilePath = path.join(sysadminsDir, `${testUserId}.json`);
    if (fs.existsSync(userFilePath)) {
      const userFileContent = JSON.parse(fs.readFileSync(userFilePath, 'utf8'));
      console.log(`Файл ${testUserId}.json:`, userFileContent);
    } else {
      console.log(`Файл ${testUserId}.json НЕ СУЩЕСТВУЕТ`);
    }
    
    // 4. Тестируем логику фильтрации из sysadmins.js
    console.log('\n=== ТЕСТ ЛОГИКИ ФИЛЬТРАЦИИ ===');
    const allSysadmins = await databaseQuery('SELECT userid, access FROM sysadmins ORDER BY access DESC', []);
    
    // Эмулируем логику из sysadmins.js
    const validAdmins = allSysadmins.filter(admin => {
      return admin.access !== null && admin.access !== undefined && admin.access > 0;
    });
    
    console.log('После фильтрации (как в sysadmins.js):', validAdmins);
    
  } catch (error) {
    console.error('❌ Ошибка диагностики:', error.message);
    console.error('Stack:', error.stack);
  }
}

realBotDebug().catch(console.error);
