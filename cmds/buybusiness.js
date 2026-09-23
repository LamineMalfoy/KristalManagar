const util = require('util');
const { query } = require('../databases');
const databaseQuery = util.promisify(query);

const { getUserBalance, updateUserBalance } = require('../filedb.js');
const { BUSINESSES } = require('./business.js');

module.exports = {
  command: '/buybusiness',
  description: 'Купить бизнес',
  aliases: ['/купитьбизнес'],

  async execute(context) {
    try {
      const userId = context.senderId;
      const args = context.text ? context.text.split(' ').slice(1) : [];
      const bizId = parseInt(args[0]);

      if (!bizId || bizId < 1 || bizId > 10) {
        return context.send('❌ Укажите номер бизнеса (1–10). Пример: /buybusiness 1');
      }

      const business = BUSINESSES.find(b => b.id === bizId);
      if (!business) return context.send('❌ Бизнес не найден');

      // Проверяем, нет ли уже бизнеса
      const existing = await databaseQuery('SELECT * FROM user_businesses WHERE user_id = ?', [userId]);
      if (existing && existing[0]) {
        return context.send('🏢 У вас уже есть бизнес. Сначала закройте его через /mybusiness');
      }

      const balance = await getUserBalance(userId);
      if (balance < business.price) {
        return context.send(`❌ Недостаточно средств.\nНужно: ${business.price.toLocaleString('ru-RU')}₽\nУ вас: ${balance.toLocaleString('ru-RU')}₽`);
      }

      await updateUserBalance(userId, balance - business.price);
      await databaseQuery(
        'INSERT INTO user_businesses (user_id, business_id, level, last_collect) VALUES (?, ?, 1, ?)',
        [userId, business.id, Math.floor(Date.now() / 1000)]
      );

      return context.send(`✅ Вы купили бизнес «${business.name}» за ${business.price.toLocaleString('ru-RU')}₽!\n\nТеперь напишите /mybusiness, чтобы управлять им.`);

    } catch (error) {
      console.error('Ошибка в /buybusiness:', error);
      return context.send('❌ Произошла ошибка при покупке бизнеса');
    }
  }
};