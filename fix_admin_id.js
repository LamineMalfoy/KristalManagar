// Скрипт для исправления дублированного ID в базе sysadmins
const { query } = require('./filedb.js');
const util = require('util');
const databaseQuery = util.promisify(query);

async function fixAdminId() {
  console.log('🔧 ИСПРАВЛЕНИЕ ADMIN ID\n');
  
  try {
    // Показываем текущие записи
    console.log('=== ТЕКУЩИЕ ЗАПИСИ ===');
    const current = await databaseQuery('SELECT * FROM sysadmins', []);
    console.log('Записи:', current);
    
    // Ищем запись с дублированным ID
    const duplicatedId = 694644988694645000;
    const correctId = 694644988;
    
    const duplicatedRecord = await databaseQuery('SELECT * FROM sysadmins WHERE userid = ?', [duplicatedId]);
    console.log('\nЗапись с дублированным ID:', duplicatedRecord);
    
    if (duplicatedRecord.length > 0) {
      // Удаляем неправильную запись
      await databaseQuery('DELETE FROM sysadmins WHERE userid = ?', [duplicatedId]);
      console.log('✅ Удалена запись с дублированным ID');
      
      // Создаем правильную запись
      await databaseQuery('INSERT INTO sysadmins (userid, access) VALUES (?, ?)', [correctId, 5]);
      console.log('✅ Создана запись с правильным ID и access = 5 (разработчик)');
    }
    
    // Показываем результат
    console.log('\n=== РЕЗУЛЬТАТ ===');
    const result = await databaseQuery('SELECT * FROM sysadmins', []);
    console.log('Финальные записи:', result);
    
    // Проверяем доступ
    const { checkSysAccess } = require('./cmds/sysadmin.js');
    const accessLevel = await checkSysAccess(correctId);
    console.log(`\nУровень доступа для ${correctId}: ${accessLevel}`);
    
    console.log('\n🎉 ИСПРАВЛЕНИЕ ЗАВЕРШЕНО!');
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
  }
}

// Запускаем исправление
fixAdminId().catch(console.error);
