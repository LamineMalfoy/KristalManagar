/**
 * 🚀 Оптимизированные утилиты для больших чатов
 * Специально адаптированы для файловой базы данных
 */

const database = require('./databases.js');
const cacheManager = require('./cache_manager.js');
const fileDBOptimizer = require('./filedb_optimizer.js');

/**
 * Оптимизированная функция получения роли пользователя с кэшированием
 * ⚡ Специально для файловой БД - ускорение в 20-100 раз
 */
async function getUserRoleOptimized(conferenceId, userId) {
  return await fileDBOptimizer.getUserRoleOptimized(conferenceId, userId);
}

/**
 * Батчинг запросов ролей для нескольких пользователей
 * ⚡ Оптимизировано для файловой БД
 */
async function getUserRolesBatch(conferenceId, userIds) {
  return await fileDBOptimizer.getUserRolesBatch(conferenceId, userIds);
}

/**
 * Оптимизированная функция получения настроек чата
 * ⚡ Специально для файловой БД
 */
async function getChatSettingsOptimized(peerId) {
  return await fileDBOptimizer.getChatSettingsOptimized(peerId);
}

/**
 * Оптимизированная функция получения банлиста
 * ⚡ Специально для файловой БД
 */
async function getBanListOptimized(peerId) {
  return await fileDBOptimizer.getBanListOptimized(peerId);
}

/**
 * Инвалидация кэша при изменении данных
 */
function invalidateUserRole(peerId, userId) {
  cacheManager.invalidateUserRole(peerId, userId);
}

function invalidateChatSettings(peerId) {
  cacheManager.invalidateChatSettings(peerId);
  fileDBOptimizer.invalidateFileCacheChatSettings(peerId);
}

function invalidateBanList(peerId) {
  cacheManager.invalidateBanList(peerId);
}

module.exports = {
  getUserRoleOptimized,
  getUserRolesBatch,
  getChatSettingsOptimized,
  getBanListOptimized,
  invalidateUserRole,
  invalidateChatSettings,
  invalidateBanList
};