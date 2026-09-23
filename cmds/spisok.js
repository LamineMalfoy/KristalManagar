const { getUserRole, checkIfTableExists, getAllCustomRoles } = require('./roles.js');
const database = require('../databases.js');  

module.exports = {
  command: '/roles',
  aliases: ['/roles', '/роли'],
  description: 'Список доступных ролей для выдачи',
  async execute(context) {
    const senderRoleId = await getUserRole(context.peerId, context.senderId);

    if (!await checkIfTableExists(`roles_${context.peerId}`)) {
      return context.reply('❌ Таблица ролей не существует');
    }

    if (senderRoleId < 20) {
      return context.reply(`❌ У вас нет прав`);
    }

     
    try {
      const roles = await getAllCustomRoles(context.peerId);
      
      let message = '🛠 Список доступных ролей:\n\n';
      // Стандартные роли и их id
      const standardRoles = [
        { id: 20, name: 'Модератор' },
        { id: 40, name: 'Администратор' },
        { id: 60, name: 'Спец. Администратор' },
        { id: 80, name: 'Руководитель' },
        { id: 100, name: 'Владелец' }
      ];
      // Словарь кастомных ролей по id
      const customRolesMap = {};
      (roles || []).forEach(role => { customRolesMap[role.role_id] = role.role_name; });
      // Формируем массив кастомных ролей (включая кастомные стандартные)
      const customRoles = (roles || []).filter(role => role.role_name && role.role_name.trim() !== '');

      // Вывод всех стандартных ролей всегда
      // Выводим только один раз стандартные роли
      message += '🎲 Стандартные роли:\n';
      // Стандартные роли уже отсортированы по приоритету
      standardRoles.forEach(r => {
        // Всегда используем стандартное название для стандартных ролей
        message += `• ${r.name} (Приоритет: ${r.id})\n`;
      });
      message += '\n';

      // Кастомные роли: только если есть и только если название не совпадает со стандартным
      const customRolesFiltered = customRoles.filter(role => {
        const std = standardRoles.find(s => s.id === role.role_id);
        return !std || (std && std.name !== role.role_name);
      });
      if (customRolesFiltered.length > 0) {
        message += '🎨 Кастомные роли:\n';
        console.log('Кастомные роли до сортировки:', customRolesFiltered);
        
        // Создаём копию массива и сортируем по приоритету (от высшего к низшему)
        const rolesToSort = customRolesFiltered.map(role => ({
          role_id: Number(role.role_id),
          role_name: role.role_name
        }));
        
        console.log('Роли для сортировки:', rolesToSort);
        console.log('Первая роль:', rolesToSort[0]);
        console.log('Вторая роль:', rolesToSort[1]);
        
        // Сортируем роли по приоритету (от низшего к высшему)
        const sortedRoles = rolesToSort.sort((a, b) => {
          console.log(`Сравниваем ${a.role_id} и ${b.role_id}, результат: ${a.role_id - b.role_id}`);
          return a.role_id - b.role_id; // Сортировка от низшего к высшему приоритету
        });
        
        console.log('Кастомные роли после сортировки:', sortedRoles);
        console.log('Первая роль после сортировки:', sortedRoles[0]);
        console.log('Вторая роль после сортировки:', sortedRoles[1]);
        
        sortedRoles.forEach(role => {
          message += `• ${role.role_name} (Приоритет: ${role.role_id})\n`;
        });
      }
      context.reply(message);
    } catch (error) {
      console.error('Ошибка при получении списка ролей:', error);
      context.reply('❌ Произошла ошибка при получении списка ролей');
    }
  }
};
