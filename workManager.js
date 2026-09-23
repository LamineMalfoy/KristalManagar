const fs = require('fs');
const path = require('path');

// Хранилище активных работников
const activeWorkers = new Map(); // userId -> { peerId, startTime, lastActivity, timeoutId }

// Путь к файлу для сохранения работников
const WORKERS_FILE = path.join(__dirname, 'data', 'active_workers.json');

// Загрузка работников из файла при запуске
function loadWorkers() {
  try {
    if (fs.existsSync(WORKERS_FILE)) {
      const data = JSON.parse(fs.readFileSync(WORKERS_FILE, 'utf8'));
      for (const [userId, workerData] of Object.entries(data)) {
        activeWorkers.set(parseInt(userId), {
          ...workerData,
          startTime: new Date(workerData.startTime),
          lastActivity: new Date(workerData.lastActivity),
          timeoutId: null // Таймеры не сохраняются, создадим заново
        });
        
        // Создаем новый таймер для загруженного работника
        startFireTimer(parseInt(userId), workerData.peerId);
      }
    }
  } catch (error) {
    console.error('Ошибка при загрузке работников:', error);
  }
}

// Сохранение работников в файл
function saveWorkers() {
  try {
    const dataDir = path.dirname(WORKERS_FILE);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    const data = {};
    for (const [userId, workerData] of activeWorkers.entries()) {
      data[userId] = {
        peerId: workerData.peerId,
        startTime: workerData.startTime.toISOString(),
        lastActivity: workerData.lastActivity.toISOString()
      };
    }
    
    fs.writeFileSync(WORKERS_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Ошибка при сохранении работников:', error);
  }
}

// Устроить на работу
function hireWorker(userId, peerId) {
  const now = new Date();
  
  // Если уже работает, обновляем активность
  if (activeWorkers.has(userId)) {
    const worker = activeWorkers.get(userId);
    worker.lastActivity = now;
    clearTimeout(worker.timeoutId);
    worker.timeoutId = startFireTimer(userId, peerId);
    saveWorkers();
    return false; // Уже работает
  }
  
  // Устраиваем на работу
  const worker = {
    peerId: peerId,
    startTime: now,
    lastActivity: now,
    timeoutId: startFireTimer(userId, peerId)
  };
  
  activeWorkers.set(userId, worker);
  saveWorkers();
  return true; // Новый работник
}

// Проверить, работает ли пользователь
function isWorking(userId) {
  return activeWorkers.has(userId);
}

// Обновить активность работника
function updateActivity(userId) {
  if (activeWorkers.has(userId)) {
    const worker = activeWorkers.get(userId);
    worker.lastActivity = new Date();
    
    // Сбрасываем таймер увольнения
    clearTimeout(worker.timeoutId);
    worker.timeoutId = startFireTimer(userId, worker.peerId);
    
    saveWorkers();
    return true;
  }
  return false;
}

// Уволить работника
function fireWorker(userId, reason = 'Уволен') {
  if (activeWorkers.has(userId)) {
    const worker = activeWorkers.get(userId);
    clearTimeout(worker.timeoutId);
    activeWorkers.delete(userId);
    saveWorkers();
    return worker.peerId;
  }
  return null;
}

// Запустить таймер увольнения (5 минут)
function startFireTimer(userId, peerId) {
  return setTimeout(async () => {
    try {
      const vk = require('./vkInstance');
      const { getlink } = require('./util');
      
      // Увольняем работника
      fireWorker(userId);
      
      // Получаем имя пользователя
      const userName = await getlink(userId);
      
      // Отправляем сообщение об увольнении
      await vk.api.messages.send({
        peer_id: peerId,
        message: `🔥 ${userName} уволен за некомпетентность!\n\n⏰ Причина: не работал более 5 минут`,
        random_id: Math.floor(Math.random() * 1000000)
      });
      
      console.log(`Работник ${userId} уволен за неактивность`);
    } catch (error) {
      console.error('Ошибка при увольнении работника:', error);
    }
  }, 5 * 60 * 1000); // 5 минут
}

// Получить информацию о работнике
function getWorkerInfo(userId) {
  if (activeWorkers.has(userId)) {
    const worker = activeWorkers.get(userId);
    const now = new Date();
    const workTime = Math.floor((now - worker.startTime) / 1000); // в секундах
    const lastActivity = Math.floor((now - worker.lastActivity) / 1000); // в секундах
    
    return {
      peerId: worker.peerId,
      workTime: workTime,
      lastActivity: lastActivity,
      isActive: lastActivity < 300 // активен, если последняя активность менее 5 минут назад
    };
  }
  return null;
}

// Получить всех активных работников
function getAllWorkers() {
  return Array.from(activeWorkers.entries()).map(([userId, worker]) => ({
    userId: userId,
    peerId: worker.peerId,
    startTime: worker.startTime,
    lastActivity: worker.lastActivity
  }));
}

// Загружаем работников при импорте модуля
loadWorkers();

module.exports = {
  hireWorker,
  isWorking,
  updateActivity,
  fireWorker,
  getWorkerInfo,
  getAllWorkers
};
