const util = require('util');
const { query } = require('../databases');
const databaseQuery = util.promisify(query);
const { formatRub } = require('../filedb.js');
const { BUSINESSES } = require('./business.js');

async function getUserBusinesses(userId) {
  const res = await databaseQuery('SELECT * FROM user_businesses WHERE user_id = ?', [userId]);
  return res || [];
}

module.exports = {
  command: '/бизнес',
  description: 'Мои бизнесы',
  aliases: ['/mybusiness', '/бизнес'],

  async execute(context) {
    try {
      const userId = context.senderId;
      const list = await getUserBusinesses(userId);

      if (!list.length) {
        return context.send('🏢 У вас пока нет бизнесов.\nНапишите /business, чтобы посмотреть доступные.');
      }

      let totalIncome = 0;
      let totalAccum = 0;
      let lines = '';

      for (const b of list) {
        const info = BUSINESSES.find(x => x.id === Number(b.business_id));
        if (!info) continue;
        const level = Math.min(Math.max(Number(b.level) || 1, 1), 10);
        const income = info.income[level - 1];
        totalIncome += income;

        const now = Math.floor(Date.now() / 1000);
        const last = Number(b.last_collect) || now;
        const hours = Math.floor((now - last) / 3600);
        const accum = hours * income;
        totalAccum += accum;

        lines += `• ${info.name} — ${level} ур. — доход/час: ${formatRub(income)} — накоплено: ${formatRub(accum)}\n`;
      }

      const msg =
        `🏢 Управление бизнесами:\n\n` +
        `🏪 Всего филиалов: ${list.length}\n` +
        `🏭 Бизнесы:\n${lines}\n` +
        `🎯 Уровни: ${list.map(b => b.level).join(', ')}\n` +
        `💸 Доход: ${formatRub(totalIncome)}/час\n` +
        `💎 Всего накоплено: ${formatRub(totalAccum)}`;

      return context.send(msg);

    } catch (e) {
      console.error('Ошибка в /бизнес:', e);
      return context.send('❌ Ошибка');
    }
  }
};