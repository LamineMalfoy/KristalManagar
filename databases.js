const filedb = require('./filedb.js');

module.exports = {
  query(sql, values, callback) {
    return filedb.query(sql, values, callback);
  },
};