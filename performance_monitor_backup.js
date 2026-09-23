/**
 * 🔍 Монитор производительности бота
 * Отслеживает узкие места и предоставляет метрики
 */

class PerformanceMonitor {
  constructor() {
    this.metrics = {
      // Время выполнения операций
      executionTimes: new Map(),
      
      // Счетчики операций
      operationCounts: new Map(),
      
      // Медленные операции (>1 секунды)
      slowOperations: [],
      
      // Использование памяти
      memoryUsage: [],
      
      // Статистика по чатам
      chatStats: new Map(),
      
      // Ошибки
      errors: []
    };
    
    const process = require('process');
    require('dotenv').config();
    const DEBUG_MODE = process.env.DEBUG_MODE === 'true';
    
    // Запускаем мониторинг только в DEBUG режиме
    if (DEBUG_MODE) {
      setInterval(() => this.collectMetrics(), 30000);
      setInterval(() => this.generateReport(), 5 * 60 * 1000);
      console.log('🔍 PerformanceMonitor запущен');
    }
  }
  
  /**
   * Засекаем время начала операции
   */
  startTimer(operationName, context = {}) {
    const timerId = `${operationName}_${Date.now()}_${Math.random()}`;
    
    this.metrics.executionTimes.set(timerId, {
      operation: operationName,
      startTime: Date.now(),
      context: context
    });
    
    return timerId;
  }
  
  /**
   * Завершаем замер времени
   */
  endTimer(timerId) {
    const timerData = this.metrics.executionTimes.get(timerId);
    
    if (!timerData) return;
      .slice(0, 10);
    
    sortedOperations.forEach(([operation, count]) => {
      console.log(`  ${operation}: ${count} раз`);
    });
    
    // Медленные операции
    if (this.metrics.slowOperations.length > 0) {
      console.log('\n⚠️ Медленные операции (>1 сек):');
      const recentSlow = this.metrics.slowOperations.slice(-10);
      
      recentSlow.forEach(slow => {
        const time = new Date(slow.timestamp).toLocaleTimeString();
        console.log(`  ${time}: ${slow.operation} - ${slow.executionTime}мс`);
      });
    }
    
    // Топ чатов по нагрузке
    console.log('\n💬 Топ чатов по нагрузке:');
    const sortedChats = Array.from(this.metrics.chatStats.entries())
      .sort((a, b) => b[1].messageCount - a[1].messageCount)
      .slice(0, 5);
    
    sortedChats.forEach(([chatId, stats]) => {
      console.log(`  Чат ${chatId}:`);
      console.log(`    Сообщений: ${stats.messageCount}`);
      console.log(`    Среднее время: ${stats.averageExecutionTime.toFixed(2)}мс`);
      console.log(`    Медленных операций: ${stats.slowOperations}`);
    });
    
    // Использование памяти
    if (this.metrics.memoryUsage.length > 0) {
      const lastMemory = this.metrics.memoryUsage[this.metrics.memoryUsage.length - 1];
      console.log('\n💾 Использование памяти:');
      console.log(`  RSS: ${(lastMemory.rss / 1024 / 1024).toFixed(2)} MB`);
      console.log(`  Heap Used: ${(lastMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
      console.log(`  Heap Total: ${(lastMemory.heapTotal / 1024 / 1024).toFixed(2)} MB`);
    }
    
    // Недавние ошибки
    if (this.metrics.errors.length > 0) {
      console.log('\n❌ Недавние ошибки:');
      const recentErrors = this.metrics.errors.slice(-5);
      
      recentErrors.forEach(error => {
        const time = new Date(error.timestamp).toLocaleTimeString();
        console.log(`  ${time}: ${error.error}`);
      });
    }
    
    console.log('\n=================================\n');
  }
  
  /**
   * Получить детальную статистику
   */
  getDetailedStats() {
    return {
      operationCounts: Object.fromEntries(this.metrics.operationCounts),
      slowOperations: this.metrics.slowOperations,
      chatStats: Object.fromEntries(this.metrics.chatStats),
      memoryUsage: this.metrics.memoryUsage.slice(-10),
      errors: this.metrics.errors.slice(-10)
    };
  }
  
  /**
   * Сброс статистики
   */
  reset() {
    this.metrics.operationCounts.clear();
    this.metrics.slowOperations = [];
    this.metrics.chatStats.clear();
    this.metrics.memoryUsage = [];
    this.metrics.errors = [];
    
    console.log('📊 Статистика производительности сброшена');
  }
}

// Создаем глобальный монитор
const performanceMonitor = new PerformanceMonitor();

/**
 * Декоратор для автоматического мониторинга функций
 */
function monitorPerformance(operationName) {
  return function(target, propertyName, descriptor) {
    const method = descriptor.value;
    
    descriptor.value = async function(...args) {
      const timerId = performanceMonitor.startTimer(operationName, {
        peerId: this.peerId || args[0]?.peerId
      });
      
      try {
        const result = await method.apply(this, args);
        performanceMonitor.endTimer(timerId);
        return result;
      } catch (error) {
        performanceMonitor.endTimer(timerId);
        performanceMonitor.recordError(error, {
          operation: operationName,
          peerId: this.peerId || args[0]?.peerId
        });
        throw error;
      }
    };
    
    return descriptor;
  };
}

module.exports = {
  performanceMonitor,
  monitorPerformance
};