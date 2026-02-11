const express = require("express");
const session = require("express-session");
const bodyParser = require("body-parser");
const { Pool } = require("pg");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 10000;

// DATABASE
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// MIDDLEWARE
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname)));
app.use(session({
  secret: "fsociety-secret",
  resave: false,
  saveUninitialized: false
}));

// CREATE TABLES
(async () => {
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
      user_id INTEGER REFERENCES users(id)
    );
  `);

  console.log("✅ Database tables are ready");
})();

// REGISTER
app.post("/api/register", async (req, res) => {
  const { username, password } = req.body;

  try {
    const result = await pool.query(
      "INSERT INTO users (username, password) VALUES ($1,$2) RETURNING id, username",
      [username, password]
    );

    req.session.user = result.rows[0];
    res.json({ success: true, user: result.rows[0] });

  } catch (err) {
    res.json({ success: false, message: "User already exists" });
  }
});

// LOGIN
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;

  const result = await pool.query(
    "SELECT id, username FROM users WHERE username=$1 AND password=$2",
    [username, password]
  );

  if (result.rows.length > 0) {
    req.session.user = result.rows[0];
    res.json({ success: true, user: result.rows[0] });
  } else {
    res.json({ success: false, message: "Invalid credentials" });
  }
});

// CURRENT USER
app.get("/api/me", (req, res) => {
  res.json({ user: req.session.user || null });
});

// CREATE THREAD
app.post("/api/thread", async (req, res) => {
  if (!req.session.user) {
    return res.json({ success: false, message: "Необходимо войти в аккаунт" });
  }

  const { title } = req.body;

  await pool.query(
    "INSERT INTO threads (title, user_id) VALUES ($1,$2)",
    [title, req.session.user.id]
  );

  res.json({ success: true });
});

// GET THREADS
app.get("/api/threads", async (req, res) => {
  const result = await pool.query(`
    SELECT threads.id, threads.title, users.username
    FROM threads
    JOIN users ON users.id = threads.user_id
    ORDER BY threads.id DESC
  `);

  res.json(result.rows);
});

app.listen(PORT, () => {
  console.log("🚀 fsociety running on port", PORT);
});

