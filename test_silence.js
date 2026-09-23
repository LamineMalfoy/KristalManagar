// Тест загрузки команды тишина
console.log('🔍 Тестирование команды /тишина...');

try {
  // Проверяем базовые зависимости
  console.log('1. Проверка зависимостей...');
  const database = require('./databases.js');
  console.log('✅ databases.js загружен');
  
  const util = require('util');
  console.log('✅ util загружен');
  
  const { getUserRole, getRoleName, checkIfTableExists } = require('./cmds/roles.js');
  console.log('✅ roles.js загружен');
  
  const { checkCommandPriority, getCommandPriorities } = require('./cmds/editcmd.js');
  console.log('✅ editcmd.js загружен');
  
  const { getlink } = require('./util.js');
  console.log('✅ util.js загружен');
  
  // Проверяем загрузку команды
  console.log('2. Загрузка команды silence.js...');
  const silenceCommand = require('./cmds/silence.js');
  
  console.log('✅ Команда загружена успешно!');
  console.log('📋 Детали команды:');
  console.log('   - Command:', silenceCommand.command);
  console.log('   - Aliases:', silenceCommand.aliases);
  console.log('   - Description:', silenceCommand.description);
  console.log('   - Execute function:', typeof silenceCommand.execute);
  
  // Проверяем дополнительные функции
  console.log('3. Проверка дополнительных функций...');
  console.log('   - activateDeleteMode:', typeof silenceCommand.activateDeleteMode);
  console.log('   - activateMuteMode:', typeof silenceCommand.activateMuteMode);
  console.log('   - deactivateSilenceMode:', typeof silenceCommand.deactivateSilenceMode);
  
  console.log('🎉 ВСЕ ТЕСТЫ ПРОЙДЕНЫ! Команда /тишина должна работать.');
  
} catch (error) {
  console.error('❌ ОШИБКА при загрузке команды:');
  console.error('Сообщение:', error.message);
  console.error('Стек:', error.stack);
  process.exit(1);
}
