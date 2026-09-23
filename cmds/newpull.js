const { getUserRole, checkIfTableExists } = require('./roles.js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

module.exports = {
  command: '/newpull',
  description: 'Создание нового пулла',
  async execute(context) {
    const { peerId, senderId } = context;
    const poolName = context.text.split(' ')[1];
    const senderRoleId = await getUserRole(context.peerId, context.senderId);

    if (!await checkIfTableExists(`nicknames_${peerId}`)) {
      console.error('Таблица никнеймов не существует');
      return context.send('Ваша беседа не зарегистрирована!');
    }

    if (senderRoleId < 100) {
      return context.reply(`❌ У вас нет прав на создание объединения`);
    }

    if (!poolName) {
      return context.reply('❌ Укажите название объединения.');
    }

    function generateUniqueKey() {
      const keyLength = 5;
      return crypto.randomBytes(keyLength).toString('hex');
    }

    const poolKey = generateUniqueKey();
    const poolsDir = path.join(__dirname, '../data/pools');
    // Удаляем все пуллы, где есть этот peerId
    let poolFiles = [];
    try {
      poolFiles = fs.readdirSync(poolsDir);
    } catch {}
    for (const file of poolFiles) {
      if (!file.endsWith('.json')) continue;
      let data;
      try {
        data = JSON.parse(fs.readFileSync(path.join(poolsDir, file), 'utf8'));
      } catch { continue; }
      const ids = Array.isArray(data.pool_peerids) ? data.pool_peerids : [];
      if (ids.includes(String(peerId))) {
        try { fs.unlinkSync(path.join(poolsDir, file)); } catch {}
      }
    }
    // Создаём новый пулл
    const poolId = Date.now().toString();
    const newPool = {
      pool_name: poolName,
      pool_key: poolKey,
      pool_peerids: [String(peerId)],
      creator_id: senderId,
      created_at: new Date().toISOString()
    };
    try {
      fs.writeFileSync(path.join(poolsDir, poolId + '.json'), JSON.stringify(newPool, null, 2), 'utf8');
    } catch (e) {
      return context.reply('❌ Не удалось создать пулл (ошибка записи файла)');
    }
    context.reply(`✅ Объединение «${poolName}» успешно создано!\nКлюч: #${poolKey}`);
  }
};
