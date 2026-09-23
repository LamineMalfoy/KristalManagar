const fs = require('fs');
const path = require('path');
const { getUserBalance, updateUserBalance } = require('../filedb.js');

const DATA_FILE = path.join(__dirname, '..', 'data', 'deposits.json');
const RATES = { 4: 0.25, 8: 0.50, 10: 0.75 };

function load() {
  try {
    if (fs.existsSync(DATA_FILE)) return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (e) {}
  return {};
}
function save(data) {
  try {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {}
}
function formatRub(amount) {
  return Number(amount || 0).toLocaleString('de-DE') + '₽';
}
function parseAmount(str) {
  const s = String(str).toLowerCase().trim();
  if (s.includes('ккк')) return parseFloat(s.replace('ккк', '')) * 1000000000000;
  if (s.includes('млрд')) return parseFloat(s.replace('млрд', '')) * 1000000000;
  if (s.includes('кк')) return parseFloat(s.replace('кк', '')) * 1000000;
  if (s.includes('к')) return parseFloat(s.replace('к', '')) * 1000;
  return parseFloat(s) || 0;
}

module.exports = {
  command: '/открытьдепозит',
  description: 'Открыть депозит',
  aliases: ['/deposit'],

  async execute(context) {
    try {
      const userId = context.senderId;
      const text = context.text || '';
      const parts = text.trim().split(/\s+/).slice(1);

      if (parts.length < 2) {
        return context.send(`🏦 /открытьдепозит <дней> <сумма>

Дни: 4, 8 или 10
Проценты:
• 4 дня — 25%
• 8 дней — 50%
• 10 дней — 75%

Пример: /открытьдепозит 4 20000000`);
      }

      const days = parseInt(parts[0]);
      const amount = parseAmount(parts[1]);

      if (!RATES[days]) {
        return context.send('❌ Дни должны быть: 4, 8 или 10');
      }
      if (!amount || amount <= 0) {
        return context.send('❌ Неверная сумма');
      }

      const balance = await getUserBalance(userId);
      if (balance < amount) {
        return context.send(`❌ Недостаточно средств\n💰 Баланс: ${formatRub(balance)}`);
      }

      const deposits = load();
      if (deposits[userId] && deposits[userId].active) {
        return context.send('❌ У вас уже есть активный депозит');
      }

      await updateUserBalance(userId, balance - amount);

      const now = Date.now();
      const endAt = now + days * 24 * 60 * 60 * 1000;
      const payout = Math.floor(amount * (1 + RATES[days]));

      deposits[userId] = {
        amount,
        days,
        rate: RATES[days],
        endAt,
        payout,
        active: true
      };
      save(deposits);

      return context.send(`🏦 Депозит открыт!

💰 Вложено: ${formatRub(amount)}
📅 Срок: ${days} дней
📈 Процент: ${RATES[days] * 100}%
💵 К возврату: ${formatRub(payout)}
⏰ Окончание: ${new Date(endAt).toLocaleString('ru-RU')}`);

    } catch (e) {
      console.error('Ошибка в /открытьдепозит:', e);
      return context.send('❌ Ошибка');
    }
  }
};