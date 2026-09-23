-- Миграция БД для исправления проблем казино
-- Выполните этот скрипт для исправления всех проблем с БД

-- 1. Добавляем столбец BTC в user_balances (если не существует)
ALTER TABLE user_balances ADD COLUMN IF NOT EXISTS btc DECIMAL(10,8) DEFAULT 0.00000000;

-- 2. Обновляем структуру user_dailies для поддержки серий и DATETIME
-- Сначала добавляем новые столбцы
ALTER TABLE user_dailies ADD COLUMN IF NOT EXISTS streak INT DEFAULT 1;
ALTER TABLE user_dailies ADD COLUMN IF NOT EXISTS last_daily_new DATETIME;

-- Копируем данные из старого формата в новый (если есть данные)
UPDATE user_dailies 
SET last_daily_new = FROM_UNIXTIME(last_daily) 
WHERE last_daily_new IS NULL AND last_daily IS NOT NULL;

-- Удаляем старый столбец и переименовываем новый
ALTER TABLE user_dailies DROP COLUMN last_daily;
ALTER TABLE user_dailies CHANGE COLUMN last_daily_new last_daily DATETIME;

-- 3. Создаем индексы для оптимизации
CREATE INDEX IF NOT EXISTS idx_btc ON user_balances(btc);
CREATE INDEX IF NOT EXISTS idx_streak ON user_dailies(streak);

-- 4. Показываем структуру таблиц для проверки
DESCRIBE user_balances;
DESCRIBE user_dailies;

SELECT 'Миграция БД казино завершена!' as Status;
