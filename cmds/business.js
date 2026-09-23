const util = require('util');
const { query } = require('../databases');
const databaseQuery = util.promisify(query);
const { getUserBalance, updateUserBalance } = require('../filedb.js');

// Все бизнесы
const BUSINESSES = [
  { id: 1, name: 'Шаурмичная', price: 50000, income: [2500, 3750, 5000, 6250, 8750, 11250, 13750, 17500, 22500, 30000] },
  { id: 2, name: 'Кафе', price: 300000, income: [10000, 15000, 20000, 25000, 35000, 45000, 55000, 70000, 90000, 120000] },
  { id: 3, name: 'Большое Кафе', price: 650000, income: [25000, 37500, 50000, 62500, 87500, 112500, 137500, 175000, 225000, 300000] },
  { id: 4, name: 'Ресторан', price: 1000000, income: [50000, 75000, 100000, 125000, 175000, 225000, 275000, 350000, 450000, 600000] },
  { id: 5, name: 'Отель', price: 5000000, income: [250000, 375000, 500000, 625000, 875000, 1125000, 1375000, 1750000, 2250000, 3000000] },
  { id: 6, name: 'Сеть отелей', price: 50000000, income: [2500000, 3750000, 5000000, 6250000, 8750000, 11250000, 13750000, 17500000, 22500000, 30000000] },
  { id: 7, name: 'Казино', price: 300000000, income: [15000000, 22500000, 30000000, 37500000, 52500000, 67500000, 82500000, 105000000, 135000000, 180000000] },
  { id: 8, name: 'Остров Las-Vegas', price: 700000000, income: [35000000, 52500000, 70000000, 87500000, 122500000, 157500000, 192500000, 245000000, 315000000, 420000000] },
  { id: 9, name: 'Страна', price: 1000000000, income: [50000000, 75000000, 100000000, 125000000, 175000000, 225000000, 275000000, 350000000, 450000000, 600000000] },
  { id: 10, name: 'Логово разработчика', price: 5000000000, income: [250000000, 375000000, 500000000, 625000000, 875000000, 1125000000, 1375000000, 1750000000, 2250000000, 3000000000] }
];

function formatRub(amount) {
  return Number(amount || 0).toLocaleString('ru-RU') + '₽';
}

module.exports = {
  command: '/бизнес',
  description: 'Управление бизнесами',
  aliases: ['/business', '/бизнесы', '/mybusiness'],

  async execute(context) {
    try {
      const userId = context.senderId;
      const text = context.text || '';
      const parts = text.trim().split(/\s+/).slice(1);

      // ─── Покупка бизнеса: /бизнес купить <номер> ───
      if (parts[0] === 'купить' || parts[0] === 'buy') {
        const bizId = parseInt(parts[1]);
        if (!bizId || bizId < 1 || bizId > 10) {
          return context.send('❌ Укажите номер бизнеса (1–10). Пример: /бизнес купить 1');
        }

        const biz = BUSINESSES.find(b => b.id === bizId);
        if (!biz) return context.send('❌ Бизнес не найден');

        // Проверяем, есть ли уже такой бизнес
        const existing = await databaseQuery(
          'SELECT * FROM user_businesses WHERE user_id = ? AND business_id = ?',
          [userId, bizId]
        );
        if (existing && existing[0]) {
          return context.send(`❌ У вас уже есть «${biz.name}»`);
        }

        const balance = await getUserBalance(userId);
        if (balance < biz.price) {
          return context.send(`❌ Недостаточно средств\n💰 Нужно: ${formatRub(biz.price)}\n💵 У вас: ${formatRub(balance)}`);
        }

        await updateUserBalance(userId, balance - biz.price);
        await databaseQuery(
          'INSERT INTO user_businesses (user_id, business_id, level, last_collect) VALUES (?, ?, 1, ?)',
          [userId, bizId, Math.floor(Date.now() / 1000)]
        );

        return context.send(`✅ Вы купили «${biz.name}» за ${formatRub(biz.price)}!\n\nУправление: /бизнес`);
      }

      // ─── Список моих бизнесов ───
      const myBiz = await databaseQuery('SELECT * FROM user_businesses WHERE user_id = ?', [userId]);

      if (!myBiz || !myBiz.length) {
        let message = `🏢 У вас пока нет бизнесов.\n\n📋 Доступные бизнесы:\n\n`;
        for (const b of BUSINESSES) {
          message += `${b.id}. ${b.name} — ${formatRub(b.price)}\n`;
        }
        message += `\n💡 Купить: /бизнес купить <номер>`;
        return context.send(message);
      }

      // ─── Показ своих бизнесов ───
      let totalIncome = 0;
      let totalAccum = 0;
      let lines = '';

      for (let i = 0; i < myBiz.length; i++) {
        const b = myBiz[i];
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

        lines += `${i + 1}. ${info.name} — ${level}/10 ур. — доход/час: ${formatRub(income)} — накоплено: ${formatRub(accum)}\n`;
      }

      const message =
        `🏢 Управление бизнесами:\n\n` +
        `🏪 Всего филиалов: ${myBiz.length}\n` +
        `🏭 Бизнесы:\n${lines}\n` +
        `💸 Доход: ${formatRub(totalIncome)}/час\n` +
        `💎 Всего накоплено: ${formatRub(totalAccum)}\n\n` +
        `━━━━━━━━━━━━━━━\n` +
        `📥 /снять <номер> — снять доход\n` +
        `⬆️ /повысить <номер> — прокачать\n` +
        `❌ /закрыть <номер> — закрыть бизнес\n` +
        `🛒 /бизнес купить <номер> — купить новый`;

      return context.send(message);

    } catch (error) {
      console.error('Ошибка в /бизнес:', error);
      return context.send('❌ Произошла ошибка');
    }
  },

  BUSINESSES
};