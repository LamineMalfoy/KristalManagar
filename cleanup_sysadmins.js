// Очистка файлов без поля access в sysadmins
const path = require('path');
const fs = require('fs');

async function cleanupSysadmins() {
  console.log('🧹 ОЧИСТКА SYSADMINS');
  
  try {
    const sysadminsDir = path.join(__dirname, 'data', 'sysadmins');
    const files = fs.readdirSync(sysadminsDir);
    
    console.log('Найденные файлы:');
    files.forEach(file => {
      const filePath = path.join(sysadminsDir, file);
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      console.log(`${file}: ${JSON.stringify(data)}`);
      
      // Удаляем файлы без поля access (кроме основного администратора)
      if (!data.access && data.userid !== 755536919) {
        fs.unlinkSync(filePath);
        console.log(`🗑️ Удален файл без access: ${file}`);
      }
    });
    
    console.log('\n=== ИТОГОВЫЕ ФАЙЛЫ ===');
    const finalFiles = fs.readdirSync(sysadminsDir);
    finalFiles.forEach(file => {
      const filePath = path.join(sysadminsDir, file);
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      console.log(`${file}: ${JSON.stringify(data)}`);
    });
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
  }
}

cleanupSysadmins().catch(console.error);
