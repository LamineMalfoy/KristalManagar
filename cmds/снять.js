const util = require('util');
const { query } = require('../databases');
const databaseQuery = util.promisify(query);
const { getUserBalance, updateUserBalance } = require('../filedb.js');
const { BUSINESSES } = require('./business.js');

function formatRub(amount) {
  return Number(amount || 0).toLocaleString('de-DE') + '₽';
}

// Начисление дохода с учётом времени (как в /бизнес)
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
    newLastCollect: now,
  };
}

module.exports = {
  command: '/снять',
  description: 'Снять доход с бизнеса',
  aliases: ['/collect', '/собрать'],

  async execute(context) {
    try {
      const userId = context.senderId;

      const list = await databaseQuery('SELECT * FROM user_businesses WHERE user_id = ?', [userId]);
      if (!list || !list.length) return context.send('🏢 У вас нет бизнеса. Купите через /бизнес');

      const biz = list[0]; // у игрока только 1 бизнес
      const info = BUSINESSES.find(x => x.id === Number(biz.business_id));
      if (!info) return context.send('❌ Бизнес не найден');

      // ── Начисляем доход на текущий момент ──
      const now = Date.now();
      const acc = accrueIncome(biz, info, now);

      if (acc.newAccum <= 0) {
        return context.send(`⏳ Пока нечего снимать.\n💸 Доход/час: ${formatRub(acc.hourlyIncome)}`);
      }

      // ── Снимаем всё накопленное ──
      const balance = await getUserBalance(userId);
      await updateUserBalance(userId, balance + acc.newAccum);

      await databaseQuery(
        'UPDATE user_businesses SET accum = 0, last_collect = ? WHERE id = ?',
        [now, biz.id]
      );

      return context.send(
        `💰 Вы сняли ${formatRub(acc.newAccum)} с «${info.name}»`
      );

    } catch (e) {
      console.error('Ошибка в /снять:', e);
      return context.send('❌ Ошибка при снятии дохода');
    }
  }
};