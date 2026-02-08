const express = require("express");
const fs = require("fs");
const path = require("path");
const bodyParser = require("body-parser");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, "data.json");

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(__dirname));

let data = { threads: [], users: [] };
if (fs.existsSync(DATA_FILE)) {
  data = JSON.parse(fs.readFileSync(DATA_FILE));
}

function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// ======= USERS =======
app.post("/api/register", (req,res)=>{
  const { username, password } = req.body;
  if(!username || !password) return res.status(400).json({error:"username and password required"});
  if(data.users.find(u=>u.username===username)) return res.status(400).json({error:"username taken"});
  const user = { id: Date.now(), username, password };
  data.users.push(user);
  saveData();
  res.json({message:"registered", userId: user.id, username: user.username});
});

app.post("/api/login", (req,res)=>{
  const { username, password } = req.body;
  const user = data.users.find(u=>u.username===username && u.password===password);
  if(!user) return res.status(400).json({error:"invalid credentials"});
  res.json({message:"ok", userId: user.id, username: user.username});
});

// ======= THREADS =======
app.get("/api/threads", (req,res)=>{
  res.json(data.threads);
});

app.post("/api/thread", (req,res)=>{
  const { title, text, userId } = req.body;
  if(!title||!text||!userId) return res.status(400).json({error:"missing data"});
  const user = data.users.find(u=>u.id==userId);
  if(!user) return res.status(400).json({error:"user not found"});
  const newThread = { id: Date.now(), title, text, userId: user.id, username: user.username, posts: [], created: new Date().toISOString() };
  data.threads.unshift(newThread);
  saveData();
  res.json(newThread);
});

app.post("/api/thread/:id/post", (req,res)=>{
  const thread = data.threads.find(t=>t.id==req.params.id);
  if(!thread) return res.status(404).json({error:"Thread not found"});
  const { text, userId } = req.body;
  if(!text||!userId) return res.status(400).json({error:"missing data"});
  const user = data.users.find(u=>u.id==userId);
  if(!user) return res.status(400).json({error:"user not found"});
  const post = { id: Date.now(), text, userId:user.id, username:user.username, created: new Date().toISOString() };
  thread.posts.push(post);
  saveData();
  res.json(post);
});

app.listen(PORT, ()=>console.log(`fsociety board running on port ${PORT}`));

