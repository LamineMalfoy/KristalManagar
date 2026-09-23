const fs = require('fs');
const path = require('path');
const { getUserRole, getRoleName } = require('./roles.js');
const { checkCommandPriority } = require('./editcmd.js');

module.exports = {
  command: '/filter',
  aliases: ['/фильтр'],
  description: 'Управление фильтром запрещенных слов',
  async execute(context) {
    const { peerId, senderId, text } = context;
    const args = text.split(' ').slice(1);
    const subCommand = args[0] ? args[0].toLowerCase() : 'help';
    
    // Проверка прав доступа (современная система приоритетов)
    const hasPermission = await checkCommandPriority(peerId, senderId, '/filter');
    if (!hasPermission) {
      const { getCommandPriorities } = require('./editcmd.js');
      const priorities = await getCommandPriorities(peerId);
      const requiredRole = priorities['/filter'] || 20;
      const senderRole = await getUserRole(peerId, context.senderId);
      const senderRoleName = await getRoleName(peerId, senderRole);
      return context.send(`⛔ Доступ запрещён | Для использования команды /filter требуется приоритет ${requiredRole} или выше\n👤 Ваша роль: ${senderRoleName} (приоритет ${senderRole})`);
    }
    
    // Путь к файлу с фильтрами для конкретной беседы
    const filterDir = path.join(__dirname, '..', 'data', 'filters');
    const filterFile = path.join(filterDir, `${peerId}.json`);
    
    // Создаем директорию если не существует
    if (!fs.existsSync(filterDir)) {
      fs.mkdirSync(filterDir, { recursive: true });
    }
    
    // Загружаем существующие фильтры
    let filters = [];
    if (fs.existsSync(filterFile)) {
      try {
        const data = fs.readFileSync(filterFile, 'utf8');
        filters = JSON.parse(data);
      } catch (error) {
        console.error('Ошибка при чтении файла фильтров:', error);
        filters = [];
      }
    }
    
    switch (subCommand) {
      case 'add':
      case 'добавить':
        if (args.length < 2) {
          return context.send('❌ Использование: /filter add <слово>');
        }
        const wordToAdd = args.slice(1).join(' ').toLowerCase().trim();
        if (filters.includes(wordToAdd)) {
          return context.send(`⚠️ Слово "${wordToAdd}" уже есть в фильтре`);
        }
        filters.push(wordToAdd);
        try {
          fs.writeFileSync(filterFile, JSON.stringify(filters, null, 2));
          return context.send(`✅ Слово "${wordToAdd}" добавлено в фильтр.`);
        } catch (error) {
          console.error('Ошибка при сохранении фильтров:', error);
          return context.send('❌ Произошла ошибка при сохранении фильтра');
        }
        
      case 'all':
      case 'все':
      case 'list':
      case 'список':
        if (filters.length === 0) {
          return context.send('📋 Фильтр пуст. Нет запрещенных слов.');
        }
        let message = `📋 Список слов в фильтре:\n`;
        filters.forEach((word, index) => {
          message += `${index + 1}. ID: ${index + 1} | Слово: ${word} | Тип: delete\n`;
        });
        return context.send(message);
        
      case 'del':
      case 'delete':
      case 'удалить':
        if (args.length < 2) {
          return context.send('❌ Использование: /filter del <слово или ID>');
        }
        const input = args.slice(1).join(' ').trim();
        let indexToRemove = -1;
        if (!isNaN(input)) {
          const id = parseInt(input) - 1;
          if (id >= 0 && id < filters.length) {
            indexToRemove = id;
          }
        } else {
          indexToRemove = filters.findIndex(word => word === input.toLowerCase());
        }
        if (indexToRemove === -1) {
          return context.send(`❌ Слово или ID "${input}" не найдено в фильтре`);
        }
        const removedWord = filters[indexToRemove];
        filters.splice(indexToRemove, 1);
        try {
          fs.writeFileSync(filterFile, JSON.stringify(filters, null, 2));
          return context.send(`✅ Слово успешно удалено из фильтра.`);
        } catch (error) {
          console.error('Ошибка при сохранении фильтров:', error);
          return context.send('❌ Произошла ошибка при сохранении фильтра');
        }
        
      case 'help':
      case 'помощь':
      default:
        return context.send(
          `📋 Управление фильтрами:\n` +
          `✏️ /filter add <слово> - добавить слово в фильтр\n` +
          `📜 /filter all - показать все слова в фильтре\n` +
          `❌ /filter del <слово/id> - удалить слово из фильтра\n` +
          `🆘 /filter help - показать это меню\n\n` +
          `⚠️ Когда пользователь пишет запрещенное слово, оно будет автоматически удалено.`
        );
    }
  }
};