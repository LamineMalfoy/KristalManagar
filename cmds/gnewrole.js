const { getUserRole, getRoleName, checkIfTableExists } = require('./roles.js');
const database = require('../databases.js');
const util = require('util');
const databaseQuery = util.promisify(database.query);
const cacheManager = require('../cacheManager.js');
const { checkCommandPriority, getCommandPriorities } = require('./editcmd.js');

module.exports = {
  command: '/gnewrole',
  description: 'Создание кастомной роли во всех беседах пулла',
  async execute(context) {
    const { peerId, senderId } = context;
    const messageText = context.text;
    const parts = messageText.split(' ');
    if (!(await checkIfTableExists(`roles_${peerId}`))) {
      return context.reply('❌ Таблица ролей не существует');
    }

    // Проверяем приоритет команды через editcmd
    const hasPermission = await checkCommandPriority(peerId, senderId, '/gnewrole');
    if (!hasPermission) {
      const priorities = await getCommandPriorities(peerId);
      const requiredRole = priorities['/gnewrole'] || 100;
      const senderRoleId = await getUserRole(peerId, context.senderId);
      const senderRoleName = await getRoleName(peerId, senderRoleId);
      return context.reply(`⛔ Доступ запрещён | Для использования команды /gnewrole требуется приоритет ${requiredRole} или выше\n👤 Ваша роль: ${senderRoleName} (приоритет ${senderRoleId})`);
    }

    // Получаем роль отправителя для дальнейших проверок
    const senderRoleId = await getUserRole(peerId, context.senderId);
     
    const priority = parseInt(parts[1]);
    const name = parts.slice(2).join(' ');

    if (!priority || isNaN(priority)) {
      return context.reply('❌ Укажите приоритет роли (число)');
    }

    // Удаляем запрет на стандартные id, чтобы можно было создавать кастомные роли с любым приоритетом
    // const standardRoleIds = [0, 10, 20, 30, 40, 50, 60, 80, 100];
    // if (standardRoleIds.includes(priority)) {
    //   return context.reply(`❌ Нельзя создать роль с приоритетом ${priority}, так как это ID стандартной роли. Используйте другой приоритет.`);
    // }

    if (priority < 0 || priority > 99) {
      return context.reply('❌ Приоритет должен быть от 0 до 99');
    }

    

    if (priority >= senderRoleId) {
      return context.reply('❌ Вы не можете создать роль с приоритетом равным или выше вашего');
    }

    if (!name) {
      return context.reply('❌ Укажите название роли');
    }

     
    // Поиск всех пуллов, где состоит этот peerId
    const fs = require('fs');
    const path = require('path');
    const poolsDir = path.join(__dirname, '../data/pools');
    const poolFiles = fs.readdirSync(poolsDir);
    let pools = [];
    for (const file of poolFiles) {
      const data = JSON.parse(fs.readFileSync(path.join(poolsDir, file), 'utf8'));
      if (Array.isArray(data.pool_peerids) && data.pool_peerids.includes(String(peerId))) {
        pools.push(data);
      }
    }
    if (!pools.length) {
      return context.reply('❌ Пуллы не найдены.');
    }

    let totalRoleCount = 0;
    for (const pool of pools) {
      const creatorId = pool.creator_id;
      if (parseInt(senderId) !== parseInt(creatorId) && senderRoleId < 100) {
        continue; // Пропускаем пуллы, где пользователь не создатель
      }

      const poolPeerIds = pool.pool_peerids;
      if (!Array.isArray(poolPeerIds) || poolPeerIds.length === 0) {
        continue;
      }

      for (const poolPeerId of poolPeerIds) {
        const senderRoleInChat = await getUserRole(poolPeerId, senderId);
        
         
        if (senderRoleInChat < 100) {
          continue;
        }

        try {
          // Создаем директорию для кастомных ролей, если её нет
          const customRolesDir = path.join(__dirname, `../data/custom_roles_${poolPeerId}`);
          if (!fs.existsSync(customRolesDir)) {
            fs.mkdirSync(customRolesDir, { recursive: true });
          }

          // Создаем файл с кастомными ролями
          const customRolesFile = path.join(customRolesDir, 'roles.json');
          let customRoles = [];
          
          if (fs.existsSync(customRolesFile)) {
            try {
              customRoles = JSON.parse(fs.readFileSync(customRolesFile, 'utf8'));
            } catch (parseError) {
              console.error(`Ошибка при чтении файла кастомных ролей для ${poolPeerId}:`, parseError);
              customRoles = [];
            }
          }

          // Проверяем, нет ли уже роли с таким приоритетом
          const existingRoleIndex = customRoles.findIndex(role => role.priority === priority);
          if (existingRoleIndex !== -1) {
            // Обновляем существующую роль
            customRoles[existingRoleIndex].name = name;
          } else {
            // Добавляем новую роль
            customRoles.push({
              priority: priority,
              name: name,
              created_at: new Date().toISOString()
            });
          }

          // Сохраняем обновленные роли
          fs.writeFileSync(customRolesFile, JSON.stringify(customRoles, null, 2));
          
          // Очищаем кэш кастомных ролей для этой беседы
          const customRolesCacheKey = `custom_roles_${poolPeerId}`;
          cacheManager.invalidate('customRoles', customRolesCacheKey);
          
          totalRoleCount++;
        } catch (error) {
          console.error(`Ошибка при создании кастомной роли в беседе ${poolPeerId}:`, error);
        }
      }
    }

    // Выводим результат после обработки всех пуллов
    if (totalRoleCount > 0) {
      context.reply(`✅ Кастомная роль «${name}» с приоритетом ${priority} успешно создана в ${totalRoleCount} беседах пуллов.`);
    } else {
      context.reply(`⚠️ Не удалось создать кастомную роль ни в одной беседе пуллов.`);
    }
  }
}; 