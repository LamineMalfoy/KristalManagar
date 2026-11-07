const util = require('util');
const { query } = require('../databases');
const databaseQuery = util.promisify(query);
const { getUserBalance, updateUserBalance } = require('../filedb.js');
const { BUSINESSES } = require('./business.js');

function formatRub(amount) {
  return Number(amount || 0).toLocaleString('de-DE') + '₽';
}

module.exports = {
  command: '/повысить',
  description: 'Прокачать бизнес',
  aliases: ['/upgrade', '/апгрейд'],

  async execute(context) {
    try {
      const userId = context.senderId;

      const list = await databaseQuery('SELECT * FROM user_businesses WHERE user_id = ?', [userId]);
      if (!list || !list.length) return context.send('🏢 У вас нет бизнеса. Купите через /бизнес');

      const biz = list[0]; // у игрока только 1 бизнес
      const info = BUSINESSES.find(x => x.id === Number(biz.business_id));
      if (!info) return context.send('❌ Бизнес не найден в базе');

      const level = Math.min(Math.max(Number(biz.level) || 1, 1), 10);

      // ── Показать текущий уровень и цену апгрейда ──
      if (level >= 10) {
        return context.send('📈 «' + info.name + '» уже максимального уровня (10/10)\n💸 Доход/час: ' + formatRub(info.income[9]));
      }

      const price = info.income[level]; // цена апгрейда = доход текущего уровня
      const balance = Number(await getUserBalance(userId)) || 0;

      if (balance < price) {
        return context.send(
          '❌ Недостаточно средств для прокачки\n\n' +
          '🏢 «' + info.name + '» — ' + level + '/10 ур.\n' +
          '⬆️ Апгрейд до ' + (level + 1) + ' ур.: ' + formatRub(price) + '\n' +
          '💵 У вас: ' + formatRub(balance) + '\n' +
          '📊 Не хватает: ' + formatRub(price - balance)
        );
      }

      // 1. Списываем деньги
      await updateUserBalance(userId, balance - price);

      // 2. Повышаем уровень (обновляем по user_id, так как бизнес один)
      await databaseQuery(
        'UPDATE user_businesses SET level = ? WHERE user_id = ?',
        [level + 1, userId]
      );

      return context.send(
        '📈 «' + info.name + '» прокачан до ' + (level + 1) + ' уровня!\n' +
        '💸 Списано: ' + formatRub(price) + '\n' +
        '💸 Новый доход/час: ' + formatRub(info.income[level])
      );

    } catch (e) {
      console.error('Ошибка в /повысить:', e);
      return context.send('❌ Ошибка при прокачке');
    }
  }
};