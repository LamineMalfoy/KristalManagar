/**
 * 🚀 Оптимизатор для файловой базы данных
 * Специально для больших чатов с файловым хранилищем
 */

const fs = require('fs').promises;
const path = require('path');
const cacheManager = require('./cache_manager.js');

class FileDBOptimizer {
  constructor() {
    this.dataDir = path.join(__dirname, 'data');
    
    // Кэш для файлов (дополнительно к основному кэшу)
    this.fileCache = new Map();
    this.fileCacheTTL = 30000; // 30 секунд для файлов
    
    console.log('🚀 FileDBOptimizer инициализирован');
  }
  
  /**
   * Оптимизированное чтение роли пользователя
   */
  async getUserRoleOptimized(conferenceId, userId) {
    // Сначала проверяем основной кэш
    const cachedRole = cacheManager.getUserRole(conferenceId, userId);
    if (cachedRole !== null) {
      return cachedRole;
    }
    
    try {
      const roleFile = path.join(this.dataDir, `roles_${conferenceId}`, `${userId}.json`);
      
      // Проверяем файловый кэш
      const cacheKey = `role_${conferenceId}_${userId}`;
      const cached = this.fileCache.get(cacheKey);
      
      if (cached && (Date.now() - cached.timestamp) < this.fileCacheTTL) {
        const role = cached.data.role_id || 0;
        cacheManager.setUserRole(conferenceId, userId, role);
        return role;
      }
      
      // Читаем файл
      const data = await fs.readFile(roleFile, 'utf8');
      const roleData = JSON.parse(data);
      
      // Сохраняем в файловый кэш
      this.fileCache.set(cacheKey, {
        data: roleData,
        timestamp: Date.now()
      });
      
      const role = roleData.role_id || 0;
      cacheManager.setUserRole(conferenceId, userId, role);
      
      return role;
      
    } catch (error) {
      // Файл не существует или поврежден - роль 0
      const role = 0;
      cacheManager.setUserRole(conferenceId, userId, role);
      return role;
    }
  }
  
  /**
   * Батчинг ролей для файловой БД
   */
  async getUserRolesBatch(conferenceId, userIds) {
    const roles = new Map();
    const uncachedIds = [];
    
    // Проверяем кэш для всех пользователей
    for (const userId of userIds) {
      const cachedRole = cacheManager.getUserRole(conferenceId, userId);
      if (cachedRole !== null) {
        roles.set(userId, cachedRole);
      } else {
        uncachedIds.push(userId);
      }
    }
    
    // Для некэшированных читаем файлы параллельно
    if (uncachedIds.length > 0) {
      const promises = uncachedIds.map(async (userId) => {
        try {
          const role = await this.getUserRoleOptimized(conferenceId, userId);
          return { userId, role };
        } catch (error) {
          return { userId, role: 0 };
        }
      });
      
      const results = await Promise.all(promises);
      
      for (const { userId, role } of results) {
        roles.set(userId, role);
      }
    }
    
    return roles;
  }
  
  /**
   * Оптимизированное чтение настроек чата
   */
  async getChatSettingsOptimized(peerId) {
    // Проверяем основной кэш
    const cachedSettings = cacheManager.getChatSettings(peerId);
    if (cachedSettings !== null) {
      return cachedSettings;
    }
    
    try {
      const settingsFile = path.join(this.dataDir, 'conference', `${peerId}.json`);
      
      // Проверяем файловый кэш
      const cacheKey = `settings_${peerId}`;
      const cached = this.fileCache.get(cacheKey);
      
      if (cached && (Date.now() - cached.timestamp) < this.fileCacheTTL) {
        cacheManager.setChatSettings(peerId, cached.data);
        return cached.data;
      }
      
      // Читаем файл
      const data = await fs.readFile(settingsFile, 'utf8');
      const settings = JSON.parse(data);
      
      // Сохраняем в кэши
      this.fileCache.set(cacheKey, {
        data: settings,
        timestamp: Date.now()
      });
      
      cacheManager.setChatSettings(peerId, settings);
      
      return settings;
      
    } catch (error) {
      // Файл не существует - дефолтные настройки
      const defaultSettings = {
        spam: 0,
        links: 0,
        attachments: [],
        cooldown: 0,
        groups: 0,
        stickers: 0,
        docs: 0,
        images: 0,
        video: 0,
        reposts: 0
      };
      
      cacheManager.setChatSettings(peerId, defaultSettings);
      return defaultSettings;
    }
  }
  
  /**
   * Инвалидация файлового кэша настроек чата
   */
  invalidateFileCacheChatSettings(peerId) {
    const cacheKey = `settings_${peerId}`;
    this.fileCache.delete(cacheKey);
  }
  
  /**
   * Оптимизированное получение банлиста
   */
  async getBanListOptimized(peerId) {
    // Проверяем основной кэш
    const cachedBanList = cacheManager.getBanList(peerId);
    if (cachedBanList !== null) {
      return cachedBanList;
    }
    
    try {
      const banlistDir = path.join(this.dataDir, 'conference');
      const files = await fs.readdir(banlistDir);
      
      const banList = [];
      
      // Читаем файлы параллельно (но ограничиваем количество)
      const conferenceFiles = files.filter(f => f.startsWith(`${peerId}_`) && f.endsWith('.json'));
      const batchSize = 10; // Читаем по 10 файлов одновременно
      
      for (let i = 0; i < conferenceFiles.length; i += batchSize) {
        const batch = conferenceFiles.slice(i, i + batchSize);
        
        const promises = batch.map(async (file) => {
          try {
            const filePath = path.join(banlistDir, file);
            const data = await fs.readFile(filePath, 'utf8');
            const userData = JSON.parse(data);
            
            if (userData.blocked_users && Array.isArray(userData.blocked_users)) {
              return userData.blocked_users;
            }
          } catch (error) {
            return [];
          }
          return [];
        });
        
        const batchResults = await Promise.all(promises);
        
        for (const blockedUsers of batchResults) {
          banList.push(...blockedUsers);
        }
      }
      
      // Сохраняем в кэш
      cacheManager.setBanList(peerId, banList);
      
      return banList;
      
    } catch (error) {
      console.error('Ошибка при получении банлиста:', error);
      return [];
    }
  }
  
  /**
   * Очистка файлового кэша
   */
  cleanup() {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, value] of this.fileCache.entries()) {
      if (now - value.timestamp > this.fileCacheTTL) {
        this.fileCache.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      console.log(`🧹 Файловый кэш очищен: ${cleaned} записей`);
    }
  }
  
  /**
   * Статистика файлового кэша
   */
  getStats() {
    return {
      fileCacheSize: this.fileCache.size,
      fileCacheTTL: this.fileCacheTTL
    };
  }
}

// Создаем глобальный оптимизатор
const fileDBOptimizer = new FileDBOptimizer();

// Очистка кэша каждые 30 секунд
setInterval(() => {
  fileDBOptimizer.cleanup();
}, 30000);

module.exports = fileDBOptimizer;