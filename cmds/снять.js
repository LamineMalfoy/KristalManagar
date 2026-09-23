const util = require('util');
const { query } = require('../databases');
const databaseQuery = util.promisify(query);
const { getUserBalance, updateUserBalance, formatRub } = require('../filedb.js');
const { BUSINESSES } = require('./business.js');

module.exports = {
  command: '/снять',
  description: 'Снять доход с бизнеса',
  aliases: ['/collect', '/собрать'],

  async execute(context) {
    try {
      const userId = context.senderId;
      const text = context.text || '';
      const parts = text.trim().split(/\s+/).slice(1);

      const list = await databaseQuery('SELECT * FROM user_businesses WHERE user_id = ?', [userId]);
      if (!list || !list.length) {
        return context.send('🏢 У вас нет бизнесов. Купите через /business');
      }

      if (parts.length < 1) {
        let msg = `💰 Снять доход с бизнеса\n\n📋 Ваши бизнесы:\n`;
        for (let i = 0; i < list.length; i++) {
          const info = BUSINESSES.find(x => x.id === Number(list[i].business_id));
          if (!info) continue;
          const level = Math.min(Math.max(Number(list[i].level) || 1, 1), 10);
          const income = info.income[level - 1];
          const now = Math.floor(Date.now() / 1000);
          const last = Number(list[i].last_collect) || now;
          const hours = Math.floor((now - last) / 3600);
          const accum = hours * income;
          msg += `${i + 1}. ${info.name} — накоплено: ${formatRub(accum)}\n`;
        }
        msg += `\nИспользование: /снять <номер>`;
        return context.send(msg);
      }

      const idx = parseInt(parts[0]) - 1;
      if (isNaN(idx) || !list[idx]) {
        return context.send('❌ Неверный номер бизнеса');
      }

      const biz = list[idx];
      const info = BUSINESSES.find(x => x.id === Number(biz.business_id));
      if (!info) return context.send('❌ Бизнес не найден');

      const level = Math.min(Math.max(Number(biz.level) || 1, 1), 10);
      const income = info.income[level - 1];

      const now = Math.floor(Date.now() / 1000);
      const last = Number(biz.last_collect) || now;
      const hours = Math.floor((now - last) / 3600);
      const accum = hours * income;

      if (accum <= 0) {
        return context.send('⏳ Пока нечего снимать. Подождите хотя бы час.');
      }

      const balance = await getUserBalance(userId);
      await updateUserBalance(userId, balance + accum);

      await databaseQuery(
        'UPDATE user_businesses SET last_collect = ? WHERE user_id = ? AND business_id = ?',
        [now, userId, biz.business_id]
      );

      return context.send(`💰 Вы сняли ${formatRub(accum)} с «${info.name}»`);

    } catch (e) {
      console.error('Ошибка в /снять:', e);
      return context.send('❌ Ошибка при снятии дохода');
    }
  }
};