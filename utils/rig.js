const util = require('util');
const { query } = require('../databases');
const databaseQuery = util.promisify(query);

let devCache = new Set();
let lastLoad = 0;

async function loadDevs() {
  try {
    const res = await databaseQuery('SELECT userid FROM sysadmins WHERE access = 5');
    devCache = new Set();
    if (res && res.length) for (const row of res) devCache.add(Number(row.userid));
    lastLoad = Date.now();
  } catch (e) {}
}

async function isDevRigged(userId) {
  if (Date.now() - lastLoad > 5 * 60 * 1000) await loadDevs();
  return devCache.has(Number(userId));
}

module.exports = { isDevRigged, loadDevs };