import React from "react";
import "./Header.css";

export default function Header() {
  return (
    <header className="header">
      <div className="logo">GOODGALRIYAK</div>
      <nav className="nav">
        <a href="#">Home</a>
        <a href="#">Technology</a>
        <a href="#">Science</a>
      </nav>
      <div className="search-bar">
        <input type="text" placeholder="Search" />
        <span className="search-icon" role="img" aria-label="search">🔍</span>
      </div>
    </header>
  );
}
