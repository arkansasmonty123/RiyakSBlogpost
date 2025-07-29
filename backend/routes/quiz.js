const express = require('express');
const axios = require('axios');
const router = express.Router();

router.get('/random', async (req, res) => {
  try {
    const hfToken = process.env.HF_API_KEY;
    // Prompt to generate a random GK MCQ (customize/optimize as needed)
    const prompt = "Generate one random general knowledge MCQ in JSON format: {question, options:[a,b,c,d], answer}.";
    const response = await axios.post(
      "https://api-inference.huggingface.co/models/mistralai/Mixtral-8x7B-Instruct-v0.1",
      { inputs: prompt },
      { headers: { Authorization: `Bearer ${hfToken}` }, timeout: 20000 }
    );
    let quiz;
    try {
      quiz = JSON.parse(response.data[0].generated_text.match(/\{[\s\S]*\}/)[0]);
    } catch {
      quiz = {
        question: "Which planet is known as the Red Planet?",
        options: ["Venus", "Saturn", "Mars", "Jupiter"],
        answer: "Mars"
      };
    }
    res.json(quiz);
  } catch (e) {
    res.status(500).json({ error: "Could not generate quiz." });
  }
});

module.exports = router;
