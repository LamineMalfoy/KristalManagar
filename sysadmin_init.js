const { checkSystemTables } = require('./cmds/sysadmin.js');
const database = require('./databases.js');
const util = require('util');
const databaseQuery = util.promisify(database.query);

async function initSysAdmin() {
  try {
    console.log('Инициализация системы администрирования бота...');
    
     
    const tablesCreated = await checkSystemTables();
    
    if (tablesCreated) {
      console.log('Системные таблицы проверены и готовы к использованию');
      
       
      const foundersQuery = 'SELECT COUNT(*) as count FROM sysadmins WHERE access = 4';
      const foundersResult = await databaseQuery(foundersQuery);
      
      if (foundersResult[0].count === 0) {
        console.log('Основатель не найден. Добавление основателя по умолчанию...');
        
         
        const defaultFounderId = 755536919;  
        
        const insertQuery = 'INSERT INTO sysadmins (userid, access) VALUES (?, 4)';
        await databaseQuery(insertQuery, [defaultFounderId]);
        
        console.log(`Основатель (ID: ${defaultFounderId}) успешно добавлен`);
      } else {
        console.log('Основатель найден в системе');
      }
    } else {
      console.error('Ошибка при инициализации системных таблиц');
    }
  } catch (error) {
    console.error('Ошибка при инициализации системы администрирования:', error);
  }
}

module.exports = { initSysAdmin }; 