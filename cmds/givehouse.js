const fs = require('fs');
const path = require('path');
const util = require('util');
const { query } = require('../databases');
const databaseQuery = util.promisify(query);
const vk = require('../vkInstance.js');

const HOUSES_FILE = path.join(__dirname, '..', 'data', 'houses.json');
const USER_HOUSES_FILE = path.join(__dirname, '..', 'data', 'user_houses.json');

function loadJSON(file, def = {}) {
  try {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {}
  return def;
}

function saveJSON(file, data) {
  try {
    const dir = path.dirname(file);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {}
}

// Автосоздание дефолтного houses.json
if (!fs.existsSync(HOUSES_FILE)) {
  saveJSON(HOUSES_FILE, {
    "1": {
      "id": 1,
      "name": "Дом разработчика",
      "price": 5000000000,
      "attachment": "photo-241585274_457239079"
    }
  });
  console.log('🏠 Создан houses.json');
}

async function isAdmin(userId) {
  try {
    const res = await databaseQuery('SELECT access FROM sysadmins WHERE userid = ?', [userId]);
    if (res && res[0] && Number(res[0].access) >= 4) return true;
  } catch (e) {}
  return false;
}

async function resolveUser(raw) {
  let clean = String(raw)
    .replace(/^@/, '')
    .replace(/^https?:\/\/(www\.)?vk\.(com|ru)\//i, '')
    .replace(/^vk\.(com|ru)\//i, '')
    .trim();

  const m = clean.match(/^\[id(\d+)\|/);
  if (m) clean = m[1];
  else if (/^id\d+$/i.test(clean)) clean = clean.replace(/^id/i, '');

  try {
    const res = await vk.api.users.get({ user_ids: [clean] });
    if (res && res[0]) {
      return { id: res[0].id, name: `[id${res[0].id}|${res[0].first_name} ${res[0].last_name}]` };
    }
  } catch (e) {}

  if (/^\d+$/.test(clean)) return { id: Number(clean), name: `[id${clean}|Пользователь]` };
  return null;
}

module.exports = {
  command: '/givehouse',
  description: 'Выдать дом пользователю',
  aliases: ['/выдатьдом'],

  async execute(context) {
    try {
      const senderId = context.senderId;
      if (!(await isAdmin(senderId))) return context.send('❌ Недостаточно прав');

      const text = context.text || '';
      const parts = text.trim().split(/\s+/).slice(1);

      const houses = loadJSON(HOUSES_FILE);

      // Без аргументов — показать список домов
      if (parts.length < 2) {
        let list = `🏠 Доступные дома:\n\n`;
        for (const [id, house] of Object.entries(houses)) {
          list += `${id}. ${house.name}\n`;
        }
        list += `\nИспользование: /givehouse @юзер <номер>`;
        return context.send(list);
      }

      const target = await resolveUser(parts[0]);
      if (!target) return context.send(`❌ Не удалось найти «${parts[0]}»`);

      const houseId = String(parts[1]);
      const house = houses[houseId];
      if (!house) return context.send(`❌ Дом с номером ${houseId} не найден.`);

      // Загружаем/создаём user_houses.json
      const userHouses = loadJSON(USER_HOUSES_FILE, {});
      if (!userHouses[target.id]) userHouses[target.id] = [];

      userHouses[target.id].push({
        houseId: house.id,
        name: house.name,
        attachment: house.attachment,
        givenAt: Date.now()
      });

      saveJSON(USER_HOUSES_FILE, userHouses);

      return context.send(
        `✅ Дом выдан!\n\n` +
        `👤 Получатель: ${target.name}\n` +
        `🏠 Дом: ${house.name}\n` +
        `🆔 ID: ${house.id}\n` +
        `📎 Фото: ${house.attachment}`
      );

    } catch (e) {
      console.error('Ошибка /givehouse:', e);
      return context.send(`❌ Ошибка: ${e.message}`);
    }
  }
};