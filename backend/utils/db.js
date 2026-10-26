require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host:     process.env.DB_HOST,
  port:     parseInt(process.env.DB_PORT || '3306'),
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  // Return DATE columns as 'YYYY-MM-DD' text. As Date objects they land on local midnight,
  // and toISOString() then shifts them to the previous day in the Philippines (UTC+8).
  dateStrings: ['DATE'],
  // Hosted MySQL (e.g. Aiven) requires TLS; DB_SSL_CA holds the provider's CA certificate (PEM).
  // Left unset for a local MySQL server.
  ssl: process.env.DB_SSL_CA
    ? { ca: process.env.DB_SSL_CA.replace(/\\n/g, '\n'), rejectUnauthorized: true }
    : undefined,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

module.exports = pool;
