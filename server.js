const express = require('express');
const path = require('path');
const bcrypt = require('bcrypt');
const { Pool } = require('pg');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ----------------------
// Статика (CSS, JS, manifest, sw)
// ----------------------
app.use(express.static(__dirname)); // теперь все файлы из корня доступны

// ----------------------
// PostgreSQL подключение
// ----------------------
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Проверка соединения с базой
pool.connect()
  .then(() => console.log('✅ PostgreSQL connected'))
  .catch(err => console.error('❌ DB INIT ERROR:', err));

// ----------------------
// Главная страница
// ----------------------
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ----------------------
// Регистрация пользователя
// ----------------------
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).send('Missing fields');

  try {
    const hashed = await bcrypt.hash(password, 10);
    await pool.query(
      'INSERT INTO users (username, password) VALUES ($1, $2)',
      [username, hashed]
    );
    res.status(200).send('User registered');
  } catch (err) {
    console.error(err);
    res.status(500).send('Database error');
  }
});

// ----------------------
// Вход пользователя
// ----------------------
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).send('Missing fields');

  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0) return res.status(400).send('User not found');

    const match = await bcrypt.compare(password, result.rows[0].password);
    if (!match) return res.status(400).send('Wrong password');

    res.status(200).send('Logged in');
  } catch (err) {
    console.error(err);
    res.status(500).send('Database error');
  }
});

// ----------------------
// Сервер
// ----------------------
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 fsociety running on port ${PORT}`);
});

