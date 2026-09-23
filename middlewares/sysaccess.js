const { isSysBanned } = require('../cmds/sysadmin.js');
const { checkSystemTables } = require('../cmds/sysadmin.js');

module.exports = async (context, next) => {
  try {
     
    await checkSystemTables();
     
    const banInfo = await isSysBanned(context.senderId);
         
    if (banInfo) {
       
      if (context.text && context.text.startsWith('/')) {
        const banTimeText = banInfo.time === 0 ? 'навсегда' : `до ${new Date(banInfo.time * 1000).toLocaleString()}`;
        context.reply(`⛔ Вы заблокированы в системе бота ${banTimeText}\n📝 Причина: ${banInfo.reason}`);
        return;  
      }
    }
    
     // аягут ты нахуя сюда залез?
    return next();
  } catch (error) {
    console.error('Ошибка при проверке системного бана:', error);
    return next();  
  }
}; 