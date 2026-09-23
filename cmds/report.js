const database = require('../databases.js');
const { isSysBanned } = require('./sysadmin.js');
const vk = require('../vkInstance.js');
const util = require('util');
const databaseQuery = util.promisify(database.query);

// Функция для проверки блокировки в системе репортов
async function isReportBanned(userId) {
  try {
    const query = 'SELECT * FROM report_banned WHERE user_id = ?';
    const results = await databaseQuery(query, [userId]);
    return results && results.length > 0 ? results[0] : null;
  } catch (error) {
    console.error('Ошибка при проверке блокировки репортов:', error);
    return null;
  }
}

// Функция для загрузки конфига репортов
function loadReportConfig() {
  try {
    const fs = require('fs');
    const path = require('path');
    const configPath = path.join(__dirname, '../jsons/report_config.json');
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (error) {
    console.error('Ошибка загрузки конфига репортов:', error);
    return { report_peer_id: null };
  }
}

module.exports = {
  command: '/report',
  description: 'Создание тикета в системе поддержки',
  async execute(context) {
    try {
       
      // Проверяем системный бан
      const banInfo = await isSysBanned(context.senderId);
      if (banInfo) {
        const banTimeText = banInfo.time === 0 ? 'навсегда' : `до ${new Date(banInfo.time * 1000).toLocaleString()}`;
        return context.reply(`⛔ Вы заблокированы в системе бота ${banTimeText}\n📝 Причина: ${banInfo.reason}`);
      }
      
      // Проверяем блокировку в системе репортов
      const reportBanInfo = await isReportBanned(context.senderId);
      if (reportBanInfo) {
        return context.reply(`❗ Внимание! Вы заблокированы в системе репортов.\n📝 Причина: ${reportBanInfo.reason || 'Не указана'}`);
      }

       
      const args = context.text.split(' ');
      if (args.length < 2) {
        return context.reply('❌ Ошибка синтаксиса | Используйте: /report [сообщение]');
      }

       
      const message = args.slice(1).join(' ');
      
       
      // Проверяем, есть ли уже открытый тикет у пользователя
      const checkQuery = 'SELECT * FROM tickets WHERE userid = ? AND status = ?';
      const existingTickets = await databaseQuery(checkQuery, [context.senderId, false]);
      
      if (existingTickets && existingTickets.length > 0) {
        return context.reply('❌ У вас уже есть открытый тикет. Дождитесь ответа от администрации.');
      }

       
      // Создаем timestamp в JavaScript вместо использования NOW()
      const currentTimestamp = Math.floor(Date.now() / 1000); // Unix timestamp в секундах
      const insertQuery = 'INSERT INTO tickets (userid, mess, peer_id, created_at) VALUES (?, ?, ?, ?)';
      const result = await databaseQuery(insertQuery, [context.senderId, message, context.peerId, currentTimestamp]);
      
       
      const ticketId = result.insertId;

       
      let userInfo;
      try {
        userInfo = await vk.api.users.get({ user_ids: context.senderId });
      } catch (error) {
        console.error('Ошибка при получении информации о пользователе:', error);
        userInfo = [{ first_name: 'Пользователь', last_name: context.senderId }];
      }

      // Отправляем подтверждение создания тикета пользователю
      context.reply(`✅ Уведомление: тикет №${ticketId} зарегистрирован.
📄 Текст обращения: ${message}

Пожалуйста, ожидайте ответа от администрации бота.`);

      // Формируем уведомление о новом тикете
      const ticketNotification = `📨 Новый тикет #${ticketId}\n` +
                                `👤 Отправитель: [id${context.senderId}|${userInfo[0].first_name} ${userInfo[0].last_name}]\n` +
                                `💬 Сообщение: ${message}\n\n` +
                                `👉 Для ответа используйте:\n` +
                                `/answer ${ticketId} [текст ответа]`;
      
      // Если указан peer_id для репортов в конфиге, отправляем туда
      const reportConfig = loadReportConfig();
      if (reportConfig.report_peer_id) {
        try {
          await vk.api.messages.send({
            peer_id: reportConfig.report_peer_id,
            message: ticketNotification,
            disable_mentions: true,
            random_id: Math.floor(Math.random() * 1000000)
          });
          console.log(`✅ Уведомление о тикете #${ticketId} отправлено в беседу ${reportConfig.report_peer_id}`);
        } catch (error) {
          console.error(`Ошибка при отправке уведомления в беседу ${reportConfig.report_peer_id}:`, error);
          
          // Если не удалось отправить в беседу, отправляем админам как раньше
          const adminsQuery = 'SELECT userid FROM sysadmins WHERE access >= 1';
          const admins = await databaseQuery(adminsQuery);
          
          if (admins && admins.length > 0) {
            for (const admin of admins) {
              try {
                await vk.api.messages.send({
                  peer_id: admin.userid,
                  message: ticketNotification,
                  disable_mentions: true,
                  random_id: Math.floor(Math.random() * 1000000)
                });
              } catch (adminError) {
                console.error(`Ошибка при отправке уведомления администратору ${admin.userid}:`, adminError);
              }
            }
          }
        }
      } else {
        // Если peer_id не указан, отправляем админам как раньше
        const adminsQuery = 'SELECT userid FROM sysadmins WHERE access >= 1';
        const admins = await databaseQuery(adminsQuery);
        
        if (admins && admins.length > 0) {
          for (const admin of admins) {
            try {
              await vk.api.messages.send({
                peer_id: admin.userid,
                message: ticketNotification,
                disable_mentions: true,
                random_id: Math.floor(Math.random() * 1000000)
              });
            } catch (error) {
              console.error(`Ошибка при отправке уведомления администратору ${admin.userid}:`, error);
            }
          }
        }
      }
    } catch (error) {
      console.error('Ошибка при выполнении команды report:', error);
      context.reply('❌ Произошла ошибка при выполнении команды');
    }
  },
};