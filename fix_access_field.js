// Прямое исправление записи с отсутствующим полем access
const path = require('path');
const fs = require('fs');

async function fixAccessField() {
  console.log('🔧 ИСПРАВЛЕНИЕ ПОЛЯ ACCESS');
  
  try {
    const sysadminsDir = path.join(__dirname, 'data', 'sysadmins');
    const userFile = path.join(sysadminsDir, '694644988.json');
    
    console.log('Проверяем файл:', userFile);
    
    if (fs.existsSync(userFile)) {
      const currentData = JSON.parse(fs.readFileSync(userFile, 'utf8'));
      console.log('Текущие данные:', currentData);
      
      // Добавляем поле access
      currentData.access = 5;
      
      // Сохраняем обновленные данные
      fs.writeFileSync(userFile, JSON.stringify(currentData, null, 2));
      console.log('✅ Поле access добавлено');
      
      // Проверяем результат
      const updatedData = JSON.parse(fs.readFileSync(userFile, 'utf8'));
      console.log('Обновленные данные:', updatedData);
      
      // Тестируем функцию checkSysAccess
      const { checkSysAccess } = require('./cmds/sysadmin.js');
      const accessLevel = await checkSysAccess(694644988);
      console.log('Уровень доступа после исправления:', accessLevel);
      
    } else {
      console.log('❌ Файл не найден, создаем новый');
      
      // Создаем новый файл с правильными данными
      const newData = {
        userid: 694644988,
        access: 5
      };
      
      fs.writeFileSync(userFile, JSON.stringify(newData, null, 2));
      console.log('✅ Создан новый файл с правильными данными');
    }
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
  }
}

fixAccessField().catch(console.error);
