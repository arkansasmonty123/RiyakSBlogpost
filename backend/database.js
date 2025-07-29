const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./goodgalriyak.db');

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS articles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    summary TEXT,
    content TEXT,
    imageUrl TEXT,
    source TEXT,
    timeAgo TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

module.exports = db;
