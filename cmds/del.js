const { getUserRole, getRoleName, checkIfTableExists } = require('./roles.js');
const { checkCommandPriority } = require('./editcmd.js');
const { getTime } = require('date-fns');

let countMsg = 0
async function deleteMessages(context, peerId, userId) {
  try {
    const yesterday = getTime(new Date()) - (24 * 60 * 60 * 1000);  

    let offset = 0;
    let messagesToDelete = [];

     
    while (true) {
      const response = await vk.api.messages.getHistory({
        peer_id: peerId,
        count: 200,
        rev: 1
      });

      const messages = response.items;

       
      const filteredMessages = messages.filter(message => {
        return message.date * 1000 > yesterday && message.from_id === userId;
      });

       
      if (filteredMessages.length === 0) {
        break;
      }

      messagesToDelete = messagesToDelete.concat(filteredMessages);

      offset += 200;  
    }

     
    for (const message of messagesToDelete) {
      await vk.api.messages.delete({
        message_ids: message.id,
        delete_for_all: 1  
      });
      
      countMsg++
    }

    await context.send(`⚠ Удалено ${countMsg} сообщений [id${context.replyMessage.senderId}|пользователя] за последние 24 часа`)
  } catch (error) {
    console.error('Произошла ошибка:', error);
  }
}

module.exports = {
  command: '/delete',
  aliases: ['/del', '/удалить', '/clear', '/чистка', '/очистка'],
  description: 'Удалить сообщение',
  async execute(context) {
    const { peerId, senderId, replyMessage } = context;
    
    // Проверяем существование таблицы
    if (!(await checkIfTableExists(`conference_${peerId}`))) {
      return context.send("❌ Беседа не зарегистрирована!");
    }
    
    // Проверяем права через checkCommandPriority
    const hasAccess = await checkCommandPriority(peerId, context.senderId, '/del');
    if (!hasAccess) {
      const senderUserRole = await getUserRole(peerId, context.senderId);
      const roleName = await getRoleName(peerId, senderUserRole);
      // Получаем актуальный требуемый приоритет для команды
      const { getCommandPriorities } = require('./editcmd.js');
      const priorities = await getCommandPriorities(peerId);
      const requiredPriority = priorities['/del'] || 40;
      return context.send(`⛔ Доступ запрещён | Для использования команды /del требуется приоритет ${requiredPriority} или выше\n👤 Ваша роль: ${roleName} (приоритет ${senderUserRole})`);
    }
    
    if (!replyMessage) {
      return context.reply('⚠️ Ответьте на сообщение, которое хотите удалить');
    }
    
    try {
      // Удаляем конкретное сообщение, на которое ответили
      await vk.api.messages.delete({
        peer_id: peerId,
        delete_for_all: 1,
        cmids: replyMessage.conversationMessageId,
      });
      
      // Удаляем само сообщение с командой /del
      await vk.api.messages.delete({
        peer_id: peerId,
        delete_for_all: 1,
        cmids: context.conversationMessageId,
      });
      
      await context.reply('✅ Сообщение успешно удалено');
    } catch (error) {
      console.error('Ошибка при удалении сообщения:', error);
      await context.reply('❌ Не удалось удалить сообщение');
    }
  }
}