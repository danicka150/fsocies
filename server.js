const express = require("express");
const session = require("express-session");
const bcrypt = require("bcrypt");
const Database = require("better-sqlite3");

const app = express();
const db = new Database("database.db");

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: "supersecretkey",
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));

// --- Создание таблиц ---
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE,
  password TEXT
);

CREATE TABLE IF NOT EXISTS threads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT,
  author TEXT
);
`);

// --- Регистрация ---
app.post("/register", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password)
    return res.status(400).json({ error: "Заполни всё" });

  const hashed = await bcrypt.hash(password, 10);

  try {
    db.prepare("INSERT INTO users (username, password) VALUES (?, ?)")
      .run(username, hashed);

    res.json({ message: "Регистрация успешна" });
  } catch {
    res.status(400).json({ error: "Пользователь уже существует" });
  }
});

// --- Логин ---
app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  const user = db.prepare("SELECT * FROM users WHERE username = ?")
    .get(username);

  if (!user)
    return res.status(400).json({ error: "Пользователь не найден" });

  const valid = await bcrypt.compare(password, user.password);

  if (!valid)
    return res.status(400).json({ error: "Неверный пароль" });

  req.session.user = user.username;

  res.json({ message: "Вход выполнен" });
});

// --- Проверка сессии ---
app.get("/me", (req, res) => {
  if (!req.session.user)
    return res.json({ loggedIn: false });

  res.json({ loggedIn: true, username: req.session.user });
});

// --- Создание треда ---
app.post("/threads", (req, res) => {
  if (!req.session.user)
    return res.status(401).json({ error: "Необходимо войти" });

  const { title } = req.body;

  db.prepare("INSERT INTO threads (title, author) VALUES (?, ?)")
    .run(title, req.session.user);

  res.json({ message: "Тред создан" });
});

// --- Получить все треды ---
app.get("/threads", (req, res) => {
  const threads = db.prepare("SELECT * FROM threads").all();
  res.json(threads);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server started"));

