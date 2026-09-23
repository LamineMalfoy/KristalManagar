const fs = require('fs');
const path = require('path');
const { checkSysAccess } = require('./sysadmin.js');

module.exports = {
  command: '/setreportchat',
  description: 'Установка чата для получения репортов',
  async execute(context) {
    try {
      // Проверяем права (только разработчики и основатели)
      const senderAccess = await checkSysAccess(context.senderId);
      if (senderAccess < 4) {
        return context.reply('⛔ Доступ запрещен | У вас недостаточно прав для изменения чата репортов\n👑 Требуемый уровень: Основатель');
      }

      const args = context.text.split(' ');
      if (args.length < 2) {
        return context.reply('❌ Ошибка синтаксиса | Используйте: /setreportchat [peer_id]');
      }

      let peerId = args[1].replace(/[^0-9-]/g, '');
      if (!peerId) {
        return context.reply('❌ Ошибка | Некорректный peer_id');
      }
      peerId = parseInt(peerId);

      // Загружаем текущий конфиг
      const configPath = path.join(__dirname, '../jsons/report_config.json');
      let config;
      try {
        config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      } catch (error) {
        config = { report_peer_id: null };
      }

      // Обновляем peer_id
      config.report_peer_id = peerId;

      // Сохраняем конфиг
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

      context.reply(`✅ Чат для репортов успешно изменен\n📝 Новый peer_id: ${peerId}\n\nТеперь все репорты будут приходить в эту беседу.`);

    } catch (error) {
      console.error('Ошибка при выполнении команды setreportchat:', error);
      context.reply('❌ Произошла ошибка при выполнении команды');
    }
  }
}; 