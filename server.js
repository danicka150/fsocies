const express = require("express");
const { Pool } = require("pg");
const bcrypt = require("bcrypt");

const app = express();
app.use(express.json());
app.use(express.static(__dirname));

// дтабазы
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

// Регинунунуп
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

// Render порт
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`чупапи муняню ${PORT}`);
});
