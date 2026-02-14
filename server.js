const express = require("express");
const { Pool } = require("pg");
const bcrypt = require("bcrypt");
const session = require("express-session");

const app = express();
app.use(express.json());
app.use(express.static(__dirname));

// ----------------- Сессии -----------------
app.use(session({
  secret: "fsocies_secret_key", // лучше заменить на длинный рандом
  resave: false,
  saveUninitialized: true,
}));

// ----------------- Подключение к БД -----------------
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ----------------- Создание таблиц -----------------
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      nickname VARCHAR(50) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS threads (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      content TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  console.log("✅ Таблицы users и threads созданы / проверены");
}

// ----------------- Регистрация -----------------
app.post("/register", async (req, res) => {
  const { nickname, password } = req.body;
  if (!nickname || !password) return res.status(400).json({ error: "Заполни все поля" });

  try {
    const hash = await bcrypt.hash(password, 10);
    await pool.query("INSERT INTO users (nickname, password_hash) VALUES ($1, $2)", [nickname, hash]);
    res.json({ success: true });
  } catch (err) {
    if (err.code === "23505") res.status(400).json({ error: "Ник уже занят" });
    else res.status(500).json({ error: "Ошибка сервера" });
  }
});

// ----------------- Логин -----------------
app.post("/login", async (req, res) => {
  const { nickname, password } = req.body;
  if (!nickname || !password) return res.status(400).json({ error: "Заполни все поля" });

  try {
    const result = await pool.query("SELECT * FROM users WHERE nickname=$1", [nickname]);
    const user = result.rows[0];
    if (!user) return res.status(400).json({ error: "Ник не найден" });

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(400).json({ error: "Неверный пароль" });

    req.session.userId = user.id;
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// ----------------- Получение ленты -----------------
app.get("/threads", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT threads.id, threads.content, threads.created_at, users.nickname 
      FROM threads 
      JOIN users ON threads.user_id = users.id
      ORDER BY threads.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// ----------------- Создание треда -----------------
app.post("/threads", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: "Не авторизован" });

  const { content } = req.body;
  if (!content) return res.status(400).json({ error: "Текст пустой" });

  try {
    await pool.query("INSERT INTO threads (user_id, content) VALUES ($1, $2)", [req.session.userId, content]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// ----------------- Сервер -----------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`🔥 Fsocies запущен на порту ${PORT}`);
  await initDB();
});


