const fs = require('fs');
const path = require('path');
const util = require('util');
const database = require('../databases.js');
let vk;

const LOGS_PER_PAGE = 20;

/**
 * Добавляет запись в журнал действий
 * @param {Number} peerId - ID беседы
 * @param {Number} adminId - ID администратора, выполнившего действие
 * @param {Number} targetId - ID пользователя, над которым выполнено действие
 * @param {String} actionType - Тип действия (ban, unban, mute, unmute, warn, unwarn, kick)
 * @param {String} details - Дополнительные детали действия
 */
async function addLog(peerId, adminId, targetId, actionType, details) {
  try {
    const logsDir = path.join(__dirname, '../data/logs');
    
    // Создаем директорию для логов, если она не существует
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    
    // Создаем директорию для логов конкретной беседы
    const chatLogsDir = path.join(logsDir, `logs_${peerId}`);
    if (!fs.existsSync(chatLogsDir)) {
      fs.mkdirSync(chatLogsDir, { recursive: true });
    }
    
    // Создаем файл логов, если он не существует
    const logsFile = path.join(chatLogsDir, 'logs.json');
    let logs = [];
    
    if (fs.existsSync(logsFile)) {
      const fileContent = fs.readFileSync(logsFile, 'utf8');
      logs = JSON.parse(fileContent || '[]');
    }
    
    // Добавляем новую запись в начало массива (чтобы новые были сверху)
    logs.unshift({
      timestamp: Date.now(),
      adminId,
      targetId,
      actionType,
      details
    });
    
    // Записываем обновленные логи
    fs.writeFileSync(logsFile, JSON.stringify(logs, null, 2));
    
    return true;
  } catch (error) {
    console.error('Ошибка при добавлении лога:', error);
    return false;
  }
}

/**
 * Получает логи действий в беседе
 * @param {Number} peerId - ID беседы
 * @param {Number} page - Номер страницы (начиная с 1)
 * @param {Number} targetId - ID пользователя для фильтрации (опционально)
 */
async function getLogs(peerId, page = 1, targetId = null) {
  try {
    const logsDir = path.join(__dirname, '../data/logs');
    const chatLogsDir = path.join(logsDir, `logs_${peerId}`);
    const logsFile = path.join(chatLogsDir, 'logs.json');
    
    if (!fs.existsSync(logsFile)) {
      return {
        logs: [],
        totalPages: 0,
        currentPage: 1
      };
    }
    
    const fileContent = fs.readFileSync(logsFile, 'utf8');
    let logs = JSON.parse(fileContent || '[]');
    
    // Фильтрация по пользователю, если указан targetId
    if (targetId) {
      logs = logs.filter(log => 
        log.adminId === targetId || log.targetId === targetId
      );
    }
    
    const totalLogs = logs.length;
    const totalPages = Math.ceil(totalLogs / LOGS_PER_PAGE);
    
    // Проверяем, что страница в допустимом диапазоне
    const validPage = Math.max(1, Math.min(page, totalPages || 1));
    
    // Получаем логи для указанной страницы
    const startIndex = (validPage - 1) * LOGS_PER_PAGE;
    const endIndex = startIndex + LOGS_PER_PAGE;
    const pageData = logs.slice(startIndex, endIndex);
    
    return {
      logs: pageData,
      totalPages,
      currentPage: validPage
    };
  } catch (error) {
    console.error('Ошибка при получении логов:', error);
    return {
      logs: [],
      totalPages: 0,
      currentPage: 1,
      error: error.message
    };
  }
}

/**
 * Форматирует дату из timestamp
 * @param {Number} timestamp - Unix timestamp в миллисекундах
 */
function formatDate(timestamp) {
  const date = new Date(timestamp);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  
  return `${day}.${month}.${year} ${hours}:${minutes}:${seconds}`;
}

/**
 * Получает имя пользователя по ID
 * @param {Number} userId - ID пользователя
 */
async function getUserName(userId) {
  try {
    // Проверяем, доступен ли vk API
    if (global.vk) {
      vk = global.vk;
      const user = await vk.api.users.get({ user_ids: [userId] });
      if (user && user[0]) {
        return `${user[0].first_name} ${user[0].last_name}`;
      }
    }
    return `ID: ${userId}`;
  } catch (error) {
    console.error('Ошибка при получении имени пользователя:', error);
    return `ID: ${userId}`;
  }
}

// ОПТИМИЗАЦИЯ: Кэш для имен пользователей
const userNamesCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 минут

/**
 * Получает имена пользователей батчево с кэшированием
 * @param {Array} userIds - Массив ID пользователей
 */
async function getUserNamesBatch(userIds) {
  if (!global.vk) {
    return new Map();
  }
  
  const now = Date.now();
  const result = new Map();
  const toFetch = [];
  
  // Проверяем кэш
  for (const userId of userIds) {
    const cached = userNamesCache.get(userId);
    if (cached && (now - cached.timestamp) < CACHE_TTL) {
      result.set(userId, cached.name);
    } else {
      toFetch.push(userId);
    }
  }
  
  // Получаем недостающие имена одним запросом
  if (toFetch.length > 0) {
    try {
      const users = await global.vk.api.users.get({ user_ids: toFetch });
      for (const user of users) {
        const name = `${user.first_name} ${user.last_name}`;
        result.set(user.id, name);
        // Обновляем кэш
        userNamesCache.set(user.id, {
          name,
          timestamp: now
        });
      }
    } catch (error) {
      console.error('Ошибка при получении имен пользователей:', error);
      // Добавляем fallback для пользователей, которых не удалось получить
      for (const userId of toFetch) {
        result.set(userId, `ID: ${userId}`);
      }
    }
  }
  
  return result;
}

/**
 * ОПТИМИЗИРОВАННАЯ функция форматирования множественных логов
 * @param {Array} logs - Массив объектов логов
 */
async function formatLogEntries(logs) {
  if (!logs || logs.length === 0) {
    return [];
  }
  
  // ОПТИМИЗАЦИЯ: Собираем все уникальные ID пользователей
  const allUserIds = new Set();
  for (const log of logs) {
    allUserIds.add(log.adminId);
    allUserIds.add(log.targetId);
  }
  
  // ОПТИМИЗАЦИЯ: Получаем все имена одним батчевым запросом
  const userNames = await getUserNamesBatch([...allUserIds]);
  
  // ОПТИМИЗАЦИЯ: Форматируем все логи без дополнительных API запросов
  return logs.map(log => {
    const { timestamp, adminId, targetId, actionType, details } = log;
    const formattedDate = formatDate(timestamp);
    
    let actionText = '';
    switch (actionType) {
      case 'ban':
        actionText = 'заблокировал';
        break;
      case 'unban':
        actionText = 'разблокировал';
        break;
      case 'mute':
        actionText = 'заглушил';
        break;
      case 'unmute':
        actionText = 'снял глушение с';
        break;
      case 'warn':
        actionText = 'выдал предупреждение';
        break;
      case 'unwarn':
        actionText = 'снял предупреждение с';
        break;
      case 'kick':
        actionText = 'исключил';
        break;
      case 'role':
        actionText = 'изменил роль';
        break;
      default:
        actionText = 'выполнил действие над';
    }
    
    // Формируем ссылки с кэшированными именами
    const adminName = userNames.get(adminId) || `ID: ${adminId}`;
    const targetName = userNames.get(targetId) || `ID: ${targetId}`;
    
    const adminLink = `[id${adminId}|${adminName}]`;
    const targetLink = `[id${targetId}|${targetName}]`;
    
    return `🕓 ${formattedDate}\n👤 ${adminLink} ${actionText} ${targetLink}\n📝 Детали: ${details}\n`;
  });
}

/**
 * Форматирует лог действия для вывода (УСТАРЕВШАЯ - используйте formatLogEntries)
 * @param {Object} log - Объект лога
 */
async function formatLogEntry(log) {
  // Для обратной совместимости - используем новую оптимизированную функцию
  const formatted = await formatLogEntries([log]);
  return formatted[0] || '';
}

module.exports = {
  addLog,
  getLogs,
  formatLogEntry,
  formatLogEntries // Новая оптимизированная функция
};