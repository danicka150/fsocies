const express = require("express");
const { Pool } = require("pg");
const bcrypt = require("bcrypt");
const path = require("path");

const app = express();
app.use(express.json());
app.use(express.static("public"));

/* =======================
   POSTGRESQL CONNECTION
======================= */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

/* =======================
   INIT TABLES (RUN ONCE)
======================= */
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS boards (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT
      );

      CREATE TABLE IF NOT EXISTS threads (
        id SERIAL PRIMARY KEY,
        board_id INT,
        title TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS posts (
        id SERIAL PRIMARY KEY,
        thread_id INT,
        user_name TEXT,
        content TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // boards по умолчанию
    await pool.query(`
      INSERT INTO boards (name, description)
      VALUES 
        ('Technology', 'Tech / IT / Hacking'),
        ('Anime', 'Anime & Manga'),
        ('Games', 'Games & Gaming'),
        ('Random', 'Anything goes')
      ON CONFLICT DO NOTHING;
    `);

    console.log("✅ PostgreSQL ready");
  } catch (err) {
    console.error("❌ DB INIT ERROR:", err);
  }
})();

/* =======================
   AUTH
======================= */
app.post("/api/register", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: "Missing data" });

  try {
    const hash = await bcrypt.hash(password, 10);
    await pool.query(
      "INSERT INTO users (username, password) VALUES ($1,$2)",
      [username, hash]
    );
    res.json({ ok: true });
  } catch {
    res.status(400).json({ error: "User exists" });
  }
});

app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;

  const result = await pool.query(
    "SELECT * FROM users WHERE username=$1",
    [username]
  );

  if (result.rowCount === 0)
    return res.status(401).json({ error: "No user" });

  const user = result.rows[0];
  const ok = await bcrypt.compare(password, user.password);

  if (!ok)
    return res.status(401).json({ error: "Wrong password" });

  res.json({ ok: true, username });
});

/* =======================
   BOARDS
======================= */
app.get("/api/boards", async (req, res) => {
  const boards = await pool.query("SELECT * FROM boards ORDER BY id");
  res.json(boards.rows);
});

/* =======================
   THREADS
======================= */
app.get("/api/threads/:boardId", async (req, res) => {
  const { boardId } = req.params;
  const threads = await pool.query(
    "SELECT * FROM threads WHERE board_id=$1 ORDER BY created_at DESC",
    [boardId]
  );
  res.json(threads.rows);
});

app.post("/api/thread", async (req, res) => {
  const { boardId, title } = req.body;
  if (!title) return res.status(400).json({ error: "No title" });

  await pool.query(
    "INSERT INTO threads (board_id, title) VALUES ($1,$2)",
    [boardId, title]
  );

  res.json({ ok: true });
});

/* =======================
   POSTS
======================= */
app.get("/api/posts/:threadId", async (req, res) => {
  const { threadId } = req.params;
  const posts = await pool.query(
    "SELECT * FROM posts WHERE thread_id=$1 ORDER BY created_at",
    [threadId]
  );
  res.json(posts.rows);
});

app.post("/api/post", async (req, res) => {
  const { threadId, user, content } = req.body;
  if (!content)
    return res.status(400).json({ error: "Empty post" });

  await pool.query(
    "INSERT INTO posts (thread_id, user_name, content) VALUES ($1,$2,$3)",
    [threadId, user || "Anon", content]
  );

  res.json({ ok: true });
});

/* =======================
   FRONTEND
======================= */
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
});

/* =======================
   START
======================= */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log("🚀 fsociety running on port", PORT)
);

