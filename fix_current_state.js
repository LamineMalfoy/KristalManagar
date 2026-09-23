// Исправление текущего состояния файлов в реальном боте
const { query } = require('./filedb.js');
const path = require('path');
const fs = require('fs');
const util = require('util');
const databaseQuery = util.promisify(query);

async function fixCurrentState() {
  console.log('🔧 ИСПРАВЛЕНИЕ ТЕКУЩЕГО СОСТОЯНИЯ');
  
  try {
    const testUserId = 638700620; // @vadimkarpik
    const filePath = path.join(__dirname, 'data', 'sysadmins', `${testUserId}.json`);
    
    // 1. Проверяем текущее состояние
    console.log('\n=== ТЕКУЩЕЕ СОСТОЯНИЕ ===');
    if (fs.existsSync(filePath)) {
      const currentData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      console.log('Текущий файл:', currentData);
      
      // 2. Если нет поля access, добавляем его
      if (!('access' in currentData)) {
        console.log('Поле access отсутствует, добавляем...');
        currentData.access = 3; // Заместитель основателя
        fs.writeFileSync(filePath, JSON.stringify(currentData, null, 2));
        console.log('✅ Поле access добавлено:', currentData);
      } else {
        console.log('✅ Поле access уже есть');
      }
    } else {
      console.log('Файл не существует, создаем...');
      const newData = { userid: testUserId, access: 3 };
      fs.writeFileSync(filePath, JSON.stringify(newData, null, 2));
      console.log('✅ Файл создан:', newData);
    }
    
    // 3. Проверяем результат
    console.log('\n=== ПРОВЕРКА РЕЗУЛЬТАТА ===');
    const finalData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    console.log('Финальные данные в файле:', finalData);
    
    // 4. Проверяем через SELECT
    const selectResult = await databaseQuery('SELECT userid, access FROM sysadmins ORDER BY access DESC', []);
    console.log('SELECT результат:', selectResult);
    
    // 5. Проверяем фильтрацию
    const validAdmins = selectResult.filter(admin => {
      return admin.access !== null && admin.access !== undefined && admin.access > 0;
    });
    console.log('После фильтрации (как в /sysadmins):', validAdmins);
    
    console.log('\n🎉 СОСТОЯНИЕ ИСПРАВЛЕНО!');
    console.log('⚠️ ТЕПЕРЬ ПЕРЕЗАПУСТИТЕ БОТА чтобы перезагрузить команды!');
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    console.error('Stack:', error.stack);
  }
}

fixCurrentState().catch(console.error);
