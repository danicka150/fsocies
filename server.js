
 const express = require("express");
const session = require("express-session");
const bcrypt = require("bcrypt");
const { Pool } = require("pg");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

app.set("trust proxy", 1);

app.use(session({
  secret: "supersecretkey",
  resave: false,
  saveUninitialized: false,
  cookie: { secure: true }
}));

// PostgreSQL Render
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Создание таблиц
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS threads (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      author TEXT NOT NULL
    );
  `);

  console.log("Database ready");
}

initDB();

// Регистрация
app.post("/register", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password)
    return res.json({ error: "Заполни всё" });

  const hash = await bcrypt.hash(password, 10);

  try {
    await pool.query(
      "INSERT INTO users (username, password) VALUES ($1,$2)",
      [username, hash]
    );
    res.json({ message: "Регистрация успешна" });
  } catch {
    res.json({ error: "Пользователь уже существует" });
  }
});

// Логин
app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  const result = await pool.query(
    "SELECT * FROM users WHERE username=$1",
    [username]
  );

  if (result.rows.length === 0)
    return res.json({ error: "Пользователь не найден" });

  const user = result.rows[0];
  const valid = await bcrypt.compare(password, user.password);

  if (!valid)
    return res.json({ error: "Неверный пароль" });

  req.session.user = user.username;
  res.json({ message: "Вход выполнен" });
});

// Проверка сессии
app.get("/me", (req, res) => {
  if (!req.session.user)
    return res.json({ loggedIn: false });

  res.json({ loggedIn: true, username: req.session.user });
});

// Создание треда
app.post("/threads", async (req, res) => {
  if (!req.session.user)
    return res.json({ error: "Необходимо войти" });

  const { title } = req.body;

  await pool.query(
    "INSERT INTO threads (title, author) VALUES ($1,$2)",
    [title, req.session.user]
  );

  res.json({ message: "Тред создан" });
});

// Получить треды
app.get("/threads", async (req, res) => {
  const result = await pool.query(
    "SELECT * FROM threads ORDER BY id DESC"
  );
  res.json(result.rows);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server started"));

