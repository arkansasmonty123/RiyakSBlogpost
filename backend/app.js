const express = require('express');
const cors = require('cors');
const articlesRouter = require('./routes/articles');
const globalNewsRouter = require('./routes/globalNews');
const leadingArticlesRouter = require('./routes/leadingArticles');
const copilotRouter = require('./routes/copilot');
const quizRouter = require('./routes/quiz');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/articles', articlesRouter);
app.use('/api/globalNews', globalNewsRouter);
app.use('/api/leadingArticles', leadingArticlesRouter);
app.use('/api/copilot', copilotRouter);
app.use('/api/quiz', quizRouter);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));
