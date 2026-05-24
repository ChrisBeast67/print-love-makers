import { useState, useEffect } from "react";
import { useHackerMode } from "@/hooks/useHackerMode";

interface HackerCodeInputProps {
  className?: string;
}

export function HackerCodeInput({ className = "" }: HackerCodeInputProps) {
  const [code, setCode] = useState("");
  const [showInput, setShowInput] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const { activateHackerMode, isHacker, isOwner, undoHack } = useHackerMode();
  const [showCode, setShowCode] = useState(false);

  // Secret key combination: Ctrl+Shift+H
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === "H") {
        e.preventDefault();
        setShowInput(true);
      }
      // Also allow typing "4568" anywhere when not in an input
      if (e.key === "4" || e.key === "5" || e.key === "6" || e.key === "8") {
        const target = e.target as HTMLElement;
        if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
        
        setCode((prev) => {
          const newCode = prev + e.key;
          if (newCode === "4568") {
            activateHackerMode();
            return "";
          }
          // Reset after 2 seconds of no input
          if (newCode.length >= 4) {
            setTimeout(() => setCode(""), 2000);
            return newCode.slice(-4);
          }
          return newCode.slice(-4);
        });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activateHackerMode]);

  const handleSubmit = () => {
    if (code === "4568") {
      activateHackerMode();
      setShowInput(false);
      setCode("");
    } else {
      setAttempts((prev) => prev + 1);
      // Wrong code = jumpscare too!
      activateHackerMode();
      setShowInput(false);
      setCode("");
    }
  };

  // Owner panel to undo hacks
  if (isOwner) {
    return (
      <div className={`hacker-owner-panel ${className}`}>
        <button
          onClick={undoHack}
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          🔓 Undo All Hacks
        </button>
      </div>
    );
  }

  if (!showInput) return null;

  return (
    <div className="hacker-overlay">
      <div className="hacker-modal">
        <button
          className="hacker-close"
          onClick={() => setShowInput(false)}
        >
          ✕
        </button>
        
        <h2 className="hacker-title">⚠️ SECRET ACCESS ⚠️</h2>
        
        <div className="hacker-warning">
          <p className="alert-text">⚠️ UNAUTHORIZED ACCESS DETECTED ⚠️</p>
          <p>Enter authorization code to proceed.</p>
          <p className="wrong-code-text">WRONG CODE WILL TRIGGER SECURITY PROTOCOL</p>
        </div>
        
        <input
          type="password"
          className="hacker-input"
          placeholder="____"
          maxLength={4}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          autoFocus
        />
        
        <button className="hacker-submit" onClick={handleSubmit}>
          EXECUTE
        </button>
        
        <style>{`
          .hacker-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.9);
            z-index: 99998;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .hacker-modal {
            background: #0a0a0a;
            border: 2px solid #00ff00;
            padding: 40px 50px;
            text-align: center;
            position: relative;
            max-width: 500px;
            width: 90%;
          }
          .hacker-close {
            position: absolute;
            top: 10px;
            right: 15px;
            background: none;
            border: none;
            color: #00ff00;
            font-size: 1.5rem;
            cursor: pointer;
          }
          .hacker-title {
            font-family: monospace;
            font-size: 1.8rem;
            color: #00ff00;
            margin-bottom: 25px;
            text-shadow: 0 0 20px #00ff00;
            animation: flicker 0.5s infinite alternate;
          }
          @keyframes flicker {
            from { opacity: 0.8; }
            to { opacity: 1; }
          }
          .hacker-warning p {
            font-family: monospace;
            font-size: 1rem;
            color: #00ff00;
            margin-bottom: 12px;
            line-height: 1.6;
          }
          .alert-text {
            color: #ff3333 !important;
            font-size: 1.2rem !important;
            animation: blink 0.3s infinite;
          }
          @keyframes blink {
            0%, 100% { opacity: 1; }
            50% { opacity: 0; }
          }
          .wrong-code-text {
            color: #ff6666 !important;
          }
          .hacker-input {
            background: #111;
            border: 2px solid #00ff00;
            color: #00ff00;
            font-family: monospace;
            font-size: 2rem;
            padding: 15px 30px;
            text-align: center;
            width: 200px;
            letter-spacing: 10px;
            outline: none;
            display: block;
            margin: 25px auto;
          }
          .hacker-input:focus {
            box-shadow: 0 0 30px rgba(0, 255, 0, 0.5);
          }
          .hacker-submit {
            background: transparent;
            border: 2px solid #00ff00;
            color: #00ff00;
            font-family: monospace;
            font-size: 1.3rem;
            padding: 12px 40px;
            cursor: pointer;
            transition: all 0.3s;
          }
          .hacker-submit:hover {
            background: #00ff00;
            color: #000;
          }
        `}</style>
      </div>
    </div>
  );
}