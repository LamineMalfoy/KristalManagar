-- 🚀 SQL оптимизации для больших чатов
-- Критически важные индексы для производительности

-- Индексы для таблиц ролей (roles_XXXXXXX)
-- Эти индексы нужно создать для каждого активного чата
-- Замените XXXXXXX на ID чата

-- Пример для чата 2000000016:
CREATE INDEX IF NOT EXISTS idx_roles_2000000016_user_id ON roles_2000000016(user_id);
CREATE INDEX IF NOT EXISTS idx_roles_2000000016_role_id ON roles_2000000016(role_id);

-- Индексы для таблиц конференций (conference_XXXXXXX)
-- CREATE INDEX IF NOT EXISTS idx_conference_2000000016_user_id ON conference_2000000016(user_id);
-- CREATE INDEX IF NOT EXISTS idx_conference_2000000016_blocked_users ON conference_2000000016(blocked_users(100));

-- Общие системные индексы
CREATE INDEX IF NOT EXISTS idx_tech_agent ON tech(agent);
CREATE INDEX IF NOT EXISTS idx_vip_users_user_id ON vip_users(user_id);
CREATE INDEX IF NOT EXISTS idx_agents_agent ON agents(agent);

-- Оптимизация таблицы conferences
CREATE INDEX IF NOT EXISTS idx_conferences_conference_id ON conferences(conference_id);

-- Скрипт для автоматического создания индексов для всех чатов
-- Этот скрипт нужно запустить для создания индексов для всех существующих чатов

DELIMITER $$

CREATE PROCEDURE CreateIndexesForAllChats()
BEGIN
    DECLARE done INT DEFAULT FALSE;
    DECLARE table_name VARCHAR(255);
    DECLARE chat_id VARCHAR(20);
    
    -- Курсор для поиска всех таблиц ролей
    DECLARE cur CURSOR FOR 
        SELECT TABLE_NAME 
        FROM information_schema.TABLES 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME LIKE 'roles_%';
    
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;
    
    OPEN cur;
    
    read_loop: LOOP
        FETCH cur INTO table_name;
        IF done THEN
            LEAVE read_loop;
        END IF;
        
        -- Извлекаем ID чата из имени таблицы
        SET chat_id = SUBSTRING(table_name, 7); -- убираем 'roles_'
        
        -- Создаем индексы для таблицы ролей
        SET @sql = CONCAT('CREATE INDEX IF NOT EXISTS idx_', table_name, '_user_id ON ', table_name, '(user_id)');
        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
        
        SET @sql = CONCAT('CREATE INDEX IF NOT EXISTS idx_', table_name, '_role_id ON ', table_name, '(role_id)');
        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
        
        -- Создаем индексы для соответствующей таблицы конференции
        SET @conference_table = CONCAT('conference_', chat_id);
        
        -- Проверяем существование таблицы конференции
        SET @table_exists = (
            SELECT COUNT(*) 
            FROM information_schema.TABLES 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = @conference_table
        );
        
        IF @table_exists > 0 THEN
            SET @sql = CONCAT('CREATE INDEX IF NOT EXISTS idx_', @conference_table, '_user_id ON ', @conference_table, '(user_id)');
            PREPARE stmt FROM @sql;
            EXECUTE stmt;
            DEALLOCATE PREPARE stmt;
        END IF;
        
    END LOOP;
    
    CLOSE cur;
    
    SELECT 'Индексы созданы для всех чатов' AS result;
END$$

DELIMITER ;

-- Запуск процедуры создания индексов
-- CALL CreateIndexesForAllChats();

-- Удаление процедуры после использования
-- DROP PROCEDURE CreateIndexesForAllChats;

-- Настройки MySQL для оптимизации
-- Добавьте эти настройки в my.cnf или my.ini

/*
[mysqld]
# Увеличиваем размер буферов для лучшей производительности
innodb_buffer_pool_size = 1G
innodb_log_file_size = 256M
innodb_flush_log_at_trx_commit = 2

# Оптимизация для большого количества соединений
max_connections = 500
thread_cache_size = 50

# Оптимизация запросов
query_cache_size = 128M
query_cache_type = 1

# Временные таблицы
tmp_table_size = 64M
max_heap_table_size = 64M

# Сортировка и группировка
sort_buffer_size = 2M
read_buffer_size = 1M
read_rnd_buffer_size = 1M
*/

-- Мониторинг производительности
-- Используйте эти запросы для отслеживания производительности

-- Проверка использования индексов
-- SHOW INDEX FROM roles_2000000016;

-- Анализ медленных запросов
-- SHOW VARIABLES LIKE 'slow_query_log';
-- SET GLOBAL slow_query_log = 'ON';
-- SET GLOBAL long_query_time = 1;

-- Статистика по таблицам
-- SELECT 
--     TABLE_NAME,
--     TABLE_ROWS,
--     DATA_LENGTH,
--     INDEX_LENGTH,
--     (DATA_LENGTH + INDEX_LENGTH) AS total_size
-- FROM information_schema.TABLES 
-- WHERE TABLE_SCHEMA = DATABASE()
-- AND (TABLE_NAME LIKE 'roles_%' OR TABLE_NAME LIKE 'conference_%')
-- ORDER BY total_size DESC;