// Исправление правильного admin ID
const path = require('path');
const fs = require('fs');

async function fixCorrectAdmin() {
  console.log('🔧 ИСПРАВЛЕНИЕ ПРАВИЛЬНОГО ADMIN ID');
  
  try {
    const sysadminsDir = path.join(__dirname, 'data', 'sysadmins');
    
    // Удаляем неправильный файл
    const wrongFile = path.join(sysadminsDir, '694644988.json');
    if (fs.existsSync(wrongFile)) {
      fs.unlinkSync(wrongFile);
      console.log('✅ Удален неправильный файл 694644988.json');
    }
    
    // Проверяем правильный файл
    const correctFile = path.join(sysadminsDir, '755536919.json');
    console.log('Проверяем файл:', correctFile);
    
    if (fs.existsSync(correctFile)) {
      const currentData = JSON.parse(fs.readFileSync(correctFile, 'utf8'));
      console.log('Текущие данные:', currentData);
      
      // Обновляем данные если нужно
      if (!currentData.access || currentData.access !== 5) {
        currentData.access = 5;
        fs.writeFileSync(correctFile, JSON.stringify(currentData, null, 2));
        console.log('✅ Обновлен уровень доступа до 5 (разработчик)');
      }
    } else {
      // Создаем новый файл с правильными данными
      const newData = {
        userid: 755536919,
        access: 5
      };
      
      fs.writeFileSync(correctFile, JSON.stringify(newData, null, 2));
      console.log('✅ Создан файл с правильным ID и доступом разработчика');
    }
    
    // Показываем итоговые файлы
    console.log('\n=== ИТОГОВЫЕ ФАЙЛЫ ===');
    const files = fs.readdirSync(sysadminsDir);
    files.forEach(file => {
      const filePath = path.join(sysadminsDir, file);
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      console.log(`${file}: ${JSON.stringify(data)}`);
    });
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
  }
}

fixCorrectAdmin().catch(console.error);
