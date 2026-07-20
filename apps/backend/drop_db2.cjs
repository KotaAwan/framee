const mysql = require('mysql2/promise');

async function dropDB() {
  try {
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: 'root' // or no password? Let's check knexfile
    });
    await connection.query('DROP DATABASE IF EXISTS framee_dev');
    await connection.query('CREATE DATABASE framee_dev');
    console.log('DB dropped and recreated.');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
dropDB();
