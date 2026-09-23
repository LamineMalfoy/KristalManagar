const mysql = require('mysql2');
const fs = require('fs');
const path = require('path');
const util = require('util');

// Конфигурация MySQL (те же настройки, что были в databases.js)
const dbConfig = {
  host: '185.246.67.197', 
  user: 'admin', 
  password: '0mPf5eoS5boAtfW3', 
  database: 'bot_zakaz' 
};

// Подключение к MySQL
const connection = mysql.createConnection(dbConfig);
const query = util.promisify(connection.query).bind(connection);

// Путь к директории данных
const DATA_DIR = path.join(__dirname, 'data');

// Создаем директорию для данных, если она не существует
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR);
}

// Список таблиц для миграции
const tables = [
  'conference',
  'roles',
  'nicknames',
  'userinfo',
  'blockedusers',
  'pools',
  'custom_roles',
  'sysbanned',
  'tech',
  'agents',
  'testers',
  'vip_users'
];

// Асинхронная функция для миграции данных
async function migrateData() {
  try {
    console.log('Начинаем миграцию данных из MySQL в файловую систему...');

    // Получаем список всех таблиц в базе данных
    const [tablesResult] = await query('SHOW TABLES');
    const existingTables = tablesResult.map(row => Object.values(row)[0]);

    // Проходим по каждой таблице
    for (const table of tables) {
      // Проверяем, существует ли таблица в БД
      if (!existingTables.includes(table)) {
        console.log(`Таблица '${table}' не существует в MySQL, пропускаем...`);
        continue;
      }

      console.log(`Миграция данных из таблицы '${table}'...`);

      // Создаем директорию для таблицы
      const tableDir = path.join(DATA_DIR, table);
      if (!fs.existsSync(tableDir)) {
        fs.mkdirSync(tableDir);
      }

      // Получаем все записи из таблицы
      const rows = await query(`SELECT * FROM ${table}`);
      console.log(`Найдено ${rows.length} записей в таблице '${table}'`);

      // Сохраняем каждую запись в отдельный файл
      for (const row of rows) {
        // Определяем имя файла по primary key или временной метке
        let fileName = '';
        if (row.user_id) {
          fileName = `${row.user_id}.json`;
        } else if (row.id) {
          fileName = `${row.id}.json`;
        } else if (row.conference_id) {
          fileName = `${row.conference_id}.json`;
        } else {
          fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 15)}.json`;
        }

        const filePath = path.join(tableDir, fileName);
        
        // Записываем данные в файл
        fs.writeFileSync(filePath, JSON.stringify(row, null, 2));
      }

      console.log(`Миграция таблицы '${table}' завершена успешно`);
    }

    console.log('Миграция данных завершена успешно!');
  } catch (error) {
    console.error('Ошибка при миграции данных:', error);
  } finally {
    // Закрываем соединение с MySQL
    connection.end();
  }
}

// Запускаем миграцию
migrateData(); 