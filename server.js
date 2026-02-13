
 // server.js
import express from "express";
import session from "express-session";
import pg from "pg";
import bcrypt from "bcrypt";
import bodyParser from "body-parser";

const app = express();
const PORT = process.env.PORT || 10000;

// Подключение к PostgreSQL через DATABASE_URL
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Middleware
app.use(bodyParser.json());
app.use(express.static("public")); // чтобы отдавать index.html и sw.js
app.use(
  session({
    secret: "fsociety-secret",
    resave: false,
    saveUninitialized: false,
  })
);

// Инициализация базы (если таблиц нет)
async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS threads (
        id SERIAL PRIMARY KEY,
        author_id INT REFERENCES users(id),
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("Database ready");
  } finally {
    client.release();
  }
}

// Регистрация
app.post("/register", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.json({ success: false, msg: "Заполните все поля" });

  const hashed = await bcrypt.hash(password, 10);
  try {
    const client = await pool.connect();
    await client.query("INSERT INTO users (username, password) VALUES ($1, $2)", [username, hashed]);
    client.release();
    res.json({ success: true });
  } catch (e) {
    if (e.code === "23505") res.json({ success: false, msg: "Пользователь уже существует" });
    else res.json({ success: false, msg: "Ошибка сервера" });
  }
});

// Логин
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const client = await pool.connect();
  try {
    const result = await client.query("SELECT * FROM users WHERE username=$1", [username]);
    client.release();
    if (result.rows.length === 0) return res.json({ success: false, msg: "Пользователь не найден" });

    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.json({ success: false, msg: "Неверный пароль" });

    req.session.userId = user.id;
    req.session.username = user.username;
    res.json({ success: true, username: user.username });
  } catch (e) {
    res.json({ success: false, msg: "Ошибка сервера" });
  }
});

// Создание треда
app.post("/thread", async (req, res) => {
  if (!req.session.userId) return res.json({ success: false, msg: "Необходимо войти" });

  const { content } = req.body;
  const client = await pool.connect();
  try {
    await client.query("INSERT INTO threads (author_id, content) VALUES ($1, $2)", [req.session.userId, content]);
    client.release();
    res.json({ success: true });
  } catch (e) {
    res.json({ success: false, msg: "Ошибка сервера" });
  }
});

// Получение всех тредов
app.get("/threads", async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT threads.id, threads.content, threads.created_at, users.username AS author
      FROM threads
      JOIN users ON threads.author_id = users.id
      ORDER BY threads.created_at DESC
    `);
    client.release();
    res.json(result.rows);
  } catch (e) {
    res.json([]);
  }
});

// Проверка авторизации
app.get("/me", (req, res) => {
  if (req.session.userId) res.json({ loggedIn: true, username: req.session.username });
  else res.json({ loggedIn: false });
});

// Логаут
app.post("/logout", (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// Запуск сервера
initDB().then(() => {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
});
