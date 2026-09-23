-- Таблицы для системы казино

-- Таблица балансов пользователей
CREATE TABLE IF NOT EXISTS user_balances (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL UNIQUE,
    balance DECIMAL(15,2) DEFAULT 10000.00,
    btc DECIMAL(10,8) DEFAULT 0.00000000,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id)
);

-- Таблица ежедневных бонусов
CREATE TABLE IF NOT EXISTS user_dailies (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL UNIQUE,
    last_daily DATETIME NOT NULL,
    streak INT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_last_daily (last_daily)
);

-- Таблица истории игр (для статистики)
CREATE TABLE IF NOT EXISTS casino_games (
    id INT AUTO_INCREMENT PRIMARY KEY,
    game_type VARCHAR(50) NOT NULL,
    peer_id BIGINT NOT NULL,
    result_number INT,
    total_bets INT DEFAULT 0,
    total_amount DECIMAL(15,2) DEFAULT 0.00,
    total_won DECIMAL(15,2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_peer_id (peer_id),
    INDEX idx_game_type (game_type),
    INDEX idx_created_at (created_at)
);

-- Таблица ставок (для детальной истории)
CREATE TABLE IF NOT EXISTS casino_bets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    game_id INT,
    user_id BIGINT NOT NULL,
    bet_type VARCHAR(10) NOT NULL,
    bet_amount DECIMAL(15,2) NOT NULL,
    won BOOLEAN DEFAULT FALSE,
    prize_amount DECIMAL(15,2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (game_id) REFERENCES casino_games(id) ON DELETE SET NULL,
    INDEX idx_user_id (user_id),
    INDEX idx_game_id (game_id),
    INDEX idx_created_at (created_at)
);
