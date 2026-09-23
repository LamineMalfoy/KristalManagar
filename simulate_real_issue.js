// Симуляция точно такой же ситуации как в реальном боте
const { query } = require('./filedb.js');
const path = require('path');
const fs = require('fs');
const util = require('util');
const databaseQuery = util.promisify(query);

async function simulateRealIssue() {
  console.log('🔄 СИМУЛЯЦИЯ РЕАЛЬНОЙ ПРОБЛЕМЫ БОТА');
  
  try {
    const testUserId = 638700620; // @vadimkarpik
    const filePath = path.join(__dirname, 'data', 'sysadmins', `${testUserId}.json`);
    
    // 1. Создаем файл БЕЗ access (как остается после /null в реальном боте)
    console.log('\n=== ШАГ 1: СОЗДАЕМ ФАЙЛ БЕЗ ACCESS ===');
    const fileWithoutAccess = { userid: testUserId };
    fs.writeFileSync(filePath, JSON.stringify(fileWithoutAccess, null, 2));
    console.log('Файл создан:', fileWithoutAccess);
    
    // 2. Проверяем SELECT (что видит givezam.js)
    console.log('\n=== ШАГ 2: ЧТО ВИДИТ GIVEZAM ===');
    const selectResult = await databaseQuery('SELECT * FROM sysadmins WHERE userid = ?', [testUserId]);
    console.log('SELECT результат:', selectResult);
    console.log('selectResult.length:', selectResult.length);
    console.log('Путь команды:', selectResult.length > 0 ? 'UPDATE' : 'INSERT');
    
    // 3. Симулируем логику givezam.js (UPDATE путь)
    console.log('\n=== ШАГ 3: СИМУЛЯЦИЯ GIVEZAM UPDATE ===');
    if (selectResult.length > 0) {
      console.log('Запись существует, выполняем UPDATE...');
      const updateResult = await databaseQuery('UPDATE sysadmins SET access = 3 WHERE userid = ?', [testUserId]);
      console.log('UPDATE результат:', updateResult);
    } else {
      console.log('Записи нет, выполняем INSERT...');
      const insertResult = await databaseQuery('INSERT INTO sysadmins (userid, access) VALUES (?, ?)', [testUserId, 3]);
      console.log('INSERT результат:', insertResult);
    }
    
    // 4. Проверяем что в файле после UPDATE
    console.log('\n=== ШАГ 4: СОДЕРЖИМОЕ ФАЙЛА ПОСЛЕ UPDATE ===');
    if (fs.existsSync(filePath)) {
      const dataAfterUpdate = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      console.log('Данные в файле:', dataAfterUpdate);
      console.log('Есть ли поле access:', 'access' in dataAfterUpdate);
      console.log('Значение access:', dataAfterUpdate.access);
    } else {
      console.log('Файл НЕ СУЩЕСТВУЕТ');
    }
    
    // 5. Проверяем что видит sysadmins.js
    console.log('\n=== ШАГ 5: ЧТО ВИДИТ SYSADMINS ===');
    const allAdmins = await databaseQuery('SELECT userid, access FROM sysadmins ORDER BY access DESC', []);
    console.log('Все администраторы:', allAdmins);
    
    // Эмулируем фильтрацию из sysadmins.js
    const validAdmins = allAdmins.filter(admin => {
      const hasAccess = admin.access !== null && admin.access !== undefined && admin.access > 0;
      console.log(`  Пользователь ${admin.userid}: access=${admin.access}, valid=${hasAccess}`);
      return hasAccess;
    });
    
    console.log('После фильтрации:', validAdmins);
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    console.error('Stack:', error.stack);
  }
}

simulateRealIssue().catch(console.error);
