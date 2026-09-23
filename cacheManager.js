// Менеджер кэша для оптимизации производительности бота
class CacheManager {
  constructor() {
    // Кэш ролей пользователей
    this.userRoles = new Map();
    // Кэш информации о пользователях VK
    this.vkUsers = new Map();
    // Кэш участников беседы
    this.conversationMembers = new Map();
    // Кэш никнеймов
    this.userNames = new Map();
    // Кэш VIP статусов
    this.vipStatuses = new Map();
    // Кэш браков
    this.marriages = new Map();
    // Кэш настроек конференций
    this.conferenceSettings = new Map();
    // Кэш командного доступа
    this.commandAccess = new Map();
    // Кэш приоритетов команд
    this.commandPriorities = new Map();
    
    // Время жизни кэша (в миллисекундах)
    this.TTL = {
      userRoles: 5 * 60 * 1000,        // 5 минут
      vkUsers: 30 * 60 * 1000,         // 30 минут
      conversationMembers: 10 * 60 * 1000, // 10 минут
      userNames: 10 * 60 * 1000,       // 10 минут
      vipStatuses: 15 * 60 * 1000,     // 15 минут
      marriages: 30 * 60 * 1000,       // 30 минут
      conferenceSettings: 5 * 60 * 1000,   // 5 минут
      commandAccess: 5 * 60 * 1000,    // 5 минут
      commandPriorities: 5 * 60 * 1000  // 5 минут
    };
    
    // Метаданные для отслеживания времени
    this.metadata = new Map();
    
    // Статистика использования кэша
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0
    };
    
    // Запускаем периодическую очистку устаревшего кэша
    this.startCleanupTimer();
  }
  
  // Генерация ключа для кэша
  generateKey(...args) {
    return args.join('_');
  }
  
  // Получение данных из кэша
  get(cacheName, key) {
    const cache = this[cacheName];
    if (!cache || !(cache instanceof Map)) return null;
    
    const fullKey = typeof key === 'string' ? key : this.generateKey(...key);
    const metaKey = `${cacheName}_${fullKey}`;
    
    // Проверяем, не истек ли TTL
    const metadata = this.metadata.get(metaKey);
    if (metadata) {
      const age = Date.now() - metadata.timestamp;
      if (age > this.TTL[cacheName]) {
        // Кэш устарел, удаляем
        cache.delete(fullKey);
        this.metadata.delete(metaKey);
        this.stats.evictions++;
        return null;
      }
    }
    
    if (cache.has(fullKey)) {
      this.stats.hits++;
      return cache.get(fullKey);
    }
    
    this.stats.misses++;
    return null;
  }
  
  // Сохранение данных в кэш
  set(cacheName, key, value) {
    const cache = this[cacheName];
    if (!cache || !(cache instanceof Map)) return false;
    
    const fullKey = typeof key === 'string' ? key : this.generateKey(...key);
    const metaKey = `${cacheName}_${fullKey}`;
    
    cache.set(fullKey, value);
    this.metadata.set(metaKey, {
      timestamp: Date.now(),
      cacheName: cacheName
    });
    
    // Ограничиваем размер кэша
    this.checkCacheSize(cacheName);
    
    return true;
  }
  
  // Инвалидация кэша
  invalidate(cacheName, key = null) {
    const cache = this[cacheName];
    if (!cache || !(cache instanceof Map)) return false;
    
    if (key === null) {
      // Очищаем весь кэш для данной категории
      cache.clear();
      // Удаляем соответствующие метаданные
      for (const [metaKey, meta] of this.metadata.entries()) {
        if (meta.cacheName === cacheName) {
          this.metadata.delete(metaKey);
        }
      }
    } else {
      // Удаляем конкретный ключ
      const fullKey = typeof key === 'string' ? key : this.generateKey(...key);
      cache.delete(fullKey);
      this.metadata.delete(`${cacheName}_${fullKey}`);
    }
    
    return true;
  }
  
  // Проверка размера кэша и удаление старых записей при необходимости
  checkCacheSize(cacheName) {
    const cache = this[cacheName];
    const maxSize = 1000; // Максимальное количество записей в кэше
    
    if (cache.size > maxSize) {
      // Удаляем самые старые записи
      const sortedEntries = [];
      for (const [key, value] of cache.entries()) {
        const metaKey = `${cacheName}_${key}`;
        const metadata = this.metadata.get(metaKey);
        if (metadata) {
          sortedEntries.push({
            key,
            timestamp: metadata.timestamp
          });
        }
      }
      
      // Сортируем по времени создания
      sortedEntries.sort((a, b) => a.timestamp - b.timestamp);
      
      // Удаляем 20% самых старых записей
      const toRemove = Math.floor(maxSize * 0.2);
      for (let i = 0; i < toRemove && i < sortedEntries.length; i++) {
        cache.delete(sortedEntries[i].key);
        this.metadata.delete(`${cacheName}_${sortedEntries[i].key}`);
        this.stats.evictions++;
      }
    }
  }
  
  // Периодическая очистка устаревшего кэша
  startCleanupTimer() {
    setInterval(() => {
      const now = Date.now();
      const toDelete = [];
      
      for (const [metaKey, meta] of this.metadata.entries()) {
        const age = now - meta.timestamp;
        if (age > this.TTL[meta.cacheName]) {
          toDelete.push(metaKey);
        }
      }
      
      for (const metaKey of toDelete) {
        const [cacheName, ...keyParts] = metaKey.split('_');
        const key = keyParts.join('_');
        const cache = this[cacheName];
        if (cache && cache instanceof Map) {
          cache.delete(key);
        }
        this.metadata.delete(metaKey);
        this.stats.evictions++;
      }
    }, 60 * 1000); // Проверяем каждую минуту
  }
  
  // Получение статистики кэша
  getStats() {
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? (this.stats.hits / totalRequests * 100).toFixed(2) : 0;
    
    return {
      ...this.stats,
      hitRate: `${hitRate}%`,
      totalCacheSize: this.getTotalSize(),
      cacheDetails: {
        userRoles: this.userRoles.size,
        vkUsers: this.vkUsers.size,
        conversationMembers: this.conversationMembers.size,
        userNames: this.userNames.size,
        vipStatuses: this.vipStatuses.size,
        marriages: this.marriages.size,
        conferenceSettings: this.conferenceSettings.size,
        commandAccess: this.commandAccess.size
      }
    };
  }
  
  // Получение общего размера кэша
  getTotalSize() {
    let total = 0;
    for (const cacheName of Object.keys(this.TTL)) {
      const cache = this[cacheName];
      if (cache && cache instanceof Map) {
        total += cache.size;
      }
    }
    return total;
  }
  
  // Сброс всего кэша
  reset() {
    for (const cacheName of Object.keys(this.TTL)) {
      const cache = this[cacheName];
      if (cache && cache instanceof Map) {
        cache.clear();
      }
    }
    this.metadata.clear();
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0
    };
  }
}

// Создаем глобальный экземпляр менеджера кэша
const cacheManager = new CacheManager();

// Экспортируем для использования в других модулях
module.exports = cacheManager;
