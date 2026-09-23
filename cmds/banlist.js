const database = require('../databases.js');
const { checkUserRole, checkIfTableExists, getUserRole, getRoleName, getRoleNamezov } = require('./roles.js');
const utils = require('../util.js');

module.exports = {
  command: '/banlist',
  aliases: ['/списокбанов'],
  description: 'Получить список заблокированных пользователей',
  async execute(context) {
    const { peerId, senderId } = context;
    const conferenceId = peerId;

    if (!await checkIfTableExists(`conference_${peerId}`)) {
      console.error('Таблица не существует');
      return context.send('⚠️ Беседа не активирована | Для активации используйте команду /start');
    }

    const { checkCommandPriority } = require('./editcmd.js');
    const hasPermission = await checkCommandPriority(peerId, senderId, '/banlist');
    if (!hasPermission) {
      const { getCommandPriorities } = require('./editcmd.js');
      const priorities = await getCommandPriorities(peerId);
      const requiredRole = priorities['/banlist'] || 20;
      const senderRole = await getUserRole(peerId, context.senderId);
      const senderRoleName = await getRoleName(peerId, senderRole);
      return context.reply(`⛔ Доступ запрещён | Для использования команды /banlist требуется приоритет ${requiredRole} или выше\n👤 Ваша роль: ${senderRoleName} (приоритет ${senderRole})`);
    }

    try {
      const selectAllUsersQuery = `
        SELECT user_id, blocked_users
        FROM conference_${conferenceId}
      `;

      database.query(selectAllUsersQuery, async (error, results) => {
        if (error) {
          console.error('Ошибка при выборке пользователей:', error);
          return context.send('❌ Ошибка системы | Не удалось получить данные о пользователях');
        }

        const banList = [];
        const userIds = results.map(nickInfo => nickInfo.user_id);

        try {
          const userInfos = await vk.api.users.get({ user_ids: userIds });
			
          const userMap = userInfos.reduce((acc, user) => {
            acc[user.id] = user;
            return acc;
          }, {});

          for (const result of results) {
            const userId = result.user_id;
            let blockedUsers = [];
            if (result.blocked_users) {
              try {
                blockedUsers = result.blocked_users.trim() ? JSON.parse(result.blocked_users) : [];
              } catch { blockedUsers = []; }
            }
            for (const block of blockedUsers) {
              if (block.blocked_user_id) {
                 
                banList.push({
                  userId,
                  blockedUserId: block.blocked_user_id,
                  blockedBy: block.blocked_by,
                  blockUntil: block.block_until,
                  reason: block.reason,
                });
              }
            }
          }

          if (banList.length === 0) {
            context.reply('✅ Нет блокировок | В беседе нет заблокированных пользователей');
          } else {
            let message = `⛔️ Список заблокированных\nПользователей.\n\n`;
            
            for (let i = 0; i < banList.length; i++) {
              const block = banList[i];
              const blockUntil = new Date(block.blockUntil);
              const formattedDate = blockUntil.toLocaleDateString('ru-RU');
              
              const userLink = await utils.getlink(block.blockedUserId);
              message += `${i + 1}. ${userLink}\n`;
              message += `— До: ${formattedDate}\n`;
              if (block.reason) {
                message += `— Причина: ${block.reason}\n`;
              }
              message += `\n`;
            }
            
            context.reply({ message: message, disable_mentions: true });
          }
        } catch (error) {
          console.error(error);
          context.reply('❌ Ошибка системы | Не удалось получить список заблокированных пользователей');
        }
      });
    } catch (error) {
      console.error(error);
      context.reply('❌ Ошибка системы | Не удалось выполнить команду');
    }
  },
};
