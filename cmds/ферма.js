const fs = require('fs');
const path = require('path');
const util = require('util');
const { query } = require('../databases');
const databaseQuery = util.promisify(query);
const { getUserBalance, updateUserBalance, getUserBTC, updateUserBTC } = require('../filedb.js');

const DATA_FILE = path.join(__dirname, '..', 'data', 'farms.json');

function load() {
  try {
    if (fs.existsSync(DATA_FILE)) return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (e) {}
  return {};
}
function save(data) {
  try {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {}
}

function formatRub(amount) {
  return Number(amount || 0).toLocaleString('de-DE') + '₽';
}
function formatBTC(amount) {
  return Number(amount || 0).toFixed(8);
}
// Короткий формат для label (не более 40 символов)
function shortRub(amount) {
  const n = Number(amount || 0);
  if (n >= 1e15) return `${(n / 1e15).toFixed(1)}квдрлн`;
  if (n >= 1e12) return `${(n / 1e12).toFixed(1)}трлн`;
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}млрд`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}кк`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}к`;
  return `${n}₽`;
}

function btcPerHour(level) {
  return 0.0001 + (Number(level) - 1) * 0.00005;
}

function upgradeCost(level) {
  return Math.floor(1000000 * Math.pow(1.05, level - 1));
}

function repairCost(level) {
  return Math.floor(upgradeCost(level) * 0.15);
}

async function isDev(userId) {
  try {
    const res = await databaseQuery('SELECT access FROM sysadmins WHERE userid = ?', [userId]);
    return res && res[0] && Number(res[0].access) === 5;
  } catch (e) {
    return false;
  }
}

module.exports = {
  command: '/ферма',
  description: 'Майнинг-ферма',
  aliases: ['/farm'],

  async execute(context) {
    try {
      const userId = context.senderId;
      const text = context.text || '';
      const parts = text.trim().split(/\s+/).slice(1);

      const farms = load();
      if (!farms[userId]) {
        farms[userId] = { level: 1, last_tick: Date.now(), broken: false, total_btc: 0 };
        save(farms);
      }
      const farm = farms[userId];

      if (parts[0] === 'починить' || parts[0] === 'ремонт') {
        if (!farm.broken) return context.send('✅ Ферма не сломана.');
        const price = repairCost(farm.level);
        const balance = await getUserBalance(userId);
        if (balance < price) return context.send(`❌ Недостаточно средств.\n💰 Нужно: ${formatRub(price)}\n💵 У вас: ${formatRub(balance)}`);
        await updateUserBalance(userId, balance - price);
        farm.broken = false;
        farm.last_tick = Date.now();
        save(farms);
        return context.send(`🔧 Ферма починена!\n💸 Списано: ${formatRub(price)}`);
      }

      if (parts[0] === 'улучшить' || parts[0] === 'апгрейд') {
        if (farm.broken) return context.send('❌ Сначала почините: /ферма починить');
        if (farm.level >= 1000) return context.send('📈 Максимум — 1000.');

        const onAll = parts[1] === 'вб' || parts[1] === 'все' || parts[1] === 'all';
        let upgraded = 0, spent = 0;

        while (farm.level < 1000) {
          const price = upgradeCost(farm.level);
          const balance = await getUserBalance(userId);
          if (balance < price) break;
          await updateUserBalance(userId, balance - price);
          farm.level++;
          upgraded++;
          spent += price;
          if (!onAll) break;
        }

        if (upgraded === 0) {
          const nextCost = upgradeCost(farm.level);
          return context.send(`❌ Недостаточно средств.\n💰 Следующий уровень: ${formatRub(nextCost)}`);
        }

        save(farms);
        return context.send(`✅ Ферма улучшена!\n📈 Уровень: ${farm.level}/1000\n🎯 Улучшено: ${upgraded}\n💸 Потрачено: ${formatRub(spent)}\n₿ Доход: ${formatBTC(btcPerHour(farm.level))} BTC/час`);
      }

      const dev = await isDev(userId);
      const income = btcPerHour(farm.level);
      const incomeDev = income * 1000;
      const nextCost = farm.level < 1000 ? upgradeCost(farm.level) : null;

      let msg = `🏭 Майнинг ферма\n`;
      if (farm.broken) msg += `🚨 СЛОМАНО\n`;
      msg += `📊 Уровень: ${farm.level}/1000\n`;
      msg += `₿ Биткоинов в час: ${farm.broken ? '0' : formatBTC(dev ? incomeDev : income)}\n`;
      if (dev && !farm.broken) msg += `👑 Множитель: x1000 (разработчик)\n`;
      if (nextCost) msg += `\n💰 Стоимость улучшения: ${formatRub(nextCost)}`;
      else msg += `\n📈 Максимальный уровень достигнут`;

      const { Keyboard } = require('vk-io');
      const kb = Keyboard.builder();

      if (!farm.broken && farm.level < 1000) {
        kb.callbackButton({ label: '📈 Улучшить', payload: JSON.stringify({ cmd: 'farm_upgrade' }), color: Keyboard.PRIMARY_COLOR }).row();
        kb.callbackButton({ label: '💎 Улучшить на весь баланс', payload: JSON.stringify({ cmd: 'farm_upgrade_all' }), color: Keyboard.POSITIVE_COLOR }).row();
      }
      if (farm.broken) {
        // Обрезаем label до 40 символов
        const repairLabel = `🔧 Починить (${shortRub(repairCost(farm.level))})`.substring(0, 40);
        kb.callbackButton({ label: repairLabel, payload: JSON.stringify({ cmd: 'farm_repair' }), color: Keyboard.NEGATIVE_COLOR }).row();
      }
      kb.inline();

      return context.send(msg, { keyboard: kb });

    } catch (e) {
      console.error('Ошибка в /ферма:', e);
      return context.send(`❌ Ошибка: ${e.message}`);
    }
  },

  async onPayload(context, payload) {
    try {
      const userId = context.senderId;
      const farms = load();
      const farm = farms[userId];
      if (!farm) return context.send('❌ У вас нет фермы.');

      if (payload.cmd === 'farm_upgrade') {
        if (farm.broken) return context.send('❌ Сначала почините.');
        if (farm.level >= 1000) return context.send('📈 Максимум 1000.');
        const price = upgradeCost(farm.level);
        const balance = await getUserBalance(userId);
        if (balance < price) return context.send(`❌ Недостаточно средств.\n💰 Нужно: ${formatRub(price)}`);
        await updateUserBalance(userId, balance - price);
        farm.level++;
        save(farms);
        return context.send(`✅ Уровень повышен до ${farm.level}/1000`);
      }

      if (payload.cmd === 'farm_upgrade_all') {
        if (farm.broken) return context.send('❌ Сначала почините.');
        let upgraded = 0, spent = 0;
        while (farm.level < 1000) {
          const price = upgradeCost(farm.level);
          const balance = await getUserBalance(userId);
          if (balance < price) break;
          await updateUserBalance(userId, balance - price);
          farm.level++;
          upgraded++;
          spent += price;
        }
        if (upgraded === 0) return context.send('❌ Не хватает денег ни на 1 уровень.');
        save(farms);
        return context.send(`✅ Улучшено: ${upgraded} уровней\n📈 Уровень: ${farm.level}/1000\n💸 Потрачено: ${formatRub(spent)}`);
      }

      if (payload.cmd === 'farm_repair') {
        if (!farm.broken) return context.send('✅ Ферма не сломана.');
        const price = repairCost(farm.level);
        const balance = await getUserBalance(userId);
        if (balance < price) return context.send(`❌ Недостаточно средств.\n💰 Нужно: ${formatRub(price)}`);
        await updateUserBalance(userId, balance - price);
        farm.broken = false;
        farm.last_tick = Date.now();
        save(farms);
        return context.send(`🔧 Ферма починена!`);
      }
    } catch (e) {
      console.error('farm onPayload:', e);
      return context.send(`❌ Ошибка: ${e.message}`);
    }
  },

  btcPerHour
};