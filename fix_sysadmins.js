const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, 'data', 'sysadmins');
const MY_ID = 755536919;

fs.readdir(DIR, (err, files) => {
  if (err) {
    console.error('Ошибка чтения директории sysadmins:', err);
    return;
  }
  let removed = 0, total = 0;
  files.forEach(file => {
    if (!file.endsWith('.json')) return;
    const id = parseInt(file.replace(/\.json$/, ''));
    if (id !== MY_ID) {
      fs.unlinkSync(path.join(DIR, file));
      removed++;
      console.log(`Файл ${file} удалён.`);
    } else {
      total++;
    }
  });
  console.log(`\nОставлен только твой файл (${MY_ID}.json). Удалено: ${removed}`);
}); 