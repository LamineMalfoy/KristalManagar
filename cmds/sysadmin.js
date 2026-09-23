const { query } = require('../filedb.js');
const util = require('util');
const databaseQuery = util.promisify(query);

 
async function checkSysAccess(userId) {
  try {
    const query = 'SELECT access FROM sysadmins WHERE userid = ?';
    const results = await databaseQuery(query, [userId]);
    
    if (results && results.length > 0) {
      return results[0].access;
    }
    return 0;  
  } catch (error) {
    console.error('Ошибка при проверке системного доступа:', error);
    return 0;
  }
}

 
async function isSysBanned(userId) {
  try {
    // Исправляем дублированные ID
    const fixDuplicatedId = (idStr) => {
      const str = String(idStr);
      if (str.length > 10) {
        const halfLength = Math.floor(str.length / 2);
        const firstHalf = str.substring(0, halfLength);
        const secondHalf = str.substring(halfLength);
        if (firstHalf === secondHalf) {
          console.log('DEBUG: isSysBanned fixed duplicated ID:', str, '->', firstHalf);
          return parseInt(firstHalf);
        }
      }
      return parseInt(str);
    };
    
    const cleanUserId = fixDuplicatedId(userId);
    console.log('DEBUG: isSysBanned checking for userId:', cleanUserId);
    
    const query = 'SELECT * FROM sysbanned WHERE userid = ?';
    const results = await databaseQuery(query, [cleanUserId]);
    
    if (results && results.length > 0) {
      const banInfo = results[0];
      const currentTime = Math.floor(Date.now() / 1000);
      
      if (banInfo.time !== 0 && currentTime > banInfo.time) {
        await databaseQuery('DELETE FROM sysbanned WHERE userid = ?', [userId]);
        return null;
      }
      
      return banInfo;
    }
    return null;
  } catch (error) {
    console.error('Ошибка при проверке бана пользователя:', error);
    return null;
  }
}

 
function getAccessLevelName(accessLevel) {
  switch (accessLevel) {
    case 1: return 'Агент поддержки';
    case 2: return 'Администрация бота';
    case 3: return 'Заместитель основателя';
    case 4: return 'Основатель';
    case 5: return 'Разработчик';
    default: return 'Пользователь';
  }
}

 
async function checkSystemTables() {
  try {
     
    let query = `
      CREATE TABLE IF NOT EXISTS sysadmins (
        userid INT PRIMARY KEY,
        access INT NOT NULL,
        CONSTRAINT chk_access CHECK (access >= 1 AND access <= 5)
      )
    `;
    await databaseQuery(query);
    
     
    query = `
      CREATE TABLE IF NOT EXISTS sysbanned (
        userid INT PRIMARY KEY,
        time BIGINT NOT NULL,
        reason VARCHAR(255) DEFAULT 'Не указана',
        who INT NOT NULL
      )
    `;
    await databaseQuery(query);
    
     
    query = `
      CREATE TABLE IF NOT EXISTS tickets (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userid INT NOT NULL,
        mess TEXT NOT NULL,
        status BOOLEAN DEFAULT FALSE,
        peer_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    await databaseQuery(query);
    
    return true;
  } catch (error) {
    console.error('Ошибка при проверке системных таблиц:', error);
    return false;
  }
}

 
function canManageAccess(userAccess, targetAccess) {
   
  if (userAccess === 5) return true;
  
   
  if (userAccess === 4 && targetAccess < 5) return true;
  
   
  if (userAccess === 3 && targetAccess <= 2) return true;
  
   
  if (userAccess === 2 && targetAccess === 1) return true;
  
  return false;
}

module.exports = {
  checkSysAccess,
  isSysBanned,
  getAccessLevelName,
  checkSystemTables,
  canManageAccess
}; 