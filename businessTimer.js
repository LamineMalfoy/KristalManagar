const util = require('util');
const { query } = require('./databases');
const databaseQuery = util.promisify(query);
const fs = require('fs');
const path = require('path');

const BUSINESSES = [
  { id: 1, income: [2500, 3750, 5000, 6250, 8750, 11250, 13750, 17500, 22500, 30000] },
  { id: 2, income: [10000, 15000, 20000, 25000, 35000, 45000, 55000, 70000, 90000, 120000] },
  { id: 3, income: [25000, 37500, 50000, 62500, 87500, 112500, 137500, 175000, 225000, 300000] },
  { id: 4, income: [50000, 75000, 100000, 125000, 175000, 225000, 275000, 350000, 450000, 600000] },
  { id: 5, income: [250000, 375000, 500000, 625000, 875000, 1125000, 1375000, 1750000, 2250000, 3000000] },
  { id: 6, income: [2500000, 3750000, 5000000, 6250000, 8750000, 11250000, 13750000, 17500000, 22500000, 30000000] },
  { id: 7, income: [15000000, 22500000, 30000000, 37500000, 52500000, 67500000, 82500000, 105000000, 135000000, 180000000] },
  { id: 8, income: [35000000, 52500000, 70000000, 87500000, 122500000, 157500000, 192500000, 245000000, 315000000, 420000000] },
  { id: 9, income: [50000000, 75000000, 100000000, 125000000, 175000000, 225000000, 275000000, 350000000, 450000000, 600000000] },
  { id: 10, income: [250000000, 375000000, 500000000, 625000000, 875000000, 1125000000, 1375000000, 1750000000, 2250000000, 3000000000] }
];

const DEVELOPERS = new Set();

async function loadDevelopers() {
  try {
    const res = await databaseQuery('SELECT userid FROM sysadmins WHERE access = 5');
    DEVELOPERS.clear();
    if (res && res.length) for (const row of res) DEVELOPERS.add(Number(row.userid));
    console.log('💎 Разработчики:', [...DEVELOPERS]);
  } catch (e) {}
}

// ─── Бизнесы ───
async function tickBusinesses() {
  try {
    const allBiz = await databaseQuery('SELECT * FROM user_businesses');
    if (!allBiz || !allBiz.length) return;

    const now = Date.now();

    for (const b of allBiz) {
      const userId = Number(b.user_id);
      const info = BUSINESSES.find(x => x.id === Number(b.business_id));
      if (!info) continue;

      const level = Math.min(Math.max(Number(b.level) || 1, 1), 10);
      const income = info.income[level - 1];

      const isDev = DEVELOPERS.has(userId);
      const cooldown = isDev ? 1000 : 3600000;

      const last = Number(b.last_collect) || 0;
      if (now - last < cooldown) continue;

      const newAccum = (Number(b.accum) || 0) + income;

      await databaseQuery(
        'UPDATE user_businesses SET accum = ?, last_collect = ? WHERE user_id = ? AND business_id = ? AND uid = ?',
        [newAccum, now, userId, b.business_id, b.uid]
      );
    }
  } catch (e) {}
}

// ─── Ферма ───
async function tickFarms() {
  try {
    const farmsFile = path.join(__dirname, 'data', 'farms.json');
    if (!fs.existsSync(farmsFile)) return;

    const farms = JSON.parse(fs.readFileSync(farmsFile, 'utf8'));
    const now = Date.now();
    let changed = false;

    const { getUserBTC, updateUserBTC } = require('./filedb.js');

    for (const uid of Object.keys(farms)) {
      const farm = farms[uid];
      if (!farm) continue;

      if (farm.broken) {
        farm.last_tick = now;
        changed = true;
        continue;
      }

      const isDev = DEVELOPERS.has(Number(uid));

      // Сколько реально прошло секунд
      const secondsPassed = (now - (farm.last_tick || now)) / 1000;
      if (secondsPassed < 1) continue; // реже, чем раз в секунду — пропускаем

      const btcPerHour = 0.0001 + (Number(farm.level) - 1) * 0.00005;

      let earned;
      if (isDev) {
        // Разрабу — как будто прошёл час за каждую секунду × x1000 множитель
        earned = btcPerHour * secondsPassed * 1000;
      } else {
        // Обычному — за реальное время
        earned = btcPerHour * (secondsPassed / 3600);
      }

      if (earned > 0) {
        const currentBTC = await getUserBTC(Number(uid));
        await updateUserBTC(Number(uid), currentBTC + earned);
        farm.total_btc = (Number(farm.total_btc) || 0) + earned;
      }

      farm.last_tick = now;
      changed = true;

      // Поломка — 1% в час (для разраба — раз в секунду проверяем, но шанс мал)
      const breakChance = isDev ? 0.0001 : 0.01 * (secondsPassed / 3600);
      if (Math.random() < breakChance && !farm.broken) {
        farm.broken = true;
        try {
          const vk = require('./vkInstance.js');
          await vk.api.messages.send({
            peer_id: Number(uid),
            message: `🚨 Ваша майнинг-ферма сломалась! Починить: /ферма починить`,
            random_id: Math.floor(Math.random() * 1e9)
          });
        } catch (e) {}
      }
    }

    if (changed) fs.writeFileSync(farmsFile, JSON.stringify(farms, null, 2), 'utf8');
  } catch (e) {
    console.error('tickFarms:', e.message);
  }
}

function startBusinessTimer() {
  loadDevelopers();
  setInterval(loadDevelopers, 5 * 60 * 1000);
  setInterval(tickBusinesses, 1000);
  setInterval(tickFarms, 1000); // раз в секунду
  console.log('💼 businessTimer запущен');
}

module.exports = { startBusinessTimer };