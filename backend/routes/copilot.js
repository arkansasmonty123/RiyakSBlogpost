const express = require('express');
const axios = require('axios');
const router = express.Router();

router.post('/ask', async (req, res) => {
  try {
    const { prompt } = req.body;
    const hfToken = process.env.HF_API_KEY;

    // Example with HuggingFace Inference API (text generation)
    const response = await axios.post(
      "https://api-inference.huggingface.co/models/bigscience/bloomz-560m",
      { inputs: prompt },
      { headers: { Authorization: `Bearer ${hfToken}` }, timeout: 20000 }
    );
    const text = (response.data[0] && response.data[0].generated_text) || "Sorry, no answer.";
    res.json({ answer: text });
  } catch (e) {
    res.status(500).json({ error: "AI failed to answer." });
  }
});

module.exports = router;
