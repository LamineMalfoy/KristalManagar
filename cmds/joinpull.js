const fs = require('fs');
const path = require('path');

module.exports = {
  command: '/pull',
  description: 'Присоединение к пуллу по его идентификатору',
  async execute(context) {
    const { peerId, senderId } = context;
    const { checkIfTableExists, getUserRole } = require('./roles.js');
    const poolKey = (context.text.split(' ')[1] || '').replace(/^#/, '');
    if (!poolKey) {
      return context.reply('❌ Укажите идентификатор пулла в формате: /pull [идентификатор]');
    }
    if (!await checkIfTableExists(`nicknames_${peerId}`)) {
      return context.send('Ваша беседа не зарегистрирована!');
    }
    const senderUserRole = await getUserRole(peerId, context.senderId);
    if (senderUserRole < 100) {
      return context.send('У вас нет прав на добавление беседы в пулл');
    }
    // Ищем пулл по ключу среди файлов
    const poolsDir = path.join(__dirname, '../data/pools');
    let found = null, filePath = '';
    try {
      for (const file of fs.readdirSync(poolsDir)) {
        if (!file.endsWith('.json')) continue;
        const full = path.join(poolsDir, file);
        let data;
        try { data = JSON.parse(fs.readFileSync(full, 'utf8')); } catch { continue; }
        if (data.pool_key === poolKey) {
          found = data;
          filePath = full;
          break;
        }
      }
    } catch (e) {
      return context.reply('❌ Ошибка чтения файлов пуллов.');
    }
    if (!found) {
      return context.reply('❌ Пулл с таким ключом не найден.');
    }
    if (found.creator_id !== senderId) {
      return context.reply(`❌ Пулл найден, но вы не являетесь его создателем.\nВаш user_id: ${senderId}\ncreator_id пулла: ${found.creator_id}`);
    }
    if (!Array.isArray(found.pool_peerids)) found.pool_peerids = [];
    if (found.pool_peerids.includes(String(peerId))) {
      return context.reply('❌ Вы уже подключены к этому пуллу.');
    }
    found.pool_peerids.push(String(peerId));
    try {
      fs.writeFileSync(filePath, JSON.stringify(found, null, 2), 'utf8');
    } catch {
      return context.reply('❌ Не удалось обновить файл пулла.');
    }
    context.reply(`✅ Вы успешно подключили беседу к пуллу «${found.pool_name}».`);
  },
};
