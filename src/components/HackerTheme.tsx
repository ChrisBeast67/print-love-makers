import { useEffect } from "react";
import { useHackerMode } from "@/hooks/useHackerMode";

export function HackerTheme() {
  const { isHacked, isHacker, isOwner } = useHackerMode();

  useEffect(() => {
    if (isHacked) {
      // Apply green theme to entire app
      document.documentElement.classList.add("hacker-mode-active");
      
      // Add hacker CSS
      const style = document.createElement("style");
      style.id = "hacker-global-styles";
      style.textContent = `
        html.hacker-mode-active,
        html.hacker-mode-active body {
          --primary: #00ff00 !important;
          --background: #001a00 !important;
          --foreground: #00ff00 !important;
          filter: hue-rotate(80deg) saturate(2);
        }
        
        html.hacker-mode-active * {
          box-shadow: none !important;
        }
        
        html.hacker-mode-active .chat-bubble,
        html.hacker-mode-active [class*="bg-"],
        html.hacker-mode-active [class*="background"] {
          background-color: #003300 !important;
        }
        
        html.hacker-mode-active .messages-container {
          background: #001a00 !important;
        }
        
        html.hacker-mode-active .chat-sidebar {
          background: #002200 !important;
        }
        
        html.hacker-mode-active input,
        html.hacker-mode-active textarea {
          background: #111 !important;
          border-color: #00ff00 !important;
          color: #00ff00 !important;
        }
        
        html.hacker-mode-active button {
          background: #00ff00 !important;
          color: #000 !important;
          border-color: #00ff00 !important;
        }
        
        html.hacker-mode-active .send-button {
          background: #00ff00 !important;
        }
        
        html.hacker-mode-active .message {
          background: #003300 !important;
          color: #00ff00 !important;
        }
        
        html.hacker-mode-active .username,
        html.hacker-mode-active .display-name,
        html.hacker-mode-active .chat-name {
          color: #00ff00 !important;
          text-shadow: 0 0 10px #00ff00 !important;
        }
        
        html.hacker-mode-active .header,
        html.hacker-mode-active .navbar,
        html.hacker-mode-active .top-bar {
          background: #002200 !important;
          border-bottom: 2px solid #00ff00 !important;
        }
      `;
      document.head.appendChild(style);
    } else {
      document.documentElement.classList.remove("hacker-mode-active");
      const style = document.getElementById("hacker-global-styles");
      if (style) style.remove();
    }

    return () => {
      document.documentElement.classList.remove("hacker-mode-active");
      const style = document.getElementById("hacker-global-styles");
      if (style) style.remove();
    };
  }, [isHacked]);

  return null;
}

export function HackerNameTag({ username, userId }: { username: string; userId: string }) {
  const { isHacker, isOwner } = useHackerMode();

  if (!isHacker) return null;

  return (
    <span className="hacker-tag" title={`Hacker since ${new Date().toLocaleDateString()}`}>
      🕵️ [HACKER]
    </span>
  );
}

// Component to show username with hacker tag
export function UsernameWithTag({ username, userId }: { username: string; userId: string }) {
  const { isHacker: isSelfHacker } = useHackerMode();
  
  return (
    <span className="username-wrapper">
      <span className="username-text">{username}</span>
      {isSelfHacker && <span className="hacker-tag"> 🕵️ [HACKER]</span>}
    </span>
  );
}