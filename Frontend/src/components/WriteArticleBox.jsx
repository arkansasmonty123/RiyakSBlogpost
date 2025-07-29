import React, { useState } from "react";
import "./WriteArticleBox.css";

export default function WriteArticleBox({ onArticleAdded }) {
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [content, setContent] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [source, setSource] = useState("My Sister");
  const [message, setMessage] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title || !summary || !content) {
      setMessage("Title, summary, and content are required!");
      return;
    }
    const res = await fetch("/api/articles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, summary, content, imageUrl, source, timeAgo: "Just now" }),
    });
    if (res.ok) {
      setMessage("Article submitted!");
      setTitle(""); setSummary(""); setContent(""); setImageUrl("");
      if (onArticleAdded) onArticleAdded();
    } else {
      setMessage("Error submitting article.");
    }
  }

  return (
    <div className="write-article-box">
      <h2>Write an Article</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Title"
          value={title}
          onChange={e => setTitle(e.target.value)}
        />
        <input
          type="text"
          placeholder="Summary"
          value={summary}
          onChange={e => setSummary(e.target.value)}
        />
        <textarea
          placeholder="Content"
          value={content}
          onChange={e => setContent(e.target.value)}
          rows={5}
        />
        <input
          type="text"
          placeholder="Image URL (optional)"
          value={imageUrl}
          onChange={e => setImageUrl(e.target.value)}
        />
        <button type="submit">Submit Article</button>
      </form>
      {message && <div className="write-article-message">{message}</div>}
    </div>
  );
}
