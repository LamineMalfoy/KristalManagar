const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'data', 'deposits.json');

function load() {
  try {
    if (fs.existsSync(DATA_FILE)) return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (e) {
    console.error('Ошибка загрузки deposits.json:', e.message);
  }
  return {};
}

function formatRub(amount) {
  return Number(amount || 0).toLocaleString('de-DE') + '₽';
}

function formatTime(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const parts = [];
  if (days > 0) parts.push(`${days} д.`);
  if (h > 0) parts.push(`${h} ч.`);
  if (m > 0) parts.push(`${m} мин.`);
  if (parts.length === 0) parts.push('меньше минуты');
  return parts.join(' ');
}

module.exports = {
  command: '/депозит',
  description: 'Показать текущий депозит',
  aliases: ['/deposit'],

  async execute(context) {
    try {
      const userId = context.senderId;
      const deposits = load();
      const my = deposits[userId];

      if (!my || !my.amount || !my.active) {
        return context.send(`🏦 У вас нет активного депозита.

📥 Открыть: /открытьдепозит <дней> <сумма>
📅 Дни: 4, 8, 10
📈 Проценты: 25%, 50%, 75%`);
      }

      const now = Date.now();
      const left = my.endAt - now;

      let msg = `🏦 Ваш депозит\n\n`;
      msg += `💸 Вложено: ${formatRub(my.amount)}\n`;
      msg += `📅 Срок: ${my.days} дней\n`;
      msg += `📈 Процент: ${(my.rate * 100).toFixed(0)}%\n`;
      msg += `💵 К возврату: ${formatRub(my.payout)}\n`;

      if (left > 0) {
        msg += `⏳ Осталось: ${formatTime(left)}\n`;
        msg += `📆 Закроется: ${new Date(my.endAt).toLocaleString('ru-RU')}`;
      } else {
        msg += `✅ Срок истёк — деньги вернутся в течение минуты`;
      }

      return context.send(msg);

    } catch (error) {
      console.error('Ошибка в /депозит:', error);
      return context.send('❌ Ошибка при получении информации о депозите');
    }
  }
};