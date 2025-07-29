import React, { useState, useRef, useEffect } from "react";
import "./AICopilot.css";

export default function AICopilot({ articles }) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([
    { from: "ai", text: "Hi! I’m your AI Copilot. Ask about news, crypto, or research!" }
  ]);
  const endRef = useRef();

  useEffect(() => {
    if (endRef.current) endRef.current.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    if (!input.trim()) return;
    setMessages([...messages, { from: "user", text: input }]);
    setInput("");
    // Call backend for AI answer
    const res = await fetch("/api/copilot/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: input })
    });
    const data = await res.json();
    setMessages(msgs => [
      ...msgs,
      { from: "ai", text: data.answer || "Sorry, no answer." }
    ]);
  }

  return (
    <aside className="ai-copilot slide-in-right">
      <h3>AI Copilot</h3>
      <input
        value={input}
        onChange={e => setInput(e.target.value)}
        placeholder="Ask for articles, news, or research"
        onKeyDown={e => e.key === "Enter" && handleSend()}
      />
      <button onClick={handleSend}>Generate</button>
      <div className="chat-window">
        {messages.map((msg, idx) => (
          <div key={idx} className={`bubble ${msg.from}`}>
            {msg.text}
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </aside>
  );
}
