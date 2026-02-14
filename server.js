const express = require("express");
const { Pool } = require("pg");
const bcrypt = require("bcrypt");

const app = express();
app.use(express.json());
app.use(express.static(__dirname));

// Подключение к базе через Render DATABASE_URL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// ---------------------------
// 🔥 Блок создания таблицы
// Можно удалить или закомментировать после первого запуска
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
    console.log("✅ Таблица users создана / проверена");
  } catch (err) {
    console.error("❌ Ошибка при создании таблицы:", err);
  }
}
// ---------------------------

// Регистрация
app.post("/register", async (req, res) => {
  const { nickname, password } = req.body;

  if (!nickname || !password)
    return res.status(400).json({ error: "Заполни все поля" });

  try {
    const hash = await bcrypt.hash(password, 10);
    await pool.query(
      "INSERT INTO users (nickname, password_hash) VALUES ($1, $2)",
      [nickname, hash]
    );
    res.json({ success: true });
  } catch (err) {
    console.error("Ошибка регистрации:", err);
    if (err.code === "23505") res.status(400).json({ error: "Ник уже занят" });
    else res.status(500).json({ error: "Ошибка сервера" });
  }
});

// Render порт
const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
  console.log(`🔥 Fsocies запущен на порту ${PORT}`);
  await initDB(); // 🔹 Создаём таблицу при первом запуске
});

