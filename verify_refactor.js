/**
 * 🧪 КОМПЛЕКСНАЯ ПРОВЕРКА РЕФАКТОРИНГА EXTRACTNUMERICID
 * Проверяет что все команды корректно используют единую реализацию из ban.js
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 ПРОВЕРКА РЕФАКТОРИНГА EXTRACTNUMERICID...\n');

// Функция для проверки синтаксиса файла
function checkSyntax(filePath) {
    try {
        delete require.cache[require.resolve(filePath)];
        require(filePath);
        return { valid: true, error: null };
    } catch (error) {
        return { valid: false, error: error.message };
    }
}

// Функция для анализа файла
function analyzeFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const fileName = path.basename(filePath);
    
    const analysis = {
        fileName,
        hasLocalExtractNumericId: false,
        hasImportFromBan: false,
        hasAwaitUsage: false,
        syntaxValid: false,
        localImplementationLines: [],
        importLine: null,
        awaitUsageLines: []
    };
    
    // Проверяем синтаксис
    const syntaxCheck = checkSyntax(filePath);
    analysis.syntaxValid = syntaxCheck.valid;
    if (!syntaxCheck.valid) {
        analysis.syntaxError = syntaxCheck.error;
    }
    
    // Анализируем строки
    const lines = content.split('\n');
    lines.forEach((line, index) => {
        const lineNum = index + 1;
        const trimmedLine = line.trim();
        
        // Ищем локальные реализации extractNumericId
        if (trimmedLine.includes('function extractNumericId') && !trimmedLine.startsWith('//')) {
            analysis.hasLocalExtractNumericId = true;
            analysis.localImplementationLines.push(lineNum);
        }
        
        // Ищем импорт из ban.js
        if (trimmedLine.includes("require('./ban.js')") && trimmedLine.includes('extractNumericId')) {
            analysis.hasImportFromBan = true;
            analysis.importLine = lineNum;
        }
        
        // Ищем использование с await
        if (trimmedLine.includes('await extractNumericId') || 
            (trimmedLine.includes('extractNumericId') && trimmedLine.includes('await'))) {
            analysis.hasAwaitUsage = true;
            analysis.awaitUsageLines.push(lineNum);
        }
    });
    
    return analysis;
}

// Основная функция проверки
async function runVerification() {
    const cmdsDir = path.join(__dirname, 'cmds');
    const files = fs.readdirSync(cmdsDir).filter(file => file.endsWith('.js'));
    
    console.log(`📂 Найдено ${files.length} JS файлов в папке cmds/\n`);
    
    const results = {
        totalFiles: files.length,
        syntaxErrors: [],
        localImplementations: [],
        missingImports: [],
        correctFiles: [],
        banJsAnalysis: null
    };
    
    // Анализируем каждый файл
    for (const file of files) {
        const filePath = path.join(cmdsDir, file);
        const analysis = analyzeFile(filePath);
        
        console.log(`📄 ${file}:`);
        
        // Проверяем синтаксис
        if (!analysis.syntaxValid) {
            console.log(`   ❌ СИНТАКСИЧЕСКАЯ ОШИБКА: ${analysis.syntaxError}`);
            results.syntaxErrors.push({ file, error: analysis.syntaxError });
        } else {
            console.log(`   ✅ Синтаксис корректен`);
        }
        
        // Особая обработка для ban.js (эталон)
        if (file === 'ban.js') {
            results.banJsAnalysis = analysis;
            if (analysis.hasLocalExtractNumericId) {
                console.log(`   ✅ Содержит эталонную async реализацию extractNumericId (строка ${analysis.localImplementationLines[0]})`);
            } else {
                console.log(`   ❌ НЕ СОДЕРЖИТ эталонную реализацию extractNumericId!`);
            }
        } else {
            // Для всех остальных файлов
            
            // Проверяем локальные реализации (должны быть удалены)
            if (analysis.hasLocalExtractNumericId) {
                console.log(`   ❌ НАЙДЕНА ЛОКАЛЬНАЯ РЕАЛИЗАЦИЯ extractNumericId (строки: ${analysis.localImplementationLines.join(', ')})`);
                results.localImplementations.push({ file, lines: analysis.localImplementationLines });
            } else {
                console.log(`   ✅ Нет локальных реализаций extractNumericId`);
            }
            
            // Проверяем импорт из ban.js
            if (analysis.hasImportFromBan) {
                console.log(`   ✅ Импортирует extractNumericId из ban.js (строка ${analysis.importLine})`);
            } else {
                // Проверяем использует ли файл extractNumericId вообще
                const content = fs.readFileSync(filePath, 'utf8');
                if (content.includes('extractNumericId')) {
                    console.log(`   ❌ ИСПОЛЬЗУЕТ extractNumericId БЕЗ ИМПОРТА из ban.js`);
                    results.missingImports.push(file);
                } else {
                    console.log(`   ➖ Не использует extractNumericId`);
                }
            }
            
            // Проверяем корректность (нет локальных + есть импорт)
            if (!analysis.hasLocalExtractNumericId && 
                (analysis.hasImportFromBan || !fs.readFileSync(filePath, 'utf8').includes('extractNumericId'))) {
                results.correctFiles.push(file);
            }
        }
        
        console.log('');
    }
    
    // Итоговый отчет
    console.log('📊 ИТОГОВЫЙ ОТЧЕТ ВЕРИФИКАЦИИ:\n');
    
    console.log(`✅ Всего файлов проверено: ${results.totalFiles}`);
    console.log(`✅ Корректных файлов: ${results.correctFiles.length}`);
    
    if (results.syntaxErrors.length > 0) {
        console.log(`❌ Файлов с синтаксическими ошибками: ${results.syntaxErrors.length}`);
        results.syntaxErrors.forEach(({ file, error }) => {
            console.log(`   - ${file}: ${error}`);
        });
    } else {
        console.log(`✅ Синтаксических ошибок не найдено`);
    }
    
    if (results.localImplementations.length > 0) {
        console.log(`❌ Файлов с локальными реализациями: ${results.localImplementations.length}`);
        results.localImplementations.forEach(({ file, lines }) => {
            console.log(`   - ${file}: строки ${lines.join(', ')}`);
        });
    } else {
        console.log(`✅ Локальных реализаций extractNumericId не найдено`);
    }
    
    if (results.missingImports.length > 0) {
        console.log(`❌ Файлов без импорта из ban.js: ${results.missingImports.length}`);
        results.missingImports.forEach(file => {
            console.log(`   - ${file}`);
        });
    } else {
        console.log(`✅ Все файлы корректно импортируют extractNumericId`);
    }
    
    // Проверяем ban.js
    if (results.banJsAnalysis) {
        if (results.banJsAnalysis.hasLocalExtractNumericId && results.banJsAnalysis.syntaxValid) {
            console.log(`✅ ban.js содержит корректную эталонную реализацию`);
        } else {
            console.log(`❌ ban.js НЕ содержит корректную эталонную реализацию`);
        }
    }
    
    // Финальная оценка
    const totalErrors = results.syntaxErrors.length + results.localImplementations.length + results.missingImports.length;
    const hasValidBanJs = results.banJsAnalysis?.hasLocalExtractNumericId && results.banJsAnalysis?.syntaxValid;
    
    console.log('\n🎯 ИТОГОВАЯ ОЦЕНКА:');
    if (totalErrors === 0 && hasValidBanJs) {
        console.log('🎉 РЕФАКТОРИНГ ПОЛНОСТЬЮ УСПЕШЕН!');
        console.log('✅ Все команды используют единую async реализацию из ban.js');
        console.log('✅ Локальные реализации удалены');
        console.log('✅ Синтаксических ошибок нет');
        console.log('✅ Система готова к production использованию!');
    } else {
        console.log('⚠️ ОБНАРУЖЕНЫ ПРОБЛЕМЫ, ТРЕБУЮЩИЕ ИСПРАВЛЕНИЯ:');
        if (!hasValidBanJs) {
            console.log('❌ ban.js не содержит корректную эталонную реализацию');
        }
        if (results.syntaxErrors.length > 0) {
            console.log(`❌ ${results.syntaxErrors.length} синтаксических ошибок`);
        }
        if (results.localImplementations.length > 0) {
            console.log(`❌ ${results.localImplementations.length} файлов с локальными реализациями`);
        }
        if (results.missingImports.length > 0) {
            console.log(`❌ ${results.missingImports.length} файлов без импорта из ban.js`);
        }
    }
    
    return totalErrors === 0 && hasValidBanJs;
}

// Запускаем проверку
runVerification()
    .then(success => {
        if (success) {
            console.log('\n✅ ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ УСПЕШНО!');
            process.exit(0);
        } else {
            console.log('\n❌ ОБНАРУЖЕНЫ ПРОБЛЕМЫ!');
            process.exit(1);
        }
    })
    .catch(error => {
        console.error('\n💥 ОШИБКА ПРИ ВЫПОЛНЕНИИ ПРОВЕРКИ:', error);
        process.exit(1);
    });
