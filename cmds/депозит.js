const fs = require('fs');
const path = require('path');
const util = require('util');
const { query } = require('../databases');
const databaseQuery = util.promisify(query);
const { getUserBalance, updateUserBalance } = require('../filedb.js');

const DATA_FILE = path.join(__dirname, '..', 'data', 'deposits.json');

function load() {
  try {
    if (fs.existsSync(DATA_FILE)) return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (e) {
    console.error('Ошибка загрузки deposits.json:', e.message);
  }
  return {};
}

function save(data) {
  try {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Ошибка сохранения deposits.json:', e.message);
  }
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

// ── Автоматическая выплата истёкших депозитов ──
let processing = false;
async function processDeposits() {
  if (processing) return;
  processing = true;
  try {
    const deposits = load();
    const now = Date.now();
    let changed = false;

    for (const [userId, dep] of Object.entries(deposits)) {
      if (!dep || !dep.active || !dep.endAt) continue;
      if (now < dep.endAt) continue;

      // Срок истёк — выплачиваем
      try {
        const balance = Number(await getUserBalance(userId));
        const payout = Number(dep.payout) || 0;
        await updateUserBalance(userId, balance + payout);

        // Уведомляем игрока
        try {
          const vk = require('../vkInstance.js');
          await vk.api.messages.send({
            user_id: Number(userId),
            message: `🏦 Депозит закрыт!\n\n💸 Вложено: ${formatRub(dep.amount)}\n📈 Процент: ${(dep.rate * 100).toFixed(0)}%\n💵 Начислено: ${formatRub(payout)}\n\n💰 Деньги зачислены на баланс.`,
            random_id: Math.floor(Math.random() * 1e9)
          });
        } catch (e) {
          // Не смогли уведомить — не критично
        }

        dep.active = false;
        dep.paidAt = now;
        changed = true;
        console.log(`[депозит] Выплачен депозит пользователю ${userId}: ${payout}₽`);
      } catch (e) {
        console.error(`[депозит] Ошибка выплаты ${userId}:`, e.message);
      }
    }

    // Удаляем уже выплаченные (старше суток после выплаты) — чистим мусор
    for (const [userId, dep] of Object.entries(deposits)) {
      if (dep && dep.active === false && dep.paidAt && (now - dep.paidAt) > 86400000) {
        delete deposits[userId];
        changed = true;
      }
    }

    if (changed) save(deposits);
  } catch (e) {
    console.error('[депозит] Ошибка в processDeposits:', e);
  } finally {
    processing = false;
  }
}

// Запускаем автопроверку раз в минуту
const interval = setInterval(processDeposits, 60 * 1000);
if (interval.unref) interval.unref(); // не держим процесс, если он больше не нужен

// Первый прогон сразу при старте
setTimeout(processDeposits, 5000);

module.exports = {
  command: '/депозит',
  description: 'Показать текущий депозит',
  aliases: ['/deposit'],

  processDeposits, // экспорт для ручного вызова/крона

  async execute(context) {
    try {
      const userId = context.senderId;

      // ── Сначала обрабатываем истёкшие депозиты ──
      await processDeposits();

      const deposits = load();
      const my = deposits[userId];

      if (!my || !my.amount || !my.active) {
        if (my && my.active === false && my.paidAt) {
          return context.send(`🏦 Ваш депозит закрыт.\n\n💵 Выплачено: ${formatRub(my.payout)}\n\n📥 Открыть новый: /открытьдепозит <дней> <сумма>`);
        }
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
        msg += `✅ Срок истёк — деньги выплачиваются автоматически`;
      }

      return context.send(msg);

    } catch (error) {
      console.error('Ошибка в /депозит:', error);
      return context.send('❌ Ошибка при получении информации о депозите');
    }
  }
};