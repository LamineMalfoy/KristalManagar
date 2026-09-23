// 🧪 КОМПЛЕКСНАЯ СИСТЕМА ПРОВЕРОК VK БОТА
// =====================================

const fs = require('fs');
const path = require('path');

class ComprehensiveChecker {
  constructor() {
    this.results = {
      total: 0,
      passed: 0,
      failed: 0,
      warnings: 0,
      details: []
    };
  }

  log(type, category, test, status, message, details = null) {
    const result = {
      type,
      category,
      test,
      status,
      message,
      details,
      timestamp: new Date().toISOString()
    };
    
    this.results.details.push(result);
    this.results.total++;
    
    if (status === 'PASS') this.results.passed++;
    else if (status === 'FAIL') this.results.failed++;
    else if (status === 'WARN') this.results.warnings++;

    const emoji = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
    console.log(`${emoji} [${category}] ${test}: ${message}`);
    if (details) console.log(`   📝 ${details}`);
  }

  // 1️⃣ ПРОВЕРКИ ФАЙЛОВОЙ СИСТЕМЫ
  async checkFileSystem() {
    console.log('\n🗂️  ПРОВЕРКИ ФАЙЛОВОЙ СИСТЕМЫ');
    console.log('==============================');

    // Проверка основных файлов
    const criticalFiles = [
      'index.js',
      'filedb.js', 
      'databases.js',
      'package.json',
      'config.json'
    ];

    for (const file of criticalFiles) {
      try {
        if (fs.existsSync(file)) {
          const stats = fs.statSync(file);
          this.log('FILE', 'FileSystem', `Critical File: ${file}`, 'PASS', 
            `Существует (${stats.size} bytes)`, 
            `Modified: ${stats.mtime.toISOString()}`);
        } else {
          this.log('FILE', 'FileSystem', `Critical File: ${file}`, 'FAIL', 
            'Файл не найден');
        }
      } catch (error) {
        this.log('FILE', 'FileSystem', `Critical File: ${file}`, 'FAIL', 
          'Ошибка доступа', error.message);
      }
    }

    // Проверка папки команд
    try {
      const cmdsDir = './cmds';
      if (fs.existsSync(cmdsDir)) {
        const cmdFiles = fs.readdirSync(cmdsDir).filter(f => f.endsWith('.js'));
        this.log('FILE', 'FileSystem', 'Commands Directory', 'PASS', 
          `Найдено ${cmdFiles.length} команд`);
      } else {
        this.log('FILE', 'FileSystem', 'Commands Directory', 'FAIL', 
          'Папка команд не найдена');
      }
    } catch (error) {
      this.log('FILE', 'FileSystem', 'Commands Directory', 'FAIL', 
        'Ошибка чтения папки команд', error.message);
    }

    // Проверка папки данных
    try {
      const dataDir = './data';
      if (fs.existsSync(dataDir)) {
        this.log('FILE', 'FileSystem', 'Data Directory', 'PASS', 'Папка данных существует');
      } else {
        this.log('FILE', 'FileSystem', 'Data Directory', 'WARN', 
          'Папка данных не найдена (будет создана автоматически)');
      }
    } catch (error) {
      this.log('FILE', 'FileSystem', 'Data Directory', 'FAIL', 
        'Ошибка доступа к папке данных', error.message);
    }
  }

  // 2️⃣ ПРОВЕРКИ БАЗЫ ДАННЫХ
  async checkDatabase() {
    console.log('\n🗄️  ПРОВЕРКИ БАЗЫ ДАННЫХ');
    console.log('========================');

    // Проверка FileDB
    try {
      const filedb = require('./filedb.js');
      this.log('DB', 'Database', 'FileDB Loading', 'PASS', 'FileDB загружен успешно');
      
      // Проверка методов FileDB
      const expectedMethods = ['query', 'getUserBalance', 'updateUserBalance'];
      const availableMethods = Object.keys(filedb);
      
      for (const method of expectedMethods) {
        if (availableMethods.includes(method)) {
          this.log('DB', 'Database', `FileDB Method: ${method}`, 'PASS', 'Метод доступен');
        } else {
          this.log('DB', 'Database', `FileDB Method: ${method}`, 'FAIL', 'Метод отсутствует');
        }
      }

      // Тест простого запроса
      try {
        const testResult = filedb.query('SELECT 1 as test');
        this.log('DB', 'Database', 'FileDB Query Test', 'PASS', 'Тестовый запрос выполнен');
      } catch (queryError) {
        this.log('DB', 'Database', 'FileDB Query Test', 'FAIL', 
          'Ошибка выполнения запроса', queryError.message);
      }

    } catch (error) {
      this.log('DB', 'Database', 'FileDB Loading', 'FAIL', 
        'Ошибка загрузки FileDB', error.message);
    }

    // Проверка MySQL Database
    try {
      const database = require('./databases.js');
      this.log('DB', 'Database', 'MySQL Database Loading', 'PASS', 'MySQL DB загружен');
      
      // Проверка подключения (если возможно)
      if (database.query && typeof database.query === 'function') {
        this.log('DB', 'Database', 'MySQL Query Method', 'PASS', 'Метод query доступен');
      } else {
        this.log('DB', 'Database', 'MySQL Query Method', 'FAIL', 'Метод query недоступен');
      }

    } catch (error) {
      this.log('DB', 'Database', 'MySQL Database Loading', 'FAIL', 
        'Ошибка загрузки MySQL DB', error.message);
    }
  }

  // 3️⃣ ПРОВЕРКИ КОМАНД
  async checkCommands() {
    console.log('\n⚡ ПРОВЕРКИ КОМАНД');
    console.log('==================');

    try {
      const cmdsDir = './cmds';
      const cmdFiles = fs.readdirSync(cmdsDir).filter(f => f.endsWith('.js'));
      
      let loadedCommands = 0;
      let failedCommands = 0;

      for (const cmdFile of cmdFiles) {
        try {
          const cmdPath = path.join(cmdsDir, cmdFile);
          const command = require(cmdPath);
          
          if (command && command.command) {
            this.log('CMD', 'Commands', `Load: ${cmdFile}`, 'PASS', 
              `Команда ${command.command} загружена`);
            loadedCommands++;
          } else {
            this.log('CMD', 'Commands', `Load: ${cmdFile}`, 'WARN', 
              'Команда загружена, но структура неполная');
          }
        } catch (error) {
          this.log('CMD', 'Commands', `Load: ${cmdFile}`, 'FAIL', 
            'Ошибка загрузки команды', error.message);
          failedCommands++;
        }
      }

      this.log('CMD', 'Commands', 'Commands Summary', 'PASS', 
        `Загружено: ${loadedCommands}, Ошибок: ${failedCommands}`);

    } catch (error) {
      this.log('CMD', 'Commands', 'Commands Directory Scan', 'FAIL', 
        'Ошибка сканирования команд', error.message);
    }
  }

  // 4️⃣ ПРОВЕРКИ EXTRACTNUMERICID
  async checkExtractNumericId() {
    console.log('\n🔢 ПРОВЕРКИ EXTRACTNUMERICID');
    console.log('=============================');

    // Проверка эталонной реализации в ban.js
    try {
      const banModule = require('./cmds/ban.js');
      
      if (banModule.extractNumericId || 
          (banModule.default && banModule.default.extractNumericId)) {
        this.log('EXTRACT', 'ExtractNumericId', 'Ban.js Implementation', 'PASS', 
          'Эталонная реализация найдена в ban.js');
      } else {
        this.log('EXTRACT', 'ExtractNumericId', 'Ban.js Implementation', 'FAIL', 
          'Эталонная реализация не найдена в ban.js');
      }
    } catch (error) {
      this.log('EXTRACT', 'ExtractNumericId', 'Ban.js Implementation', 'FAIL', 
        'Ошибка загрузки ban.js', error.message);
    }

    // Проверка импортов в других командах
    const commandsWithExtract = [
      'stats.js', 'role.js', 'warnhistory.js', 'unrole.js', 'sysrole.js', 
      'rr.js', 'addspec.js', 'addmoder.js', 'addlead.js', 'addadmin.js',
      'editowner.js', 'getban.js', 'getwarn.js', 'gnick.js', 'grnick.js',
      'gsnick.js', 'rnick.js', 'snick.js', 'unagent.js'
    ];

    let correctImports = 0;
    let missingImports = 0;

    for (const cmdFile of commandsWithExtract) {
      try {
        const cmdPath = `./cmds/${cmdFile}`;
        if (fs.existsSync(cmdPath)) {
          const content = fs.readFileSync(cmdPath, 'utf8');
          
          if (content.includes('require(\'./ban.js\')') && 
              content.includes('extractNumericId')) {
            this.log('EXTRACT', 'ExtractNumericId', `Import: ${cmdFile}`, 'PASS', 
              'Корректный импорт из ban.js');
            correctImports++;
          } else {
            this.log('EXTRACT', 'ExtractNumericId', `Import: ${cmdFile}`, 'FAIL', 
              'Отсутствует импорт из ban.js');
            missingImports++;
          }
        }
      } catch (error) {
        this.log('EXTRACT', 'ExtractNumericId', `Import: ${cmdFile}`, 'FAIL', 
          'Ошибка проверки импорта', error.message);
      }
    }

    this.log('EXTRACT', 'ExtractNumericId', 'Import Summary', 'PASS', 
      `Корректных импортов: ${correctImports}, Отсутствует: ${missingImports}`);
  }

  // 5️⃣ ПРОВЕРКИ AWAIT
  async checkAwaitUsage() {
    console.log('\n⏳ ПРОВЕРКИ AWAIT USAGE');
    console.log('=======================');

    const commandsWithAwait = [
      'stats.js', 'warnhistory.js', 'unrole.js', 'sysrole.js', 
      'rr.js', 'role.js', 'addspec.js', 'addmoder.js', 'addlead.js', 'addadmin.js'
    ];

    let correctAwaits = 0;
    let missingAwaits = 0;

    for (const cmdFile of commandsWithAwait) {
      try {
        const cmdPath = `./cmds/${cmdFile}`;
        if (fs.existsSync(cmdPath)) {
          const content = fs.readFileSync(cmdPath, 'utf8');
          
          if (content.includes('await extractNumericId(')) {
            this.log('AWAIT', 'AwaitUsage', `Await: ${cmdFile}`, 'PASS', 
              'Корректное использование await');
            correctAwaits++;
          } else if (content.includes('extractNumericId(')) {
            this.log('AWAIT', 'AwaitUsage', `Await: ${cmdFile}`, 'FAIL', 
              'extractNumericId используется без await');
            missingAwaits++;
          } else {
            this.log('AWAIT', 'AwaitUsage', `Await: ${cmdFile}`, 'PASS', 
              'extractNumericId не используется');
          }
        }
      } catch (error) {
        this.log('AWAIT', 'AwaitUsage', `Await: ${cmdFile}`, 'FAIL', 
          'Ошибка проверки await', error.message);
      }
    }

    this.log('AWAIT', 'AwaitUsage', 'Await Summary', 'PASS', 
      `Корректных await: ${correctAwaits}, Отсутствует: ${missingAwaits}`);
  }

  // 6️⃣ ПРОВЕРКИ КОНФИГУРАЦИИ
  async checkConfiguration() {
    console.log('\n⚙️  ПРОВЕРКИ КОНФИГУРАЦИИ');
    console.log('=========================');

    // Проверка package.json
    try {
      const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
      
      if (packageJson.name) {
        this.log('CONFIG', 'Configuration', 'Package.json Name', 'PASS', 
          `Имя проекта: ${packageJson.name}`);
      }
      
      if (packageJson.dependencies) {
        const depCount = Object.keys(packageJson.dependencies).length;
        this.log('CONFIG', 'Configuration', 'Package.json Dependencies', 'PASS', 
          `Зависимостей: ${depCount}`);
      }

    } catch (error) {
      this.log('CONFIG', 'Configuration', 'Package.json', 'FAIL', 
        'Ошибка чтения package.json', error.message);
    }

    // Проверка config.json
    try {
      if (fs.existsSync('./config.json')) {
        const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
        this.log('CONFIG', 'Configuration', 'Config.json', 'PASS', 'Конфиг найден');
        
        // Проверка VK токена (без показа)
        if (config.vk_token) {
          this.log('CONFIG', 'Configuration', 'VK Token', 'PASS', 
            'VK токен присутствует в конфиге');
        } else {
          this.log('CONFIG', 'Configuration', 'VK Token', 'WARN', 
            'VK токен не найден в конфиге');
        }
      } else {
        this.log('CONFIG', 'Configuration', 'Config.json', 'WARN', 
          'config.json не найден');
      }
    } catch (error) {
      this.log('CONFIG', 'Configuration', 'Config.json', 'FAIL', 
        'Ошибка чтения config.json', error.message);
    }
  }

  // 7️⃣ ПРОВЕРКИ БЕЗОПАСНОСТИ
  async checkSecurity() {
    console.log('\n🔒 ПРОВЕРКИ БЕЗОПАСНОСТИ');
    console.log('========================');

    // Проверка на hardcoded токены
    try {
      const indexContent = fs.readFileSync('./index.js', 'utf8');
      
      if (indexContent.includes('token') && indexContent.includes('=')) {
        this.log('SECURITY', 'Security', 'Hardcoded Tokens', 'WARN', 
          'Возможны hardcoded токены в index.js');
      } else {
        this.log('SECURITY', 'Security', 'Hardcoded Tokens', 'PASS', 
          'Hardcoded токены не обнаружены');
      }
    } catch (error) {
      this.log('SECURITY', 'Security', 'Hardcoded Tokens', 'FAIL', 
        'Ошибка проверки токенов', error.message);
    }

    // Проверка прав доступа к папкам
    try {
      const testFile = './test_write_permissions.tmp';
      fs.writeFileSync(testFile, 'test');
      fs.unlinkSync(testFile);
      
      this.log('SECURITY', 'Security', 'Write Permissions', 'PASS', 
        'Права записи в корневую папку есть');
    } catch (error) {
      this.log('SECURITY', 'Security', 'Write Permissions', 'FAIL', 
        'Нет прав записи в корневую папку', error.message);
    }
  }

  // 8️⃣ ИТОГОВЫЙ ОТЧЁТ
  generateReport() {
    console.log('\n📊 ИТОГОВЫЙ ОТЧЁТ');
    console.log('==================');
    console.log(`🔢 Всего проверок: ${this.results.total}`);
    console.log(`✅ Пройдено: ${this.results.passed}`);
    console.log(`❌ Провалено: ${this.results.failed}`);
    console.log(`⚠️  Предупреждений: ${this.results.warnings}`);
    
    const successRate = ((this.results.passed / this.results.total) * 100).toFixed(1);
    console.log(`📈 Успешность: ${successRate}%`);
    
    if (this.results.failed === 0) {
      console.log('\n🎉 ВСЕ КРИТИЧЕСКИЕ ПРОВЕРКИ ПРОЙДЕНЫ!');
      console.log('🚀 СИСТЕМА ГОТОВА К РАБОТЕ!');
    } else {
      console.log('\n⚠️  ОБНАРУЖЕНЫ КРИТИЧЕСКИЕ ПРОБЛЕМЫ!');
      console.log('🔧 ТРЕБУЕТСЯ ИСПРАВЛЕНИЕ!');
    }

    return this.results;
  }

  // Основной запуск всех проверок
  async runAllChecks() {
    console.log('🧪 ЗАПУСК КОМПЛЕКСНЫХ ПРОВЕРОК СИСТЕМЫ');
    console.log('======================================');
    console.log(`⏰ Время: ${new Date().toISOString()}`);
    
    await this.checkFileSystem();
    await this.checkDatabase();
    await this.checkCommands();
    await this.checkExtractNumericId();
    await this.checkAwaitUsage();
    await this.checkConfiguration();
    await this.checkSecurity();
    
    return this.generateReport();
  }
}

// Экспорт для использования
module.exports = ComprehensiveChecker;

// Если запускается напрямую
if (require.main === module) {
  const checker = new ComprehensiveChecker();
  checker.runAllChecks().then(results => {
    console.log('\n✨ Проверки завершены!');
    process.exit(results.failed > 0 ? 1 : 0);
  }).catch(error => {
    console.error('❌ Критическая ошибка проверок:', error);
    process.exit(1);
  });
}
