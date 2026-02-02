const mysql = require('mysql2');

const pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'attendance_user',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'accunite_attendance',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

const promisePool = pool.promise();

module.exports = { pool, promisePool };
