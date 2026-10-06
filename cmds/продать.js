const fs = require('fs');
const path = require('path');
const vk = require('../vkInstance.js');
const { getUserBalance, updateUserBalance } = require('../filedb.js');

const USER_HOUSES_FILE = path.join(__dirname, '..', 'data', 'user_houses.json');

function loadJSON(file, def = {}) {
  try { if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) {}
  return def;
}
function saveJSON(file, data) {
  try { fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8'); } catch (e) {}
}
function formatRub(amount) {
  return Number(amount || 0).toLocaleString('de-DE') + '₽';
}

async function resolveUser(raw) {
  let clean = String(raw).replace(/^@/, '').replace(/^https?:\/\/(www\.)?vk\.(com|ru)\//i, '').replace(/^vk\.(com|ru)\//i, '').trim();
  const m = clean.match(/^\[id(\d+)\|/);
  if (m) clean = m[1];
  else if (/^id\d+$/i.test(clean)) clean = clean.replace(/^id/i, '');
  try {
    const res = await vk.api.users.get({ user_ids: [clean] });
    if (res && res[0]) return { id: res[0].id, name: `[id${res[0].id}|${res[0].first_name} ${res[0].last_name}]` };
  } catch (e) {}
  if (/^\d+$/.test(clean)) return { id: Number(clean), name: `[id${clean}|Пользователь]` };
  return null;
}

module.exports = {
  command: '/продать',
  description: 'Продать дом другому игроку',
  aliases: ['/продатьдом'],

  async execute(context) {
    try {
      const userId = context.senderId;
      const text = context.text || '';
      const parts = text.trim().split(/\s+/).slice(1);

      if (parts.length < 3) {
        return context.send(`❌ Использование: /продать @юзер <ID дома> <цена>\n\nПример: /продать @camelmef 1 5кк`);
      }

      const target = await resolveUser(parts[0]);
      if (!target) return context.send(`❌ Не удалось найти «${parts[0]}»`);

      const houseId = parseInt(parts[1]);
      let priceStr = parts[2].toLowerCase();
      let price = 0;
      if (priceStr.includes('ккк')) price = parseFloat(priceStr.replace('ккк', '')) * 1e12;
      else if (priceStr.includes('млрд')) price = parseFloat(priceStr.replace('млрд', '')) * 1e9;
      else if (priceStr.includes('кк')) price = parseFloat(priceStr.replace('кк', '')) * 1e6;
      else if (priceStr.includes('к')) price = parseFloat(priceStr.replace('к', '')) * 1e3;
      else price = parseFloat(priceStr) || 0;

      if (!price || price <= 0) return context.send('❌ Неверная цена.');

      const userHouses = loadJSON(USER_HOUSES_FILE, {});
      const myHouses = userHouses[userId] || [];
      const idx = myHouses.findIndex(h => h.houseId === houseId);
      if (idx === -1) return context.send(`❌ У вас нет дома с ID ${houseId}.`);

      const buyerBalance = await getUserBalance(target.id);
      if (buyerBalance < price) return context.send(`❌ У ${target.name} недостаточно средств (${formatRub(buyerBalance)}).`);

      await updateUserBalance(target.id, buyerBalance - price);
      const sellerBalance = await getUserBalance(userId);
      await updateUserBalance(userId, sellerBalance + price);

      const house = myHouses.splice(idx, 1)[0];
      userHouses[userId] = myHouses;
      if (!userHouses[target.id]) userHouses[target.id] = [];
      userHouses[target.id].push({ ...house, givenAt: Date.now(), active: false });
      saveJSON(USER_HOUSES_FILE, userHouses);

      return context.send(`✅ Дом «${house.name}» продан ${target.name} за ${formatRub(price)}!`);

    } catch (e) {
      console.error('/продать:', e);
      return context.send(`❌ Ошибка: ${e.message}`);
    }
  }
};