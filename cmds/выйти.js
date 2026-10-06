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
  command: '/выйти',
  description: 'Выйти из дома',
  aliases: ['/выйтииздома'],

  async execute(context) {
    try {
      const userId = context.senderId;
      const userHouses = loadJSON(USER_HOUSES_FILE, {});

      if (!userHouses[userId] || userHouses[userId].length === 0) {
        return context.send('❌ У вас нет домов.');
      }

      // Ищем активный дом
      const activeHouse = userHouses[userId].find(h => h.active === true);

      // Если нет дома с active: true — значит игрок уже не в доме
      if (!activeHouse) {
        return context.send('❌ Вы не находитесь в доме. Зайдите сначала: /зайти <ID>');
      }

      // Деактивируем ВСЕ дома игрока
      userHouses[userId] = userHouses[userId].map(h => ({ ...h, active: false }));
      saveJSON(USER_HOUSES_FILE, userHouses);

      return context.send(`🚪 Вы вышли из дома «${activeHouse.name}».`);

    } catch (e) {
      console.error('/выйти:', e);
      return context.send(`❌ Ошибка: ${e.message}`);
    }
  }
};