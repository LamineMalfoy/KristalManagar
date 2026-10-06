const fs = require('fs');
const path = require('path');
const util = require('util');
const { query } = require('../databases');
const databaseQuery = util.promisify(query);

const HOUSES_FILE = path.join(__dirname, '..', 'data', 'houses.json');
const USER_HOUSES_FILE = path.join(__dirname, '..', 'data', 'user_houses.json');

function load(file) {
  try { if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) {}
  return {};
}
function save(file, data) {
  try {
    const dir = path.dirname(file);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {}
}

async function isAdmin(userId) {
  try {
    const res = await databaseQuery('SELECT access FROM sysadmins WHERE userid = ?', [userId]);
    return res && res[0] && Number(res[0].access) >= 5;
  } catch (e) { return false; }
}

module.exports = {
  command: '/delhouse',
  description: 'Удалить дом по ID',
  aliases: ['/удалитьдом'],

  async execute(context) {
    try {
      const senderId = context.senderId;
      if (!(await isAdmin(senderId))) return context.send('❌ Недостаточно прав');

      const text = context.text || '';
      const parts = text.trim().split(/\s+/).slice(1);

      if (parts.length < 1) {
        return context.send(
          `🏠 Удаление дома\n\n` +
          `Использование:\n` +
          `/delhouse <ID дома>\n\n` +
          `Пример: /delhouse 2`
        );
      }

      const houseId = parseInt(parts[0]);
      if (isNaN(houseId) || houseId < 1) return context.send('❌ Неверный ID дома.');

      const houses = load(HOUSES_FILE);
      const house = houses[String(houseId)];

      if (!house) return context.send(`❌ Дом с ID ${houseId} не найден.`);

      // Удаляем дом
      delete houses[String(houseId)];
      save(HOUSES_FILE, houses);

      // Удаляем у всех игроков этот дом
      const userHouses = load(USER_HOUSES_FILE);
      let removedFrom = 0;

      for (const uid of Object.keys(userHouses)) {
        const before = userHouses[uid].length;
        userHouses[uid] = userHouses[uid].filter(h => h.houseId !== houseId);
        if (userHouses[uid].length < before) removedFrom++;
      }
      save(USER_HOUSES_FILE, userHouses);

      return context.send(
        `✅ Дом удалён!\n\n` +
        `🆔 ID: ${houseId}\n` +
        `🏠 Название: ${house.name}\n` +
        `👥 Убрано у игроков: ${removedFrom}`
      );

    } catch (e) {
      console.error('/delhouse:', e);
      return context.send(`❌ Ошибка: ${e.message}`);
    }
  }
};