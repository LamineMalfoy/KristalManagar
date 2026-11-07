const util = require('util');
const { query } = require('../databases');
const databaseQuery = util.promisify(query);
const vk = require('../vkInstance.js');

const BUSINESSES = [
  { id: 1, name: 'Шаурмичная', income: [2500, 3750, 5000, 6250, 8750, 11250, 13750, 17500, 22500, 30000] },
  { id: 2, name: 'Кафе', income: [10000, 15000, 20000, 25000, 35000, 45000, 55000, 70000, 90000, 120000] },
  { id: 3, name: 'Большое Кафе', income: [25000, 37500, 50000, 62500, 87500, 112500, 137500, 175000, 225000, 300000] },
  { id: 4, name: 'Ресторан', income: [50000, 75000, 100000, 125000, 175000, 225000, 275000, 350000, 450000, 600000] },
  { id: 5, name: 'Отель', income: [250000, 375000, 500000, 625000, 875000, 1125000, 1375000, 1750000, 2250000, 3000000] },
  { id: 6, name: 'Сеть отелей', income: [2500000, 3750000, 5000000, 6250000, 8750000, 11250000, 13750000, 17500000, 22500000, 30000000] },
  { id: 7, name: 'Казино', income: [15000000, 22500000, 30000000, 37500000, 52500000, 67500000, 82500000, 105000000, 135000000, 180000000] },
  { id: 8, name: 'Остров Las-Vegas', income: [35000000, 52500000, 70000000, 87500000, 122500000, 157500000, 192500000, 245000000, 315000000, 420000000] },
  { id: 9, name: 'Страна', income: [50000000, 75000000, 100000000, 125000000, 175000000, 225000000, 275000000, 350000000, 450000000, 600000000] },
  { id: 10, name: 'Логово разработчика', income: [250000000, 375000000, 500000000, 625000000, 875000000, 1125000000, 1375000000, 1750000000, 2250000000, 3000000000] }
];

function formatRub(amount) {
  return Number(amount || 0).toLocaleString('de-DE') + '₽';
}

// Начисление дохода с учётом времени (как в /бизнес, /снять, /закрыть)
function accrueIncome(biz, info, now = Date.now()) {
  const level = Math.min(Math.max(Number(biz.level) || 1, 1), 10);
  const hourlyIncome = info.income[level - 1];
  const perMs = hourlyIncome / (60 * 60 * 1000);

  const lastCollect = Number(biz.last_collect) || now;
  const elapsed = Math.max(0, now - lastCollect);

  const accrued = Math.floor(elapsed * perMs);
  const accum = Number(biz.accum) || 0;

  return {
    level,
    hourlyIncome,
    accrued,
    newAccum: accum + accrued,
  };
}

async function getLink(userId) {
  try {
    const users = await vk.api.users.get({ user_ids: [userId] });
    if (users && users[0]) return `[id${userId}|${users[0].first_name} ${users[0].last_name}]`;
  } catch (e) {}
  return `[id${userId}|Пользователь]`;
}

module.exports = {
  command: '/топбиз',
  description: 'Топ по балансу бизнеса',
  aliases: ['/topbusiness', '/topbiz'],

  async execute(context) {
    try {
      const all = await databaseQuery('SELECT * FROM user_businesses');
      if (!all || !all.length) return context.send('❌ Пока ни у кого нет бизнесов.');

      const now = Date.now();
      const rows = [];

      // У каждого игрока 1 бизнес — считаем накопленное с учётом времени
      for (const b of all) {
        const info = BUSINESSES.find(x => x.id === Number(b.business_id));
        if (!info) continue;

        const acc = accrueIncome(b, info, now);
        rows.push({
          uid: Number(b.user_id),
          name: info.name,
          level: acc.level,
          sum: acc.newAccum,
        });
      }

      // Сортируем по накопленному
      rows.sort((a, b) => b.sum - a.sum);
      const top = rows.slice(0, 10);

      let msg = `💰 Топ по бизнесу\n\n`;
      for (let i = 0; i < top.length; i++) {
        const r = top[i];
        const link = await getLink(r.uid);
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
        msg += `${medal} ${link} – ${formatRub(r.sum)}\n`;
        msg += `   └ ${r.name} (${r.level}/10)\n`;
      }

      return context.send(msg);

    } catch (e) {
      console.error('Ошибка в /топбиз:', e);
      return context.send('❌ Ошибка при получении топа');
    }
  }
};