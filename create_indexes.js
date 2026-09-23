/**
 * 🚀 Автоматическое создание индексов для оптимизации
 */

const database = require('./databases.js');

async function createIndexesForAllChats() {
  console.log('🔧 Начинаем создание индексов для оптимизации...');
  
  try {
    // Получаем список всех таблиц ролей
    const tablesQuery = `
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME LIKE 'roles_%'
    `;
    
    database.query(tablesQuery, [], async (error, tables) => {
      if (error) {
        console.error('❌ Ошибка при получении списка таблиц:', error);
        return;
      }
      
      console.log(`📋 Найдено ${tables.length} таблиц ролей`);
      
      for (const table of tables) {
        const tableName = table.TABLE_NAME;
        const chatId = tableName.replace('roles_', '');
        
        console.log(`🔨 Создаем индексы для чата ${chatId}...`);
        
        // Создаем индекс для таблицы ролей
        const roleIndexQuery = `CREATE INDEX IF NOT EXISTS idx_${tableName}_user_id ON ${tableName}(user_id)`;
        
        database.query(roleIndexQuery, [], (error) => {
          if (error) {
            console.error(`❌ Ошибка создания индекса для ${tableName}:`, error);
          } else {
            console.log(`✅ Индекс создан для ${tableName}`);
          }
        });
        
        // Создаем индекс для таблицы конференции
        const conferenceTable = `conference_${chatId}`;
        const conferenceIndexQuery = `CREATE INDEX IF NOT EXISTS idx_${conferenceTable}_user_id ON ${conferenceTable}(user_id)`;
        
        database.query(conferenceIndexQuery, [], (error) => {
          if (error) {
            // Таблица может не существовать - это нормально
            if (!error.message.includes("doesn't exist")) {
              console.error(`❌ Ошибка создания индекса для ${conferenceTable}:`, error);
            }
          } else {
            console.log(`✅ Индекс создан для ${conferenceTable}`);
          }
        });
      }
      
      // Создаем общие системные индексы
      const systemIndexes = [
        'CREATE INDEX IF NOT EXISTS idx_tech_agent ON tech(agent)',
        'CREATE INDEX IF NOT EXISTS idx_vip_users_user_id ON vip_users(user_id)',
        'CREATE INDEX IF NOT EXISTS idx_agents_agent ON agents(agent)'
      ];
      
      for (const indexQuery of systemIndexes) {
        database.query(indexQuery, [], (error) => {
          if (error) {
            console.error('❌ Ошибка создания системного индекса:', error);
          } else {
            console.log('✅ Системный индекс создан');
          }
        });
      }
      
      console.log('🎉 Создание индексов завершено!');
      console.log('⚡ Производительность бота должна значительно улучшиться');
    });
    
  } catch (error) {
    console.error('❌ Критическая ошибка при создании индексов:', error);
  }
}

// Запускаем создание индексов
if (require.main === module) {
  createIndexesForAllChats();
}

module.exports = { createIndexesForAllChats };