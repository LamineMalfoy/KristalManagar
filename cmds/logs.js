const { getUserRole, getRoleName } = require('./roles.js');
const { getLogs, formatLogEntries } = require('../utils/logs.js');
const { extractNumericId } = require('./ban.js');
const { checkCommandPriority, getCommandPriorities } = require('./editcmd.js');

module.exports = {
  command: '/logs',
  aliases: ['/логи', '/журнал'],
  description: 'Просмотр журнала действий администрации',
  async execute(context) {
    const { peerId, senderId, text } = context;
    
    // Проверяем приоритет команды через editcmd
    const hasPermission = await checkCommandPriority(peerId, senderId, '/logs');
    if (!hasPermission) {
      const priorities = await getCommandPriorities(peerId);
      const requiredRole = priorities['/logs'] || 40;
      const userRole = await getUserRole(peerId, context.senderId);
      const userRoleName = await getRoleName(peerId, userRole);
      return context.reply(`⛔ Доступ запрещён | Для использования команды /logs требуется приоритет ${requiredRole} или выше\n👤 Ваша роль: ${userRoleName} (приоритет ${userRole})`);
    }
    
    const parts = text.split(' ');
    
    // Определяем номер страницы и ID пользователя для фильтрации
    let page = 1;
    let targetId = null;
    
    if (parts.length > 1) {
      // Проверяем, является ли второй параметр числом (номер страницы) или ID пользователя
      if (!isNaN(parts[1]) && parts[1].length <= 3) {
        page = parseInt(parts[1]);
      } else {
        // Проверяем, является ли второй параметр упоминанием или ссылкой на пользователя
        if (parts[1].includes('[id') || parts[1].includes('vk.com/') || parts[1].startsWith('@')) {
          targetId = await extractNumericId(parts[1]);
        } else {
          // Если это не число и не упоминание, пробуем извлечь ID из текста
          const matches = parts[1].match(/id(\d+)/);
          if (matches && matches[1]) {
            targetId = parseInt(matches[1]);
          } else {
            targetId = await extractNumericId(parts[1]);
          }
        }
        
        // Если указана страница после ID пользователя
        if (parts.length > 2 && !isNaN(parts[2])) {
          page = parseInt(parts[2]);
        }
      }
    }
    
    try {
      // Получаем логи
      const logsData = await getLogs(peerId, page, targetId);
      const { logs, totalPages, currentPage } = logsData;
      
      if (logs.length === 0) {
        return context.reply('📋 Журнал действий пуст');
      }
      
      // Формируем сообщение с логами
      let message = `📋 Журнал действий\n📄 Страница ${currentPage} из ${totalPages}\n\n`;
      
      // ОПТИМИЗАЦИЯ: Форматируем все логи одним батчевым запросом
      const formattedEntries = await formatLogEntries(logs);
      message += formattedEntries.join('\n');
      
      if (formattedEntries.length > 0) {
        message += '\n';
      }
      
      // Добавляем навигацию
      message += '📝 Навигация:';
      
      if (currentPage > 1) {
        message += `\n/logs ${targetId ? targetId + ' ' : ''}${currentPage - 1} - предыдущая страница`;
      }
      
      if (currentPage < totalPages) {
        message += `\n/logs ${targetId ? targetId + ' ' : ''}${currentPage + 1} - следующая страница`;
      }
      
      return context.reply(message);
    } catch (error) {
      console.error('Ошибка при получении логов:', error);
      return context.reply('❌ Произошла ошибка при получении журнала действий');
    }
  }
}; 