const fs = require('fs');
const path = require('path');

const USER_HOUSES_FILE = path.join(__dirname, '..', 'data', 'user_houses.json');

function load(file, def = {}) {
  try { if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) {}
  return def;
}

module.exports = {
  command: '/дома',
  description: 'Все дома игрока',
  aliases: ['/myhouses', '/моидома'],

  async execute(context) {
    try {
      const userId = context.senderId;
      const userHouses = load(USER_HOUSES_FILE, {});
      const myHouses = userHouses[userId] || [];

      if (myHouses.length === 0) {
        return context.send('🏠 У вас нет домов. Купить можно в /магаз домов');
      }

      let msg = `🏠 Ваши дома (${myHouses.length}):\n\n`;
      for (let i = 0; i < myHouses.length; i++) {
        const h = myHouses[i];
        const active = h.active === true ? '✅ активен' : '⬜ не активен';
        msg += `${i + 1}. ${h.name} — ${active}\n`;
      }
      msg += `\n🚪 /зайти <номер> — зайти в дом\n`;
      msg += `🚪 /выйти — выйти из дома\n`;

      return context.send(msg);

    } catch (e) {
      console.error('/дома:', e);
      return context.send(`❌ Ошибка: ${e.message}`);
    }
  }
};