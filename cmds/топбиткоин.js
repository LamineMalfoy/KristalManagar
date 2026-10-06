const fs = require('fs');
const path = require('path');
const vk = require('../vkInstance.js');

const BALANCES_DIR = path.join(__dirname, '..', 'data', 'user_balances');

async function getUserLink(userId) {
  try {
    const res = await vk.api.users.get({ user_ids: [userId] });
    if (res && res[0]) return `[id${res[0].id}|${res[0].first_name} ${res[0].last_name}]`;
  } catch (e) {}
  return `[id${userId}|Пользователь]`;
}

module.exports = {
  command: '/топбиткоин',
  description: 'Топ по биткоинам',
  aliases: ['/топбит', '/topbtc'],

  async execute(context) {
    try {
      const text = (context.text || '').toLowerCase();
      if (!text.includes('биткоин') && !text.includes('btc')) {
        return context.send('❌ Использование: /топ биткоин');
      }

      if (!fs.existsSync(BALANCES_DIR)) return context.send('❌ Пока нет данных.');

      const files = fs.readdirSync(BALANCES_DIR).filter(f => f.endsWith('.json'));
      const users = [];

      for (const file of files) {
        const userId = parseInt(file.replace('.json', ''));
        if (isNaN(userId)) continue;
        try {
          const data = JSON.parse(fs.readFileSync(path.join(BALANCES_DIR, file), 'utf8'));
          const btc = Number(data.btc) || 0;
          if (btc > 0) users.push({ userId, btc });
        } catch (e) {}
      }

      users.sort((a, b) => b.btc - a.btc);
      const top = users.slice(0, 10);

      if (top.length === 0) return context.send('❌ Пока ни у кого нет BTC.');

      let msg = `⛏️ Топ по биткоинам\n\n`;
      for (let i = 0; i < top.length; i++) {
        const u = top[i];
        const link = await getUserLink(u.userId);
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
        msg += `${medal} ${link} – ${u.btc.toFixed(1)} BTC\n`;
      }

      return context.send(msg);

    } catch (e) {
      console.error('/топбиткоин:', e);
      return context.send(`❌ Ошибка: ${e.message}`);
    }
  }
};