/**
 * 🚀 Пример интеграции оптимизаций в основной код бота
 * Показывает, как заменить медленные функции на быстрые
 */

// Импорт оптимизированных функций
const { 
  getUserRoleOptimized, 
  getUserRolesBatch,
  getChatSettingsOptimized,
  getBanListOptimized,
  invalidateUserRole,
  invalidateChatSettings 
} = require('./optimized_util.js');

// Пример замены в обработчике сообщений
async function optimizedMessageHandler(context) {
  const { peerId, senderId } = context;
  
  // ❌ МЕДЛЕННО (старый код):
  // const userRole = await getUserRole(peerId, senderId);
  
  // ✅ БЫСТРО (новый код):
  const userRole = await getUserRoleOptimized(peerId, senderId);
  
  // Остальная логика остается той же
  if (userRole < 20) {
    // Проверки для обычных пользователей
  }
}

// Пример оптимизации проверки спама
async function optimizedSpamCheck(context) {
  const { peerId, senderId } = context;
  
  // ❌ МЕДЛЕННО: загрузка настроек из файла каждый раз
  // const fs = require('fs');
  // const settings = JSON.parse(fs.readFileSync(`data/conference/${peerId}.json`));
  
  // ✅ БЫСТРО: кэшированные настройки
  const settings = await getChatSettingsOptimized(peerId);
  
  if (settings.spam === 1) {
    const userRole = await getUserRoleOptimized(peerId, senderId);
    
    if (userRole < 20) {
      // Логика проверки спама
      return checkSpamLogic(context);
    }
  }
  
  return false;
}

// Пример батчинга для команды со списком пользователей
async function optimizedUserListCommand(context, userIds) {
  const { peerId } = context;
  
  // ❌ МЕДЛЕННО: N запросов к БД
  // const roles = [];
  // for (const userId of userIds) {
  //   const role = await getUserRole(peerId, userId);
  //   roles.push({ userId, role });
  // }
  
  // ✅ БЫСТРО: 1 батч-запрос
  const rolesMap = await getUserRolesBatch(peerId, userIds);
  const roles = userIds.map(userId => ({
    userId,
    role: rolesMap.get(userId) || 0
  }));
  
  return roles;
}

// Пример оптимизации команды разбана
async function optimizedUnbanCommand(context, targetUserId) {
  const { peerId, senderId } = context;
  
  // Быстрая проверка прав
  const actorRole = await getUserRoleOptimized(peerId, senderId);
  
  if (actorRole < 40) {
    return context.reply('⛔ Недостаточно прав');
  }
  
  // Получаем банлист из кэша
  const banList = await getBanListOptimized(peerId);
  
  // Проверяем, забанен ли пользователь
  const isBanned = banList.some(ban => ban.blocked_user_id === targetUserId);
  
  if (!isBanned) {
    return context.reply('❌ Пользователь не забанен');
  }
  
  // Выполняем разбан...
  // После успешного разбана инвалидируем кэш
  invalidateBanList(peerId);
  
  return context.reply('✅ Пользователь разбанен');
}

// Пример оптимизации команды изменения роли
async function optimizedSetRoleCommand(context, targetUserId, newRole) {
  const { peerId, senderId } = context;
  
  // Быстрая проверка прав
  const actorRole = await getUserRoleOptimized(peerId, senderId);
  
  if (actorRole <= newRole) {
    return context.reply('⛔ Нельзя выдать роль выше своей');
  }
  
  // Выполняем изменение роли в БД...
  // const updateQuery = `UPDATE roles_${peerId} SET role_id = ? WHERE user_id = ?`;
  // await database.query(updateQuery, [newRole, targetUserId]);
  
  // ВАЖНО: Инвалидируем кэш после изменения
  invalidateUserRole(peerId, targetUserId);
  
  return context.reply('✅ Роль изменена');
}

// Пример middleware для автоматической оптимизации
function createOptimizedMiddleware() {
  return async (context, next) => {
    const startTime = Date.now();
    
    // Предзагружаем часто используемые данные
    const { peerId, senderId } = context;
    
    // Кэшируем роль отправителя
    context.senderRole = await getUserRoleOptimized(peerId, senderId);
    
    // Кэшируем настройки чата
    context.chatSettings = await getChatSettingsOptimized(peerId);
    
    await next();
    
    const executionTime = Date.now() - startTime;
    
    // Логируем медленные операции
    if (executionTime > 1000) {
      console.warn(`⚠️ Медленная операция: ${executionTime}мс в чате ${peerId}`);
    }
  };
}

// Пример использования в основном коде
// vk.updates.use(createOptimizedMiddleware());

module.exports = {
  optimizedMessageHandler,
  optimizedSpamCheck,
  optimizedUserListCommand,
  optimizedUnbanCommand,
  optimizedSetRoleCommand,
  createOptimizedMiddleware
};