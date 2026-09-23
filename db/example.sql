CREATE TABLE IF NOT EXISTS sysadmins (
  userid INT PRIMARY KEY,
  access INT NOT NULL,
  CONSTRAINT chk_access CHECK (access >= 1 AND access <= 5)
);

CREATE TABLE IF NOT EXISTS sysbanned (
  userid INT PRIMARY KEY,
  time BIGINT NOT NULL,
  reason VARCHAR(255) DEFAULT 'Не указана',
  who INT NOT NULL
);

CREATE TABLE IF NOT EXISTS tickets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userid INT NOT NULL,
  mess TEXT NOT NULL,
  status BOOLEAN DEFAULT FALSE,
  peer_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO sysadmins (userid, access) VALUES (1, 4); 