// server.js
const express = require('express');
const path = require('path');
const bcrypt = require('bcrypt');
const { Pool } = require('pg');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ==== Подключение к базе PostgreSQL через Render DATABASE_URL ====
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // для Render
});

// ==== Автоматическое создание таблиц при запуске сервера ====
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS threads (
        id SERIAL PRIMARY KEY,
        title VARCHAR(200) NOT NULL,
        content TEXT,
        user_id INT REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS posts (
        id SERIAL PRIMARY KEY,
        thread_id INT REFERENCES threads(id),
        user_id INT REFERENCES users(id),
        content TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('✅ Database tables are ready');
  } catch (err) {
    console.error('❌ Table creation error:', err);
  }
})();

// ==== Статика ====
app.use(express.static(__dirname));

// ==== Главная страница ====
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ==== Регистрация пользователя ====
app.post('/api/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    const hashed = await bcrypt.hash(password, 10);

    await pool.query(
      'INSERT INTO users (username, password) VALUES ($1, $2)',
      [username, hashed]
    );

    res.status(200).send('User registered');
  } catch (err) {
    console.error('❌ Registration error:', err);
    res.status(500).send('Error registering user');
  }
});

// ==== Логин пользователя ====
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const result = await pool.query(
      'SELECT * FROM users WHERE username = $1',
      [username]
    );

    if (!result.rows.length) return res.status(400).send('User not found');

    const match = await bcrypt.compare(password, result.rows[0].password);
    if (!match) return res.status(400).send('Wrong password');

    res.status(200).send('Logged in');
  } catch (err) {
    console.error('❌ Login error:', err);
    res.status(500).send('Error logging in');
  }
});

// ==== Создание темы (thread) ====
app.post('/api/thread', async (req, res) => {
  try {
    const { title, content, user_id } = req.body;
    const result = await pool.query(
      'INSERT INTO threads (title, content, user_id) VALUES ($1, $2, $3) RETURNING *',
      [title, content, user_id]
    );
    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error('❌ Thread creation error:', err);
    res.status(500).send('Error creating thread');
  }
});

// ==== Создание поста в теме ====
app.post('/api/post', async (req, res) => {
  try {
    const { thread_id, user_id, content } = req.body;
    const result = await pool.query(
      'INSERT INTO posts (thread_id, user_id, content) VALUES ($1, $2, $3) RETURNING *',
      [thread_id, user_id, content]
    );
    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error('❌ Post creation error:', err);
    res.status(500).send('Error creating post');
  }
});

// ==== Запуск сервера ====
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 fsociety running on port ${PORT}`);
});
