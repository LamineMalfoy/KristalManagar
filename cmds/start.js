const database = require('../databases.js');
const crypto = require('crypto');

function generateUniqueKey() {
  const keyLength = 5;
  const characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let key = '';

  for (let i = 0; i < keyLength; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    key += characters.charAt(randomIndex);
  }

  return key;
}

module.exports = {
  command: '/start',
  aliases: ['/старт'],
  description: 'Активация беседы (только для администраторов чата)',
  async execute(context) {
    const { peerId, senderId } = context;
    const conferenceId = peerId;
    
    try {
      // Проверяем, не активирована ли уже беседа
      const checkConferenceQuery = 'SELECT * FROM conference WHERE conference_id = ?';
      const conferenceResults = await new Promise((resolve, reject) => {
        database.query(checkConferenceQuery, [conferenceId], (error, results) => {
          if (error) {
            console.error('Ошибка при проверке активации беседы:', error);
            reject(error);
          } else {
            resolve(results);
          }
        });
      });

      if (conferenceResults && conferenceResults.length > 0) {
        return context.send('⚠️ Внимание | Беседа уже активирована в системе управления');
      }

      // Получаем информацию о конкретном пользователе, который написал команду
      const conversationInfo = await vk.api.messages.getConversationMembers({
        peer_id: peerId
      });

      // Ищем информацию о пользователе в результатах
      const currentUserInfo = conversationInfo.items.find(item => item.member_id === senderId);
      
      // Проверяем, является ли пользователь администратором чата (звезда в ВК)
      const isAdmin = currentUserInfo && (currentUserInfo.is_admin || currentUserInfo.is_owner);
      if (!isAdmin) {
        return context.send('❌ Ошибка | Только администратор чата (звезда в ВК) может активировать бота');
      }

      const conferenceTableQuery = `
        CREATE TABLE IF NOT EXISTS conference (
          conference_id INT PRIMARY KEY,
          games INT DEFAULT 0,
          kick_leave INT DEFAULT 0,
          rules TEXT,
          public TEXT,
          uniquekey TEXT,
          hello_text TEXT
        )
      `;

      let uniqueKey = generateUniqueKey();

      database.query(conferenceTableQuery, async (error) => {
        if (error) {
          console.error('Ошибка при создании таблицы conference:', error);
          return context.send('❌ Ошибка | Произошла ошибка при создании таблицы данных');
          }

          const newConferenceData = {
            conference_id: conferenceId,
            uniquekey: uniqueKey,
          };

          const nicknamesTableQuery = `
            CREATE TABLE IF NOT EXISTS nicknames_${conferenceId} (
              user_id INT PRIMARY KEY,
              nickname VARCHAR(255)
            )
          `;

          database.query(nicknamesTableQuery, async (error) => {
            if (error) {
              console.error('Ошибка при создании таблицы ролей:', error);
              return context.send('❌ Ошибка | Произошла ошибка при создании таблицы никнеймов');
            }

            const insertConferenceQuery = 'INSERT INTO conference SET ?';
            database.query(insertConferenceQuery, newConferenceData, async (error, result) => {
              if (error) {
                console.error('Ошибка при вставке данных в базу данных:', error);
                return context.send('❌ Ошибка | Произошла ошибка при вставке данных в базу данных');
              }

              const conferenceTableQuery = `
                CREATE TABLE IF NOT EXISTS conference_${conferenceId} (
                  user_id INT PRIMARY KEY,
                  messages_count INT,
                  coins INT,
                  blocked_users TEXT,
                  warns INT,
                  warns_history TEXT,
                  vigs INT,
                  vigs_history TEXT,
                  chat_block BOOLEAN
                )
              `;

              database.query(conferenceTableQuery, async (error) => {
                if (error) {
                  console.error('Ошибка при создании таблицы беседы:', error);
                  return context.send('❌ Ошибка | Произошла ошибка при создании таблицы беседы');
                }

                const rolesTableQuery = `
                  CREATE TABLE IF NOT EXISTS roles_${conferenceId} (
                    user_id INT PRIMARY KEY,
                    role_id INT
                  )
                `;

                database.query(rolesTableQuery, async (error) => {
                  if (error) {
                    console.error('Ошибка при создании таблицы ролей:', error);
                    return context.send('❌ Ошибка | Произошла ошибка при создании таблицы ролей');
                  }

                  const insertRoleQuery = `
                    INSERT INTO roles_${conferenceId} (user_id, role_id)
                    VALUES (?, ?)
                    ON DUPLICATE KEY UPDATE role_id = VALUES(role_id)
                  `;

                  database.query(insertRoleQuery, [senderId, 100], async (error, result) => {
                    if (error) {
                      console.error('Ошибка при назначении роли "Владелец":', error);
                      return context.send('❌ Ошибка | Произошла ошибка при назначении роли "Владелец"');
                    }

                    // Создаем кнопку "Посмотреть"
                    const { Keyboard } = require('vk-io');
                    
                    const activationKeyboard = Keyboard.builder()
                      .callbackButton({
                        label: 'Настроить',
                        payload: {
                          command: 'show_settings'
                        },
                        color: Keyboard.NEGATIVE_COLOR
                      })
                      .inline();

                    // Отправляем сообщение через VK API напрямую с кнопкой
                    try {
                      await vk.api.messages.send({
                        peer_id: peerId,
                        message: `🌃 Чудесно, теперь я могу управлять беседой!\n\n🔨 Настройте чат командой: /settings\n✨ Уникальный код чата: #${uniqueKey} (в случае проблем, отпишите Администратору - указав этот код)\n\n🛡️ Cистемы защиты от флуда и слива чата автоматически настроены и включены.`,
                        keyboard: activationKeyboard,
                        random_id: Date.now(),
                      });
                    } catch (sendError) {
                      console.error('Ошибка при отправке сообщения:', sendError);
                      // Если не удалось отправить через API, используем context.send с кнопкой
                      context.send({
                        message: `🌃 Чудесно, теперь я могу управлять беседой!\n\n🔨 Настройте чат командой: /settings\n✨ Уникальный код чата: #${uniqueKey} (в случае проблем, отпишите Администратору - указав этот код)\n\n🛡️ Cистемы защиты от флуда и слива чата автоматически настроены и включены.`,
                        keyboard: activationKeyboard
                      });
                    }
                });
              });
            });
          });
        });
      });
    } catch (error) {
      console.error('Ошибка при получении информации о чате:', error);
      return context.send('❌ Ошибка | Не удалось получить информацию о чате');
    }
  },
};
