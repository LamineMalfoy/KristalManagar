const os = require('os');

 
function formatUptime(uptimeInSeconds) {
  const days = Math.floor(uptimeInSeconds / (60 * 60 * 24));
  const hours = Math.floor((uptimeInSeconds % (60 * 60 * 24)) / (60 * 60));
  const minutes = Math.floor((uptimeInSeconds % (60 * 60)) / 60);
  const seconds = Math.floor(uptimeInSeconds % 60);
  
  let result = [];
  if (days > 0) result.push(`${days}д`);
  if (hours > 0) result.push(`${hours}ч`);
  if (minutes > 0) result.push(`${minutes}м`);
  if (seconds > 0 || result.length === 0) result.push(`${seconds}с`);
  
  return result.join(' ');
}

module.exports = {
  command: '/ping',
  aliases: ['/пинг'],
  description: 'Проверка работоспособности бота',
  async execute(context) {
     
    const startTime = new Date();
    
     
    const uptimeInSeconds = os.uptime();
    const formattedUptime = formatUptime(uptimeInSeconds);
    
     
    const messageTime = new Date(context.createdAt * 1000);
    const latency = (startTime - messageTime) / 1000;
    
     
    const endTime = new Date();
    const executionTime = (endTime - startTime) / 1000;
    
     
    let connectionStatus = '✔ Отличное';
    if (latency > 0.5) connectionStatus = '✔ Хорошее';
    if (latency > 1) connectionStatus = '⚠ Среднее';
    if (latency > 2) connectionStatus = '❌ Плохое';
    
     
    const message = `🚀 Состояние системы\n\n` +
                    `🌐 Сеть: ${connectionStatus}\n` +
                    `⏱ Время отклика: ⏲ ${(latency * 1000).toFixed(0)} мс\n` +
                    `⚙️ Процессинг: 🔄 ${(executionTime * 1000).toFixed(0)} мс\n` +
                    `⏳ Аптайм: ⏰ ${formattedUptime}\n\n` +
                    `Версия обновленного бота 0.0.2`;
    
    await context.reply(message);
  }
};