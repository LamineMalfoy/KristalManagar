const fs = require('fs');
const path = require('path');

// Функция для рекурсивного поиска и удаления пустых JSON файлов
function cleanupEmptyFiles(dir) {
  let deletedCount = 0;
  
  function processDirectory(currentDir) {
    try {
      const items = fs.readdirSync(currentDir);
      
      for (const item of items) {
        const fullPath = path.join(currentDir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          // Рекурсивно обрабатываем поддиректории
          processDirectory(fullPath);
        } else if (stat.isFile() && item.endsWith('.json')) {
          // Проверяем JSON файлы
          try {
            const content = fs.readFileSync(fullPath, 'utf8');
            
            // Если файл пустой или содержит только пробелы
            if (!content || content.trim() === '') {
              console.log(`🗑️ Удаляем пустой файл: ${fullPath}`);
              fs.unlinkSync(fullPath);
              deletedCount++;
            }
            // Если файл содержит невалидный JSON
            else {
              try {
                JSON.parse(content);
              } catch (parseError) {
                console.log(`⚠️ Невалидный JSON в файле: ${fullPath}`);
                console.log(`Содержимое: "${content.substring(0, 100)}..."`);
                // Можно раскомментировать для удаления невалидных файлов
                // fs.unlinkSync(fullPath);
                // deletedCount++;
              }
            }
          } catch (error) {
            console.error(`❌ Ошибка при обработке файла ${fullPath}:`, error.message);
          }
        }
      }
    } catch (error) {
      console.error(`❌ Ошибка при обработке директории ${currentDir}:`, error.message);
    }
  }
  
  processDirectory(dir);
  return deletedCount;
}

// Очищаем data директорию
const dataDir = path.join(__dirname, 'data');

console.log('🧹 Начинаем очистку пустых JSON файлов...');
console.log(`📁 Обрабатываем директорию: ${dataDir}`);

if (fs.existsSync(dataDir)) {
  const deletedCount = cleanupEmptyFiles(dataDir);
  console.log(`✅ Очистка завершена. Удалено файлов: ${deletedCount}`);
} else {
  console.log('❌ Директория data не найдена');
}
