/**
 * 🚀 Оптимизированный менеджер кэширования
 * Повышает производительность за счет снижения нагрузки на БД
 */

require('dotenv').config();
const DEBUG_MODE = process.env.DEBUG_MODE === 'true';

class CacheManager {
  constructor() {
    // Кэш ролей пользователей: {peerId_userId: {role: number, timestamp: number}}
    this.userRoles = new Map();
    
    // Кэш настроек чатов: {peerId: {settings: object, timestamp: number}}
    this.chatSettings = new Map();
    
    // Кэш банлистов: {peerId: {banlist: array, timestamp: number}}
    this.banLists = new Map();
    
    // 🆕 Кэш участников беседы VK API
    this.conversationMembers = new Map();
    
    // 🆕 Кэш информации о пользователях VK
    this.vkUsers = new Map();
    
    // 🆕 Кэш никнеймов пользователей
    this.userNicknames = new Map();
    
    // 🆕 Кэш VIP статусов
    this.vipStatuses = new Map();
    
    // 🆕 Кэш проверки существования таблиц БД
    this.tableExists = new Map();
    
    // 🆕 Кэш статистики пользователей
    this.userStats = new Map();
    
    // 🆕 Кэш браков
    this.marriages = new Map();
    
    // TTL для кэша (в миллисекундах)
    this.TTL = {
      userRoles: 5 * 60 * 1000,         // 5 минут для ролей
      chatSettings: 10 * 60 * 1000,     // 10 минут для настроек
      banLists: 2 * 60 * 1000,          // 2 минуты для банлистов
      conversationMembers: 15 * 60 * 1000, // 15 минут для участников
      vkUsers: 30 * 60 * 1000,          // 30 минут для VK пользователей
      userNicknames: 10 * 60 * 1000,    // 10 минут для никнеймов
      vipStatuses: 20 * 60 * 1000,      // 20 минут для VIP статусов
      tableExists: 60 * 60 * 1000,      // 1 час для существования таблиц
      userStats: 3 * 60 * 1000,         // 3 минуты для статистики
      marriages: 30 * 60 * 1000         // 30 минут для браков
    };
    
    // Статистика кэша
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0
    };
    
    // Автоочистка кэша каждые 30 секунд
    setInterval(() => this.cleanup(), 30000);
    
    if (DEBUG_MODE) {
      console.log('🚀 CacheManager инициализирован с расширенным кэшированием');
    }
  }
  
  /**
   * Получить роль пользователя из кэша
   */
  getUserRole(peerId, userId) {
    const key = `${peerId}_${userId}`;
    const cached = this.userRoles.get(key);
    
    if (cached && (Date.now() - cached.timestamp) < this.TTL.userRoles) {
      this.stats.hits++;
      return cached.role;
    }
    
    this.stats.misses++;
    return null;
  }
  
  /**
   * Сохранить роль пользователя в кэш
   */
  setUserRole(peerId, userId, role) {
    const key = `${peerId}_${userId}`;
    this.userRoles.set(key, {
      role: role,
      timestamp: Date.now()
    });
  }
  
  /**
   * Получить настройки чата из кэша
   */
  getChatSettings(peerId) {
    const cached = this.chatSettings.get(peerId);
    
    if (cached && (Date.now() - cached.timestamp) < this.TTL.chatSettings) {
      this.stats.hits++;
      return cached.settings;
    }
    
    this.stats.misses++;
    return null;
  }
  
  /**
   * Сохранить настройки чата в кэш
   */
  setChatSettings(peerId, settings) {
    this.chatSettings.set(peerId, {
      settings: settings,
      timestamp: Date.now()
    });
  }
  
  /**
   * Получить банлист из кэша
   */
  getBanList(peerId) {
    const cached = this.banLists.get(peerId);
    
    if (cached && (Date.now() - cached.timestamp) < this.TTL.banLists) {
      this.stats.hits++;
      return cached.banlist;
    }
    
    this.stats.misses++;
    return null;
  }
  
  /**
   * Сохранить банлист в кэш
   */
  setBanList(peerId, banlist) {
    this.banLists.set(peerId, {
      banlist: banlist,
      timestamp: Date.now()
    });
  }
  
  /**
   * Инвалидировать кэш для конкретного пользователя
   */
  invalidateUserRole(peerId, userId) {
    const key = `${peerId}_${userId}`;
    this.userRoles.delete(key);
  }
  
  /**
   * Инвалидировать кэш настроек чата
   */
  invalidateChatSettings(peerId) {
    this.chatSettings.delete(peerId);
  }
  
  /**
   * Инвалидировать банлист
   */
  invalidateBanList(peerId) {
    this.banLists.delete(peerId);
  }
  
  /**
   * 🆕 Кэш участников беседы
   */
  getConversationMembers(peerId) {
    const cached = this.conversationMembers.get(peerId);
    if (cached && (Date.now() - cached.timestamp) < this.TTL.conversationMembers) {
      this.stats.hits++;
      return cached.members;
    }
    this.stats.misses++;
    return null;
  }
  
  setConversationMembers(peerId, members) {
    this.conversationMembers.set(peerId, {
      members: members,
      timestamp: Date.now()
    });
  }
  
  /**
   * 🆕 Кэш VK пользователей
   */
  getVkUser(userId) {
    const cached = this.vkUsers.get(userId);
    if (cached && (Date.now() - cached.timestamp) < this.TTL.vkUsers) {
      this.stats.hits++;
      return cached.user;
    }
    this.stats.misses++;
    return null;
  }
  
  setVkUser(userId, user) {
    this.vkUsers.set(userId, {
      user: user,
      timestamp: Date.now()
    });
  }
  
  /**
   * 🆕 Кэш никнеймов
   */
  getUserNickname(peerId, userId) {
    const key = `${peerId}_${userId}`;
    const cached = this.userNicknames.get(key);
    if (cached && (Date.now() - cached.timestamp) < this.TTL.userNicknames) {
      this.stats.hits++;
      return cached.nickname;
    }
    this.stats.misses++;
    return null;
  }
  
  setUserNickname(peerId, userId, nickname) {
    const key = `${peerId}_${userId}`;
    this.userNicknames.set(key, {
      nickname: nickname,
      timestamp: Date.now()
    });
  }
  
  /**
   * 🆕 Кэш VIP статусов
   */
  getVipStatus(userId) {
    const cached = this.vipStatuses.get(userId);
    if (cached && (Date.now() - cached.timestamp) < this.TTL.vipStatuses) {
      this.stats.hits++;
      return cached.status;
    }
    this.stats.misses++;
    return null;
  }
  
  setVipStatus(userId, status) {
    this.vipStatuses.set(userId, {
      status: status,
      timestamp: Date.now()
    });
  }
  
  /**
   * 🆕 Кэш проверки таблиц
   */
  getTableExists(tableName) {
    const cached = this.tableExists.get(tableName);
    if (cached && (Date.now() - cached.timestamp) < this.TTL.tableExists) {
      this.stats.hits++;
      return cached.exists;
    }
    this.stats.misses++;
    return null;
  }
  
  setTableExists(tableName, exists) {
    this.tableExists.set(tableName, {
      exists: exists,
      timestamp: Date.now()
    });
  }
  
  /**
   * 🆕 Кэш статистики пользователей
   */
  getUserStats(peerId, userId) {
    const key = `${peerId}_${userId}`;
    const cached = this.userStats.get(key);
    if (cached && (Date.now() - cached.timestamp) < this.TTL.userStats) {
      this.stats.hits++;
      return cached.stats;
    }
    this.stats.misses++;
    return null;
  }
  
  setUserStats(peerId, userId, stats) {
    const key = `${peerId}_${userId}`;
    this.userStats.set(key, {
      stats: stats,
      timestamp: Date.now()
    });
  }
  
  /**
   * 🆕 Кэш браков
   */
  getMarriages(peerId) {
    const cached = this.marriages.get(peerId);
    if (cached && (Date.now() - cached.timestamp) < this.TTL.marriages) {
      this.stats.hits++;
      return cached.marriages;
    }
    this.stats.misses++;
    return null;
  }
  
  setMarriages(peerId, marriages) {
    this.marriages.set(peerId, {
      marriages: marriages,
      timestamp: Date.now()
    });
  }
  
  /**
   * Очистка устаревших записей
   */
  cleanup() {
    const now = Date.now();
    let evicted = 0;
    
    // Очистка ролей
    for (const [key, value] of this.userRoles.entries()) {
      if (now - value.timestamp > this.TTL.userRoles) {
        this.userRoles.delete(key);
        evicted++;
      }
    }
    
    // Очистка настроек
    for (const [key, value] of this.chatSettings.entries()) {
      if (now - value.timestamp > this.TTL.chatSettings) {
        this.chatSettings.delete(key);
        evicted++;
      }
    }
    
    // Очистка банлистов
    for (const [key, value] of this.banLists.entries()) {
      if (now - value.timestamp > this.TTL.banLists) {
        this.banLists.delete(key);
        evicted++;
      }
    }
    
    // 🆕 Очистка новых кэшей
    const caches = [
      { map: this.conversationMembers, ttl: this.TTL.conversationMembers },
      { map: this.vkUsers, ttl: this.TTL.vkUsers },
      { map: this.userNicknames, ttl: this.TTL.userNicknames },
      { map: this.vipStatuses, ttl: this.TTL.vipStatuses },
      { map: this.tableExists, ttl: this.TTL.tableExists },
      { map: this.userStats, ttl: this.TTL.userStats },
      { map: this.marriages, ttl: this.TTL.marriages }
    ];
    
    for (const cache of caches) {
      for (const [key, value] of cache.map.entries()) {
        if (now - value.timestamp > cache.ttl) {
          cache.map.delete(key);
          evicted++;
        }
      }
    }
    
    if (evicted > 0) {
      this.stats.evictions += evicted;
      console.log(`🧹 Кэш очищен: удалено ${evicted} устаревших записей`);
    }
  }
  
  /**
   * Получить статистику кэша
   */
  getStats() {
    const hitRate = this.stats.hits / (this.stats.hits + this.stats.misses) * 100;
    
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      evictions: this.stats.evictions,
      hitRate: hitRate.toFixed(2) + '%',
      cacheSize: {
        userRoles: this.userRoles.size,
        chatSettings: this.chatSettings.size,
        banLists: this.banLists.size,
        conversationMembers: this.conversationMembers.size,
        vkUsers: this.vkUsers.size,
        userNicknames: this.userNicknames.size,
        vipStatuses: this.vipStatuses.size,
        tableExists: this.tableExists.size,
        userStats: this.userStats.size,
        marriages: this.marriages.size,
        total: this.userRoles.size + this.chatSettings.size + this.banLists.size + 
               this.conversationMembers.size + this.vkUsers.size + this.userNicknames.size + 
               this.vipStatuses.size + this.tableExists.size + this.userStats.size + 
               this.marriages.size
      }
    };
  }
  
  /**
   * Вывести статистику в консоль
   */
  printStats() {
    if (!DEBUG_MODE) return;
    const stats = this.getStats();
    console.log('📊 Статистика кэша:', stats);
  }
}

// Создаем глобальный экземпляр кэша
const cacheManager = new CacheManager();

// Выводим статистику только в DEBUG режиме
if (DEBUG_MODE) {
  setInterval(() => {
    cacheManager.printStats();
  }, 5 * 60 * 1000);
}

module.exports = cacheManager;