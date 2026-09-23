// Пошаговая диагностика команды givezam
const { query } = require('./filedb.js');
const path = require('path');
const fs = require('fs');
const util = require('util');
const databaseQuery = util.promisify(query);

async function debugGivezamStep() {
  console.log('🔍 ПОШАГОВАЯ ДИАГНОСТИКА GIVEZAM');
  
  try {
    const testUserId = 638700620; // @vadimkarpik
    
    // 1. Проверяем исходное состояние файла
    console.log('\n=== ШАГ 1: ИСХОДНОЕ СОСТОЯНИЕ ===');
    const filePath = path.join(__dirname, 'data', 'sysadmins', `${testUserId}.json`);
    if (fs.existsSync(filePath)) {
      const currentData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      console.log('Текущие данные в файле:', currentData);
    } else {
      console.log('Файл не существует');
    }
    
    // 2. Повторяем логику команды givezam
    console.log('\n=== ШАГ 2: ПРОВЕРКА СУЩЕСТВОВАНИЯ ===');
    const checkQuery = `SELECT * FROM sysadmins WHERE userid = ?`;
    const existing = await databaseQuery(checkQuery, [testUserId]);
    console.log('Результат SELECT:', existing);
    
    if (existing.length > 0) {
      console.log('\n=== ШАГ 3: ОБНОВЛЕНИЕ СУЩЕСТВУЮЩЕЙ ЗАПИСИ ===');
      console.log('Выполняем UPDATE запрос...');
      
      // Тестируем UPDATE запрос
      const updateQuery = `UPDATE sysadmins SET access = 3 WHERE userid = ?`;
      console.log('SQL запрос:', updateQuery);
      console.log('Параметры:', [testUserId]);
      
      const updateResult = await databaseQuery(updateQuery, [testUserId]);
      console.log('Результат UPDATE:', updateResult);
    } else {
      console.log('\n=== ШАГ 3: СОЗДАНИЕ НОВОЙ ЗАПИСИ ===');
      const insertQuery = `INSERT INTO sysadmins (userid, access) VALUES (?, 3)`;
      console.log('SQL запрос:', insertQuery);
      console.log('Параметры:', [testUserId]);
      
      const insertResult = await databaseQuery(insertQuery, [testUserId]);
      console.log('Результат INSERT:', insertResult);
    }
    
    // 4. Проверяем состояние файла после операции
    console.log('\n=== ШАГ 4: СОСТОЯНИЕ ПОСЛЕ ОПЕРАЦИИ ===');
    if (fs.existsSync(filePath)) {
      const updatedData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      console.log('Данные в файле после операции:', updatedData);
    } else {
      console.log('Файл все еще не существует');
    }
    
    // 5. Проверяем SELECT запрос после операции
    console.log('\n=== ШАГ 5: SELECT ПОСЛЕ ОПЕРАЦИИ ===');
    const finalCheck = await databaseQuery(checkQuery, [testUserId]);
    console.log('Финальный SELECT:', finalCheck);
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    console.error('Stack:', error.stack);
  }
}

debugGivezamStep().catch(console.error);
