import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

interface HackerModeContextValue {
  isHacker: boolean;
  isHacked: boolean;
  isOwner: boolean;
  activateHackerMode: () => Promise<void>;
  deactivateHackerMode: () => Promise<void>;
  undoHack: () => Promise<void>;
  triggerJumpscare: () => void;
  canRemoveHacker: (userId: string) => Promise<boolean>;
}

const HackerModeContext = createContext<HackerModeContextValue>({
  isHacker: false,
  isHacked: false,
  isOwner: false,
  activateHackerMode: async () => {},
  deactivateHackerMode: async () => {},
  undoHack: async () => {},
  triggerJumpscare: () => {},
  canRemoveHacker: async () => false,
});

export const HackerModeProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [isHacker, setIsHacker] = useState(false);
  const [isHacked, setIsHacked] = useState(false);
  const [isOwner, setIsOwner] = useState(false);

  // Hacker mode is kept on this device only (the profile has no hacker fields).
  useEffect(() => {
    setIsHacker(false);
    setIsOwner(false);
  }, [user]);

  const activateHackerMode = useCallback(async () => {
    if (!user) return;
    setIsHacker(true);
    triggerJumpscare();
    setIsHacked(true);
  }, [user]);

  const deactivateHackerMode = useCallback(async () => {
    if (!user) return;
    setIsHacker(false);
  }, [user]);

  const undoHack = useCallback(async () => {
    setIsHacker(false);
    setIsHacked(false);
  }, []);

  const canRemoveHacker = useCallback(async (targetUserId: string): Promise<boolean> => {
    if (!user) return false;
    if (isOwner) return true;
    if (user.id === targetUserId) return true;
    return false;
  }, [user, isOwner]);

  const triggerJumpscare = useCallback(() => {
    // Play scary sound
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.frequency.setValueAtTime(800, audioCtx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(200, audioCtx.currentTime + 0.5);
      gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
      oscillator.start(audioCtx.currentTime);
      oscillator.stop(audioCtx.currentTime + 0.5);
    } catch (e) {
      console.log("Audio not supported");
    }

    // Show jumpscare overlay
    const overlay = document.createElement("div");
    overlay.id = "hacker-jumpscare";
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: #00ff00;
      z-index: 99999;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      animation: hacker-shake 0.5s infinite;
    `;
    overlay.innerHTML = `
      <div style="font-size: 200px; animation: hacker-pulse 0.2s infinite alternate;">👻💀</div>
      <div style="font-family: monospace; font-size: 5rem; color: #000; margin-top: 20px; text-shadow: 0 0 50px red;">BOO!!!</div>
      <div style="font-family: monospace; font-size: 2rem; color: #000; margin-top: 10px;">Gotcha! 😱</div>
      <button onclick="this.parentElement.remove()" style="margin-top: 30px; padding: 15px 30px; font-size: 1.5rem; background: #000; color: #00ff00; border: 2px solid #000; cursor: pointer;">CLICK TO STOP</button>
    `;
    document.body.appendChild(overlay);

    // Auto-remove after 3 seconds
    setTimeout(() => overlay.remove(), 3000);
  }, []);

  // Add CSS for animations
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
      @keyframes hacker-shake {
        0%, 100% { transform: translate(0, 0) rotate(0deg); }
        10% { transform: translate(-10px, -10px) rotate(-1deg); }
        20% { transform: translate(10px, -10px) rotate(1deg); }
        30% { transform: translate(-10px, 10px) rotate(0deg); }
        40% { transform: translate(10px, 10px) rotate(1deg); }
        50% { transform: translate(-10px, -10px) rotate(-1deg); }
      }
      @keyframes hacker-pulse {
        from { transform: scale(1); }
        to { transform: scale(1.3); }
      }
    `;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);

  return (
    <HackerModeContext.Provider
      value={{
        isHacker,
        isHacked,
        isOwner,
        activateHackerMode,
        deactivateHackerMode,
        undoHack,
        triggerJumpscare,
        canRemoveHacker,
      }}
    >
      {children}
    </HackerModeContext.Provider>
  );
};

export const useHackerMode = () => useContext(HackerModeContext);