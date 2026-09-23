// Простая система управления логированием
require('dotenv').config();

const DEBUG_MODE = process.env.DEBUG_MODE === 'true';

const logger = {
  log: (...args) => {
    if (DEBUG_MODE) {
      console.log(...args);
    }
  },
  
  error: (...args) => {
    // Ошибки всегда важны, но можем их тоже отключить в продакшене
    if (DEBUG_MODE) {
      console.error(...args);
    }
  },
  
  warn: (...args) => {
    if (DEBUG_MODE) {
      console.warn(...args);
    }
  },
  
  info: (...args) => {
    if (DEBUG_MODE) {
      console.info(...args);
    }
  },
  
  debug: (...args) => {
    if (DEBUG_MODE) {
      console.debug(...args);
    }
  },
  
  // Для критически важных сообщений, которые должны всегда выводиться
  critical: (...args) => {
    console.error(...args);
  },
  
  // Для важных событий (запуск бота и т.д.)
  important: (...args) => {
    console.log(...args);
  }
};

module.exports = logger;
