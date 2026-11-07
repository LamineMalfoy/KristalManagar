const util = require('util');
const { query } = require('../databases');
const databaseQuery = util.promisify(query);
const vk = require('../vkInstance.js');
const { BUSINESSES } = require('./business.js');

async function isAdmin(userId) {
  try {
    const res = await databaseQuery('SELECT access FROM sysadmins WHERE userid = ?', [userId]);
    if (res && res[0] && Number(res[0].access) >= 4) return true;
  } catch (e) {}
  return false;
}

function safeLevel(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return 1;
  if (n > 10) return 10;
  return Math.floor(n);
}

async function resolveUser(raw) {
  let clean = String(raw).replace(/^@/, '').replace(/^https?:\/\/(www\.)?vk\.com\//i, '').replace(/^vk\.com\//i, '').trim();
  const m = clean.match(/^\[id(\d+)\|/);
  if (m) clean = m[1];
  else if (/^id\d+$/i.test(clean)) clean = clean.replace(/^id/i, '');
  try {
    const res = await vk.api.users.get({ user_ids: [clean] });
    if (res && res[0]) return { id: res[0].id, name: '[id' + res[0].id + '|' + res[0].first_name + ' ' + res[0].last_name + ']' };
  } catch (e) {}
  if (/^\d+$/.test(clean)) return { id: Number(clean), name: '[id' + clean + '|Пользователь]' };
  return null;
}

module.exports = {
  command: '/givebiz',
  description: 'Выдать бизнес пользователю',
  aliases: ['/выдатьбизнес'],

  async execute(context) {
    try {
      const senderId = context.senderId;
      if (!(await isAdmin(senderId))) return context.send('❌ У вас недостаточно прав');

      const text = context.text || '';
      const parts = text.trim().split(/\s+/).slice(1);

      if (parts.length < 3) {
        return context.send(
          '❓ Использование:\n' +
          '/givebiz @юзер <номер> <уровень>\n\n' +
          'Примеры:\n' +
          '/givebiz @durov 5 10\n' +
          '/givebiz @durov 1-10 10\n' +
          '/givebiz @durov 5,6,7 5'
        );
      }

      const target = await resolveUser(parts[0]);
      if (!target) return context.send('❌ Не удалось найти «' + parts[0] + '»');

      const level = safeLevel(parts[2]);

      // ── Проверка: у игрока уже есть бизнес ──
      const existing = await databaseQuery('SELECT * FROM user_businesses WHERE user_id = ?', [target.id]);
      if (existing && existing.length > 0) {
        const exInfo = BUSINESSES.find(x => x.id === Number(existing[0].business_id));
        return context.send(
          '❌ У игрока ' + target.name + ' уже есть бизнес «' + (exInfo ? exInfo.name : '—') + '».\n' +
          'Можно иметь только 1 бизнес.\n\n' +
          '💡 Сначала пусть закроет: /закрыть'
        );
      }

      // ── Парсинг номеров бизнесов ──
      let ids = [];
      const arg = parts[1];

      if (/^\d+-\d+$/.test(arg)) {
        const range = arg.split('-').map(Number);
        for (let i = Math.min(range[0], range[1]); i <= Math.max(range[0], range[1]); i++) ids.push(i);
      } else if (arg.includes(',')) {
        ids = arg.split(',').map(x => parseInt(x)).filter(x => !isNaN(x));
      } else {
        ids = [parseInt(arg)];
      }

      ids = ids.filter(id => id >= 1 && id <= 10);
      if (!ids.length) return context.send('❌ Укажи номер бизнеса (1–10)');

      // Берём только первый валидный бизнес (у игрока максимум 1)
      const bizId = ids[0];
      const business = BUSINESSES.find(b => b.id === bizId);
      if (!business) return context.send('❌ Бизнес с таким номером не найден');

      await databaseQuery(
        'INSERT INTO user_businesses (user_id, business_id, level, accum, last_collect) VALUES (?, ?, ?, 0, ?)',
        [target.id, bizId, level, Date.now()]
      );

      return context.send(
        '✅ Бизнес выдан!\n\n' +
        '👤 Получатель: ' + target.name + '\n' +
        '🏢 Бизнес: «' + business.name + '»\n' +
        '📊 Уровень: ' + level + '/10'
      );

    } catch (e) {
      console.error('Ошибка в /givebiz:', e);
      return context.send('❌ Ошибка при выдаче бизнеса');
    }
  }
};