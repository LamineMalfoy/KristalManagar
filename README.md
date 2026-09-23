const mysql = require('mysql2');

 
const dbConfig = {
  host: '185.246.67.197', 
  user: 'admin', 
  password: '0mPf5eoS5boAtfW3', 
  database: 'bot_zakaz'  
  };

 
const connectionPool = mysql.createPool(dbConfig);

 
module.exports = {
  query(sql, values, callback) {
    return connectionPool.query(sql, values, callback);
  },

   
};