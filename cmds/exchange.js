const { getUserResources, exchangeResources } = require('../filedb.js');
const { getlink } = require('../util.js');

module.exports = {
  command: '/обменник',
  aliases: ['/exchange', '/обмен', '/sell'],
  description: 'Обмен ресурсов на деньги',
  async execute(context) {
    try {
      const { senderId, text } = context;
      const args = text.split(' ').slice(1);
      
      // Если нет аргументов, показываем справку
      if (args.length === 0) {
        const resources = await getUserResources(senderId);
        const userName = await getlink(senderId);
        
        // Курсы обмена
        const exchangeRates = {
          stone: { name: '🪨 Камень', rate: 180 },
          coal: { name: '⚫ Уголь', rate: 230 },
          iron: { name: '🔩 Железо', rate: 350 },
          gold: { name: '🟡 Золото', rate: 500 },
          diamond: { name: '💎 Алмаз', rate: 1000 }
        };
        
        let message = `💱 Обменник ресурсов
👤 ${userName}

📊 Курсы:
🪨 Камень — 180$ ⚫ Уголь — 230$
🔩 Железо — 350$ 🟡 Золото — 500$
💎 Алмаз — 1000$

📦 Ваши ресурсы:`;

        let hasResources = false;
        let resourcesLine = '';
        for (const [type, amount] of Object.entries(resources)) {
          if (amount > 0) {
            const emoji = exchangeRates[type].name.split(' ')[0]; // Извлекаем эмодзи
            resourcesLine += `${emoji} ${amount} `;
            hasResources = true;
          }
        }
        
        if (hasResources) {
          message += `\n${resourcesLine.trim()}`;
        }
        
        if (!hasResources) {
          message += '\n🚫 У вас нет ресурсов для обмена';
        }
        
        message += `\n\n📥 Команда: /обменник [ресурс] [кол-во]
💡 Примеры: /обменник камень 10 | /обменник уголь 5`;
        
        return context.send(message);
      }
      
      // Обработка команды обмена
      if (args.length < 2) {
        return context.send('❌ Неверный формат команды!\n\n💡 Используйте: /обменник [ресурс] [количество]\n📝 Пример: /обменник камень 10');
      }
      
      const resourceType = args[0].toLowerCase();
      const amount = parseInt(args[1]);
      
      // Проверка корректности количества
      if (isNaN(amount) || amount <= 0) {
        return context.send('❌ Количество должно быть положительным числом!');
      }
      
      // Маппинг русских названий на английские ключи
      const resourceMapping = {
        'камень': 'stone',
        'stone': 'stone',
        'уголь': 'coal', 
        'coal': 'coal',
        'железо': 'iron',
        'iron': 'iron',
        'золото': 'gold',
        'gold': 'gold',
        'алмаз': 'diamond',
        'diamond': 'diamond'
      };
      
      const mappedResourceType = resourceMapping[resourceType];
      
      if (!mappedResourceType) {
        return context.send('❌ Неизвестный тип ресурса!\n\n💡 Доступные ресурсы: камень, уголь, железо, золото, алмаз');
      }
      
      // Выполняем обмен
      const result = await exchangeResources(senderId, mappedResourceType, amount);
      
      if (!result.success) {
        return context.send(`❌ ${result.error}`);
      }
      
      // Названия ресурсов для отображения
      const resourceNames = {
        stone: '🪨 Камень',
        coal: '⚫ Уголь',
        iron: '🔩 Железо', 
        gold: '🟡 Золото',
        diamond: '💎 Алмаз'
      };
      
      const userName = await getlink(senderId);
      
      const successMessage = `✅ Обмен завершён

👤 ${userName}
${resourceNames[result.resourceType]} × ${result.amount} → 💵 ${result.totalMoney.toLocaleString()}$
📈 Курс: ${result.rate}$ / шт.`;
      
      return context.send(successMessage);
      
    } catch (error) {
      console.error('Ошибка в команде обменник:', error);
      return context.send('❌ Произошла ошибка при выполнении обмена.');
    }
  }
};
