const database = require('../databases.js');
const util = require('util');
const queryAsync = util.promisify(database.query).bind(database);

/**
 * Миграция для добавления колонки required_groups в таблицы конференций
 */
async function addRequiredGroupsColumn() {
  try {
    console.log('🔄 Начало миграции: добавление колонки required_groups...');
    
    // Получаем список всех таблиц conference_*
    const tables = await queryAsync('SHOW TABLES LIKE "conference_%"');
    
    if (!tables || tables.length === 0) {
      console.log('✅ Нет таблиц конференций для миграции');
      return;
    }
    
    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;
    
    for (const tableRow of tables) {
      const tableName = Object.values(tableRow)[0];
      
      try {
        // Пробуем добавить колонку, если она уже существует - получим ошибку
        await queryAsync(`
          ALTER TABLE ${tableName}
          ADD COLUMN required_groups TEXT NULL COMMENT 'Список обязательных подписок на группы (JSON)'
        `);
        
        console.log(`✅ Таблица ${tableName}: колонка required_groups добавлена`);
        successCount++;
        
      } catch (error) {
        // Если колонка уже существует, пропускаем
        if (error.message.includes('Duplicate column name') || error.message.includes('дубликат')) {
          console.log(`⏭️  Таблица ${tableName}: колонка required_groups уже существует`);
          skipCount++;
        } else {
          console.error(`❌ Ошибка при обработке таблицы ${tableName}:`, error.message);
          errorCount++;
        }
      }
    }
    
    console.log('\n📊 Результаты миграции:');
    console.log(`   ✅ Успешно: ${successCount}`);
    console.log(`   ⏭️  Пропущено: ${skipCount}`);
    console.log(`   ❌ Ошибки: ${errorCount}`);
    console.log(`   📋 Всего таблиц: ${tables.length}\n`);
    
    if (errorCount === 0) {
      console.log('✨ Миграция завершена успешно!');
    } else {
      console.log('⚠️  Миграция завершена с ошибками');
    }
    
  } catch (error) {
    console.error('❌ Критическая ошибка миграции:', error);
    throw error;
  }
}

// Запускаем миграцию, если файл запущен напрямую
if (require.main === module) {
  addRequiredGroupsColumn()
    .then(() => {
      console.log('👋 Миграция завершена, выход...');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Миграция провалилась:', error);
      process.exit(1);
    });
}

module.exports = { addRequiredGroupsColumn };
