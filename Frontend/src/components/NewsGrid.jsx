import React from "react";
import ArticleBox from "./ArticleBox";
import "./NewsGrid.css";

export default function NewsGrid({ globalNews, leadingArticles, articles }) {
  return (
    <div className="news-section-grid slide-in">
      <div className="news-col global">
        <h2>Global News</h2>
        {globalNews.map(article => (
          <ArticleBox key={article.id} article={article} />
        ))}
      </div>
      <div className="news-col leading">
        <h2>Leading Articles</h2>
        {leadingArticles.map(article => (
          <ArticleBox key={article.id} article={article} large />
        ))}
      </div>
      <div className="news-col articles">
        <h2>All Articles</h2>
        {articles.map(article => (
          <ArticleBox key={article.id} article={article} />
        ))}
      </div>
    </div>
  );
}
