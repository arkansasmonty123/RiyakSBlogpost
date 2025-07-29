import React from "react";
import "./ArticleBox.css";

export default function ArticleBox({ article, large }) {
  return (
    <div className={`article-box animated-card${large ? " large" : ""}`}>
      <div className="img-wrap">
        <img src={article.imageUrl} alt={article.title} className="article-img" />
      </div>
      <div className="article-content">
        <h3>{article.title}</h3>
        {article.summary && <p className="article-summary">{article.summary}</p>}
        <div className="article-meta">
          <span>{article.source}</span>
          <span className="article-dot">•</span>
          <span>{article.timeAgo}</span>
        </div>
      </div>
    </div>
  );
}
