const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'FoodRescueDB',

  waitForConnections: true,
  connectionLimit: 3,
  queueLimit: 0,

  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  connectTimeout: 10000,

  dateStrings: true
});

module.exports = pool;
