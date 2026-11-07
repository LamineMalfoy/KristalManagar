const util = require('util');
const { query } = require('../databases');
const databaseQuery = util.promisify(query);
const { BUSINESSES } = require('./business.js');

function formatRub(amount) {
  return Number(amount || 0).toLocaleString('de-DE') + '₽';
}

// Начисление дохода по миллисекундам (как в /бизнес, /снять, /закрыть, /топбиз)
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
    newAccum: accum + accrued,
  };
}

async function getUserBusinesses(userId) {
  const res = await databaseQuery('SELECT * FROM user_businesses WHERE user_id = ?', [userId]);
  return res || [];
}

module.exports = {
  command: '/бизнес',
  description: 'Мой бизнес',
  aliases: ['/mybusiness', '/business'],

  async execute(context) {
    try {
      const userId = context.senderId;
      const list = await getUserBusinesses(userId);

      if (!list.length) {
        const msg = `🏢 У вас пока нет бизнеса.\n\n` +
          `💡 Купить: /бизнес купить <номер>\n` +
          `📋 Доступные: /бизнес`;
        return context.send(msg);
      }

      // У игрока только 1 бизнес
      const b = list[0];
      const info = BUSINESSES.find(x => x.id === Number(b.business_id));
      if (!info) return context.send('❌ Бизнес не найден в базе');

      const now = Date.now();
      const acc = accrueIncome(b, info, now);

      // ── Автосохранение накопленного ──
      if (acc.newAccum !== (Number(b.accum) || 0)) {
        await databaseQuery(
          'UPDATE user_businesses SET accum = ?, last_collect = ? WHERE id = ?',
          [acc.newAccum, now, b.id]
        );
      }

      const msg =
        `🏢 Ваш бизнес: «${info.name}»\n\n` +
        `⭐ Уровень: ${acc.level}/10\n` +
        `💸 Доход/час: ${formatRub(acc.hourlyIncome)}\n` +
        `💎 Накоплено: ${formatRub(acc.newAccum)}\n\n` +
        `━━━━━━━━━━━━━━━\n` +
        `📥 /снять — снять доход\n` +
        `⬆️ /повысить — прокачать бизнес\n` +
        `❌ /закрыть — закрыть бизнес`;

      return context.send(msg);

    } catch (e) {
      console.error('Ошибка в /бизнес:', e);
      return context.send('❌ Ошибка');
    }
  }
};