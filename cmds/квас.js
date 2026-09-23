const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'data', 'kvas.json');
const COOLDOWN_FILE = path.join(__dirname, '..', 'data', 'kvas_cooldown.json');
const COOLDOWN = 60 * 60 * 1000; // 1 час

function loadData(file) {
  try {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    console.error('Ошибка загрузки:', e.message);
  }
  return {};
}

function saveData(file, data) {
  try {
    const dir = path.dirname(file);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error('Ошибка сохранения:', e.message);
  }
}

function formatTime(ms) {
  const totalSec = Math.ceil(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const parts = [];
  if (h > 0) parts.push(`${h} ч.`);
  if (m > 0) parts.push(`${m} мин.`);
  if (s > 0 && h === 0) parts.push(`${s} сек.`);
  return parts.join(' ');
}

module.exports = {
  command: '/квас',
  description: 'Выпить кваса',
  aliases: ['/kvas'],

  async execute(context) {
    try {
      const userId = context.senderId;
      const now = Date.now();

      const cooldowns = loadData(COOLDOWN_FILE);
      const lastUsed = Number(cooldowns[userId]) || 0;
      const elapsed = now - lastUsed;

      if (elapsed < COOLDOWN) {
        const left = COOLDOWN - elapsed;
        return context.send(`⏳ Ты сможешь выпить квас через ${formatTime(left)}`);
      }

      const data = loadData(DATA_FILE);

      // Сколько выпил в этот раз: 0.1–0.5 л
      const drank = Math.round((Math.random() * 0.4 + 0.1) * 10) / 10;

      // Общий счётчик
      const prev = Number(data[userId]) || 0;
      const total = Math.round((prev + drank) * 10) / 10;
      data[userId] = total;
      saveData(DATA_FILE, data);

      // Обновляем кулдаун
      cooldowns[userId] = now;
      saveData(COOLDOWN_FILE, cooldowns);

      const msg = `🍻 Ты выпил ${drank.toFixed(1)} л. кваса. Выпито всего — ${total.toFixed(1)} л.`;

      return context.send(msg);

    } catch (error) {
      console.error('Ошибка в /квас:', error);
      return context.send('❌ Ошибка при выпивке кваса');
    }
  }
};