const express = require("express");
const { Pool } = require("pg");
const bcrypt = require("bcrypt");
const path = require("path");

const app = express();
app.use(express.json());
app.use(express.static(__dirname));

const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "forchan",
  password: "yourpassword",
  port: 5432,
});

// 🔥 Функция инициализации БД
async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        nickname VARCHAR(50) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log("Таблица users проверена / создана");
  } catch (err) {
    console.error("Ошибка создания таблицы:", err);
  }
}

// Регистрация
app.post("/register", async (req, res) => {
  const { nickname, password } = req.body;

  if (!nickname || !password) {
    return res.status(400).json({ error: "Заполни все поля" });
  }

  try {
    const hash = await bcrypt.hash(password, 10);

    await pool.query(
      "INSERT INTO users (nickname, password_hash) VALUES ($1, $2)",
      [nickname, hash]
    );

    res.json({ success: true });
  } catch (err) {
    if (err.code === "23505") {
      res.status(400).json({ error: "Ник уже занят" });
    } else {
      console.error(err);
      res.status(500).json({ error: "Ошибка сервера" });
    }
  }
});

// Запуск сервера
app.listen(3000, async () => {
  console.log("Server running on http://localhost:3000");
  await initDB(); // 💥 таблицы создаются при запуске
});

