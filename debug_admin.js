// Тестовый скрипт для диагностики проблем с admin командами
const { query } = require('./filedb.js');
const { checkSysAccess, getAccessLevelName } = require('./cmds/sysadmin.js');
const util = require('util');
const databaseQuery = util.promisify(query);

async function testDatabaseConnection() {
  console.log('=== ТЕСТ 1: Подключение к базе данных ===');
  try {
    const result = await databaseQuery('SELECT * FROM sysadmins LIMIT 1', []);
    console.log('✅ База данных работает, результат:', result);
    return true;
  } catch (error) {
    console.log('❌ Ошибка базы данных:', error.message);
    return false;
  }
}

async function testCheckSysAccess() {
  console.log('\n=== ТЕСТ 2: Функция checkSysAccess ===');
  
  // Тестируем с вашим ID
  const testUserId = 694644988; // Замените на ваш реальный ID
  
  try {
    const access = await checkSysAccess(testUserId);
    console.log(`✅ checkSysAccess(${testUserId}) = ${access} (${getAccessLevelName(access)})`);
    return access;
  } catch (error) {
    console.log('❌ Ошибка checkSysAccess:', error.message);
    return 0;
  }
}

async function testDirectQuery() {
  console.log('\n=== ТЕСТ 3: Прямой запрос к sysadmins ===');
  try {
    const result = await databaseQuery('SELECT * FROM sysadmins', []);
    console.log('✅ Все записи в sysadmins:', result);
    return result;
  } catch (error) {
    console.log('❌ Ошибка прямого запроса:', error.message);
    return [];
  }
}

async function testInsertRecord() {
  console.log('\n=== ТЕСТ 4: Вставка тестовой записи ===');
  const testUserId = 123456789;
  
  try {
    // Проверяем существует ли запись
    const existing = await databaseQuery('SELECT * FROM sysadmins WHERE userid = ?', [testUserId]);
    console.log('Существующие записи:', existing);
    
    if (existing.length > 0) {
      // Обновляем
      await databaseQuery('UPDATE sysadmins SET access = 1 WHERE userid = ?', [testUserId]);
      console.log('✅ Запись обновлена');
    } else {
      // Создаем новую
      await databaseQuery('INSERT INTO sysadmins (userid, access) VALUES (?, 1)', [testUserId]);
      console.log('✅ Новая запись создана');
    }
    
    // Проверяем результат
    const result = await databaseQuery('SELECT * FROM sysadmins WHERE userid = ?', [testUserId]);
    console.log('Результат после вставки:', result);
    
    // Удаляем тестовую запись
    await databaseQuery('DELETE FROM sysadmins WHERE userid = ?', [testUserId]);
    console.log('✅ Тестовая запись удалена');
    
    return true;
  } catch (error) {
    console.log('❌ Ошибка вставки:', error.message);
    return false;
  }
}

async function runDiagnostics() {
  console.log('🔍 ДИАГНОСТИКА ADMIN КОМАНД\n');
  
  const dbTest = await testDatabaseConnection();
  const accessTest = await testCheckSysAccess();
  const queryTest = await testDirectQuery();
  const insertTest = await testInsertRecord();
  
  console.log('\n=== РЕЗУЛЬТАТЫ ===');
  console.log('База данных:', dbTest ? '✅' : '❌');
  console.log('checkSysAccess:', accessTest > 0 ? '✅' : '❌');
  console.log('Прямые запросы:', queryTest.length >= 0 ? '✅' : '❌');
  console.log('Вставка записей:', insertTest ? '✅' : '❌');
  
  if (!dbTest) {
    console.log('\n🚨 ПРОБЛЕМА: База данных не работает');
  } else if (accessTest === 0) {
    console.log('\n🚨 ПРОБЛЕМА: У вас нет прав администратора в базе');
    console.log('Добавьте себя в базу данных sysadmins с access = 5');
  } else {
    console.log('\n✅ Все компоненты работают, проблема может быть в другом месте');
  }
}

// Запускаем диагностику
runDiagnostics().catch(console.error);
