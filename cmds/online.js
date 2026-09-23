function getDeviceType(platform) {
  switch (platform) {
    case 1:
      return '📱 Мобильная версия';
    case 2:
      return '📱 iPhone';
    case 3:
      return '📱 iPad';
    case 4:
      return '📱 Android';
    case 5:
      return '📱 Windows Phone';
    case 6:
      return '💻 Windows 10';
    case 7:
      return '💻 Веб-версия';
    default:
      return '❓ Неизвестно';
  }
}

const { getUserRole, checkIfTableExists } = require('./roles.js');

module.exports = {
  command: '/online',
  aliases: ['/онлайн'],
  description: 'Вывести список пользователей онлайн',
  async execute(context) {
    const { peerId } = context;
    const senderRoleId = await getUserRole(context.peerId, context.senderId);
    if (!await checkIfTableExists(`roles_${context.peerId}`)) {
      return context.reply('⚠️ Беседа не активирована | Для активации используйте команду /start');
    }

    const conversationMembers = await vk.api.messages.getConversationMembers({
      peer_id: context.peerId,
    });

    const onlineMembers = conversationMembers.profiles.filter(member => member.online === 1);

    if (onlineMembers.length === 0) {
      return context.reply('⚠️ Нет пользователей онлайн | Сейчас никто из участников не находится в сети');
    }

    // Создаем массив сообщений
    const messages = [];
    let currentMessage = `🟢 Пользователи онлайн (${onlineMembers.length})\n\n`;
    
    for (const member of onlineMembers) {
      const isMobile = member.online_info && member.online_info.is_mobile;
      const deviceEmoji = isMobile ? '📱' : '💻';
      const platform = member.online_info && member.online_info.app_id ? 
        getDeviceType(member.online_info.app_id) : 
        (isMobile ? '📱 Мобильное устройство' : '💻 Компьютер');
      
      const userLine = `${deviceEmoji} [id${member.id}|${member.first_name} ${member.last_name}]\n`;
      
      // Если добавление новой строки превысит лимит, сохраняем текущее сообщение и начинаем новое
      if (currentMessage.length + userLine.length > 4000) {
        messages.push(currentMessage);
        currentMessage = '';
      }
      
      currentMessage += userLine;
    }
    
    // Добавляем последнее сообщение
    if (currentMessage.length > 0) {
      messages.push(currentMessage);
    }

    // Отправляем все сообщения
    for (const message of messages) {
      try {
        await context.reply({ 
          message: message, 
          disable_mentions: true 
        });
      } catch (error) {
        console.error('Ошибка при отправке сообщения:', error);
      }
    }
  },
};