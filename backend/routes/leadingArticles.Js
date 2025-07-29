const express = require('express');
const axios = require('axios');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const apiKey = process.env.NEWS_API_KEY;
    const url = `https://newsapi.org/v2/top-headlines?language=en&pageSize=3&category=technology&apiKey=${apiKey}`;
    const response = await axios.get(url);
    const articles = response.data.articles.map((a, i) => ({
      id: `l${i+1}`,
      title: a.title,
      summary: a.description,
      imageUrl: a.urlToImage,
      source: a.source.name,
      timeAgo: a.publishedAt || "Recent"
    }));
    res.json(articles);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch leading articles" });
  }
});

module.exports = router;
