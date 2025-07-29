import React, { useState, useEffect } from "react";
import Header from "./components/Header";
import NewsGrid from "./components/NewsGrid";
import QuizModal from "./components/QuizModal";
import AICopilot from "./components/AICopilot";
import WriteArticleBox from "./components/WriteArticleBox";
import "./styles/global.css";

export default function App() {
  const [articles, setArticles] = useState([]);
  const [globalNews, setGlobalNews] = useState([]);
  const [leadingArticles, setLeadingArticles] = useState([]);
  const [quizOpen, setQuizOpen] = useState(false);

  function refreshArticles() {
    fetch("/api/articles").then(res => res.json()).then(setArticles);
  }

  useEffect(() => {
    fetch("/api/globalNews").then(res => res.json()).then(setGlobalNews);
    fetch("/api/leadingArticles").then(res => res.json()).then(setLeadingArticles);
    refreshArticles();
  }, []);

  return (
    <div>
      <Header />
      <main>
        <WriteArticleBox onArticleAdded={refreshArticles} />
        <button
          className="open-quiz-btn"
          onClick={() => setQuizOpen(true)}
        >
          🎯 Take AI Quiz
        </button>
        <QuizModal open={quizOpen} onClose={() => setQuizOpen(false)} />
        <NewsGrid
          globalNews={globalNews}
          leadingArticles={leadingArticles}
          articles={articles}
        />
        <AICopilot articles={[...globalNews, ...leadingArticles, ...articles]} />
      </main>
    </div>
  );
}
