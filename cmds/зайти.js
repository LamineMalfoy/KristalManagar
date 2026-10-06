const fs = require('fs');
const path = require('path');

const USER_HOUSES_FILE = path.join(__dirname, '..', 'data', 'user_houses.json');

function loadJSON(file, def = {}) {
  try { if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) {}
  return def;
}
function saveJSON(file, data) {
  try { fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8'); } catch (e) {}
}

module.exports = {
  command: '/зайти',
  description: 'Зайти в дом по ID',
  aliases: ['/зайтивдом'],

  async execute(context) {
    try {
      const userId = context.senderId;
      const text = context.text || '';
      const parts = text.trim().split(/\s+/).slice(1);

      if (parts.length < 1) {
        return context.send('❌ Использование: /зайти <ID дома>\n\nПример: /зайти 1');
      }

      const houseId = parseInt(parts[0]);
      const userHouses = loadJSON(USER_HOUSES_FILE, {});
      const myHouses = userHouses[userId] || [];

      const house = myHouses.find(h => h.houseId === houseId);
      if (!house) return context.send(`❌ У вас нет дома с ID ${houseId}.`);

      // Делаем этот дом активным
      userHouses[userId] = myHouses.map(h => ({ ...h, active: h.houseId === houseId }));
      saveJSON(USER_HOUSES_FILE, userHouses);

      return context.send(`🏠 Вы вошли в дом «${house.name}».`);

    } catch (e) {
      console.error('/зайти:', e);
      return context.send(`❌ Ошибка: ${e.message}`);
    }
  }
};