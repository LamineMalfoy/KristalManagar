const fs = require('fs');
const path = require('path');
const util = require('util');
const { query } = require('../databases');
const databaseQuery = util.promisify(query);
const vk = require('../vkInstance.js');

async function isDev(userId) {
  try {
    const res = await databaseQuery('SELECT access FROM sysadmins WHERE userid = ?', [userId]);
    return res && res[0] && Number(res[0].access) >= 5;
  } catch (e) { return false; }
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
  command: '/обнул',
  description: 'Обнулить весь прогресс игрока',
  aliases: ['/resetuser', '/обнулить'],

  async execute(context) {
    try {
      const senderId = context.senderId;
      if (!(await isDev(senderId))) return context.send('❌ Недостаточно прав (нужен access 5)');

      const parts = (context.text || '').trim().split(/\s+/).slice(1);
      if (parts.length < 2) {
        return context.send(`🧹 Использование:\n/обнул @юзер <причина>\n\nПример: /обнул @camelmef читанул`);
      }

      const target = await resolveUser(parts[0]);
      if (!target) return context.send(`❌ Не нашли «${parts[0]}»`);

      const reason = parts.slice(1).join(' ');
      const uid = target.id;

      // ─── 1. Баланс и BTC ───
      const balanceFile = path.join(__dirname, '..', 'data', 'user_balances', `${uid}.json`);
      if (fs.existsSync(balanceFile)) fs.unlinkSync(balanceFile);

      // ─── 2. Ресурсы ───
      const resourcesFile = path.join(__dirname, '..', 'data', 'user_resources', `${uid}.json`);
      if (fs.existsSync(resourcesFile)) fs.unlinkSync(resourcesFile);

      // ─── 3. Ежедневки ───
      const dailyFile = path.join(__dirname, '..', 'data', 'user_dailies', `${uid}.json`);
      if (fs.existsSync(dailyFile)) fs.unlinkSync(dailyFile);

      // ─── 4. Репутация ───
      const repFile = path.join(__dirname, '..', 'data', 'user_reputation', `${uid}.json`);
      if (fs.existsSync(repFile)) fs.unlinkSync(repFile);

      // ─── 5. Бизнесы ───
      try {
        const allBiz = await databaseQuery('SELECT * FROM user_businesses WHERE user_id = ?', [uid]);
        for (const b of allBiz) {
          await databaseQuery(
            'DELETE FROM user_businesses WHERE user_id = ? AND business_id = ? AND uid = ?',
            [uid, b.business_id, b.uid]
          );
        }
      } catch (e) {}

      // ─── 6. Слоты ───
      try {
        await databaseQuery('DELETE FROM user_slots WHERE user_id = ?', [uid]);
      } catch (e) {}

      // ─── 7. Ферма ───
      try {
        const farmsFile = path.join(__dirname, '..', 'data', 'farms.json');
        if (fs.existsSync(farmsFile)) {
          const farms = JSON.parse(fs.readFileSync(farmsFile, 'utf8'));
          if (farms[uid]) {
            delete farms[uid];
            fs.writeFileSync(farmsFile, JSON.stringify(farms, null, 2), 'utf8');
          }
        }
      } catch (e) {}

      // ─── 8. Депозиты ───
      try {
        const depFile = path.join(__dirname, '..', 'data', 'deposits.json');
        if (fs.existsSync(depFile)) {
          const deps = JSON.parse(fs.readFileSync(depFile, 'utf8'));
          if (deps[uid]) {
            delete deps[uid];
            fs.writeFileSync(depFile, JSON.stringify(deps, null, 2), 'utf8');
          }
        }
      } catch (e) {}

      // ─── 9. VIP ───
      const vipFile = path.join(__dirname, '..', 'data', 'vip_users', `${uid}.json`);
      if (fs.existsSync(vipFile)) fs.unlinkSync(vipFile);

      // ─── 10. Дома игрока ───
      try {
        const housesFile = path.join(__dirname, '..', 'data', 'user_houses.json');
        if (fs.existsSync(housesFile)) {
          const houses = JSON.parse(fs.readFileSync(housesFile, 'utf8'));
          if (houses[uid]) {
            delete houses[uid];
            fs.writeFileSync(housesFile, JSON.stringify(houses, null, 2), 'utf8');
          }
        }
      } catch (e) {}

      // ─── 11. Сообщения во всех беседах ───
      try {
        const confs = await databaseQuery('SELECT conference_id FROM conference');
        for (const { conference_id } of confs) {
          try {
            await databaseQuery(`DELETE FROM conference_${conference_id} WHERE user_id = ?`, [uid]);
          } catch (e) {}
        }
      } catch (e) {}

      return context.send(
        `✅ Прогресс игрока обнулён!\n\n` +
        `👤 ${target.name}\n` +
        `📄 Причина: ${reason}\n\n` +
        `🧹 Удалено: баланс, BTC, ресурсы, бизнесы, ферма, депозит, VIP, дома, статистика сообщений.`
      );

    } catch (e) {
      console.error('/обнул:', e);
      return context.send(`❌ Ошибка: ${e.message}`);
    }
  }
};