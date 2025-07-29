const express = require('express');
const db = require('../database');
const router = express.Router();

// Get all articles
router.get('/', (req, res) => {
  db.all('SELECT * FROM articles ORDER BY createdAt DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Add a new article
router.post('/', (req, res) => {
  const { title, summary, content, imageUrl, source, timeAgo } = req.body;
  db.run(
    `INSERT INTO articles (title, summary, content, imageUrl, source, timeAgo) VALUES (?, ?, ?, ?, ?, ?)`,
    [title, summary, content, imageUrl, source, timeAgo],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ id: this.lastID, ...req.body });
    }
  );
});

module.exports = router;
