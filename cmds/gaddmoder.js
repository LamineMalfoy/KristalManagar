const { getUserRole, checkIfTableExists, getRoleName, getpoolkey } = require('./roles.js');
const database = require('../databases.js');  
const util = require('util');
const { extractNumericId } = require('./ban.js');
const { vk } = require('../index.js');
const { getlink } = require('../util.js');
const databaseQuery = util.promisify(database.query);

module.exports = {
  command: '/gaddmoder',
  aliases: ['/gaddmoder'],
  description: 'Добавление роли Модератора пользователю',
  async execute(context) {
    const senderRoleId = await getUserRole(context.peerId, context.senderId);
    const { peerId, senderId, replyMessage } = context;
    const messageText = context.text;
    const parts = messageText.split(' ');
    const target = replyMessage ? replyMessage.senderId : parts[1];
	const userId = target || (replyMessage ? replyMessage.senderId : senderId);
    let label = await extractNumericId(userId);

    if (replyMessage) {
      label = replyMessage.senderId;
    }

    if (!(await checkIfTableExists(`roles_${context.peerId}`))) {
      return context.reply('❌ Таблица ролей не существует');
    }

    if (senderRoleId < 40) {
      return context.reply(`❌ У вас нет прав на выдачу роли Модератора`);
    }

    // Поиск всех пуллов, где состоит этот peerId
    const fs = require('fs');
    const path = require('path');
    const poolsDir = path.join(__dirname, '../data/pools');
    
    if (!fs.existsSync(poolsDir)) {
      return context.reply('❌ Пуллы не найдены.');
    }
    
    const poolFiles = fs.readdirSync(poolsDir);
    let pools = [];
    
    try {
      for (const file of poolFiles) {
        try {
          const data = JSON.parse(fs.readFileSync(path.join(poolsDir, file), 'utf8'));
          if (Array.isArray(data.pool_peerids) && data.pool_peerids.includes(String(peerId))) {
            pools.push(data);
          }
        } catch (error) {
          console.error(`Ошибка при чтении файла пулла ${file}:`, error);
        }
      }
      
      if (!pools.length) {
        return context.reply('❌ Пуллы не найдены.');
      }

      for (const pool of pools) {
        const poolPeerIds = pool.pool_peerids || [];

        let rolesAssigned = 0;
        let currentUserRole = 'Нет роли';
        
        for (const poolPeerId of poolPeerIds) {
          try {
            const senderRoleIdd = await getUserRole(poolPeerId, context.senderId);
            const roleId = 20; 
            const rolesTable = `roles_${poolPeerId}`;
            
            const chelikroleid = await getUserRole(poolPeerId, label);
            
            if (senderRoleIdd < 40) {
              continue;
            }
            if (senderRoleIdd <= chelikroleid) {
              continue;
            }
            
            if (chelikroleid >= roleId) {
              continue;
            }

            // Проверяем присутствие пользователя в чате
            const conversationMembers = await vk.api.messages.getConversationMembers({
              peer_id: poolPeerId,
            });

            const targetProfile = conversationMembers.profiles.find(profile => profile.id === parseInt(label));
            if (!targetProfile) {
              continue;
            }

            // Сохраняем старую роль для отображения
            if (rolesAssigned === 0) {
              currentUserRole = await getRoleName(poolPeerId, chelikroleid);
            }

            // Выдаем роль через SQL
            const insertRoleQuery = `
              INSERT INTO ${rolesTable} (user_id, role_id)
              VALUES (?, ?)
              ON DUPLICATE KEY UPDATE role_id = VALUES(role_id)
            `;

            await new Promise((resolve, reject) => {
              database.query(insertRoleQuery, [label, roleId], (error, result) => {
                if (error) {
                  console.error('Ошибка при добавлении роли:', error);
                  reject(error);
                } else {
                  rolesAssigned++;
                  resolve(result);
                }
              });
            });
            
          } catch (error) {
            console.error(`Ошибка при обработке чата ${poolPeerId}:`, error);
            continue;
          }
        }
        
        if (rolesAssigned > 0) {
          const targetLink = await getlink(label);
          context.reply(`✅️ ${targetLink} получил роль «Модератор» в ${rolesAssigned} беседах пулла\n❓ Прошлая роль: «${currentUserRole}»`);
        } else {
          context.reply('❌ Не удалось выдать роль ни в одной беседе пулла.');
        }
      }
    } catch (error) {
      console.error('Ошибка при добавлении роли:', error);
      return context.send('❌ Произошла ошибка.');
    }
  }
};
