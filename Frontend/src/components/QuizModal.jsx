import React, { useState } from "react";
import "./QuizModal.css";

export default function QuizModal({ open, onClose }) {
  const [quiz, setQuiz] = useState(null);
  const [selected, setSelected] = useState(null);
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (open) {
      setLoading(true);
      setFeedback("");
      setSelected(null);
      fetch("/api/quiz/random")
        .then((res) => res.json())
        .then((data) => {
          setQuiz(data);
          setLoading(false);
        });
    }
  }, [open]);

  function handleSelect(option) {
    setSelected(option);
    setFeedback(
      option === quiz.answer
        ? "Correct! 🎉"
        : `Wrong. The answer is: ${quiz.answer}`
    );
  }

  function handleNext() {
    setLoading(true);
    setFeedback("");
    setSelected(null);
    fetch("/api/quiz/random")
      .then((res) => res.json())
      .then((data) => {
        setQuiz(data);
        setLoading(false);
      });
  }

  if (!open) return null;
  return (
    <div className="quiz-modal-overlay">
      <div className="quiz-modal">
        <button className="quiz-close" onClick={onClose}>&times;</button>
        <h3>Quiz Time!</h3>
        {loading && <div className="quiz-loading">Loading...</div>}
        {quiz && !loading && (
          <>
            <div className="quiz-question">{quiz.question}</div>
            <div className="quiz-options">
              {quiz.options.map((opt, i) => (
                <button
                  key={i}
                  className={`quiz-option ${selected === opt ? "selected" : ""}`}
                  onClick={() => handleSelect(opt)}
                  disabled={!!selected}
                >
                  {opt}
                </button>
              ))}
            </div>
            {feedback && (
              <div className={`quiz-feedback ${feedback.startsWith("Correct") ? "correct" : "wrong"}`}>{feedback}</div>
            )}
            {feedback && <button className="quiz-next" onClick={handleNext}>Next Question</button>}
          </>
        )}
      </div>
    </div>
  );
}
