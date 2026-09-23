const fs = require('fs');
const path = require('path');

module.exports = (commands) => {
    const cmdsDir = path.join(__dirname, '../cmds');
    
    fs.readdirSync(cmdsDir).forEach(file => {
        try {
            console.info(`[LOADING] Загружаю ${file}...`);
            const command = require(path.join(cmdsDir, file));
            console.info(`[COMMAND] ${file} загружен!`); 
            commands.push(command);
        } catch (error) {
            console.error(`[ERROR] Ошибка при загрузке ${file}:`, error.message);
            console.error(`[ERROR] Stack trace:`, error.stack);
            throw error; // Перебрасываем ошибку для остановки загрузки
        }
    });
};
