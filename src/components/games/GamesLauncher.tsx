import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogTrigger, DialogHeader } from "@/components/ui/dialog";
import { Gamepad2, Footprints, Paintbrush } from "lucide-react";
import { Parkour } from "./Parkour";
import { Skribble } from "./Skribble";
import { toast } from "sonner";

interface Props { chatId: string; username: string }

type Kind = "parkour" | "skribble";

interface ActiveSession {
  id: string;
  kind: Kind;
  started_by: string;
}

export const GamesLauncher = ({ chatId, username }: Props) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<ActiveSession | null>(null);

  // Listen for new sessions broadcast through supabase realtime on game_sessions
  useEffect(() => {
    const ch = supabase
      .channel(`games-watch:${chatId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "game_sessions", filter: `chat_id=eq.${chatId}` },
        (payload) => {
          const s = payload.new as ActiveSession;
          if (active) return;
          setActive(s);
          setOpen(true);
          if (s.started_by !== user?.id) toast.info("A game is starting in this chat!");
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [chatId, user, active]);

  const startGame = async (kind: Kind) => {
    if (!user) return;
    const { data, error } = await supabase
      .from("game_sessions")
      .insert({ chat_id: chatId, kind, started_by: user.id })
      .select("id, kind, started_by")
      .single();
    if (error) return toast.error(error.message);
    setActive(data as ActiveSession);
    setOpen(true);
  };

  const closeGame = () => {
    setOpen(false);
    setActive(null);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : closeGame())}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          <Gamepad2 className="h-4 w-4" />
          <span className="hidden sm:inline ml-1">Games</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Mini-games</DialogTitle>
          <DialogDescription>
            {active
              ? "A game is in progress. Winner gets +25 credits."
              : "Pick a game to start. Anyone in this chat can join."}
          </DialogDescription>
        </DialogHeader>

        {!active ? (
          <div className="grid grid-cols-2 gap-4 pt-2">
            <button
              onClick={() => startGame("parkour")}
              className="rounded-xl border-2 border-primary/30 hover:border-primary p-6 text-left transition-all hover:-translate-y-1 glow-box"
            >
              <Footprints className="h-10 w-10 text-primary mb-3" />
              <div className="font-semibold">Parkour Race</div>
              <p className="text-sm text-muted-foreground mt-1">
                2D side-scroller. Jump obstacles, first to the finish wins.
              </p>
            </button>
            <button
              onClick={() => startGame("skribble")}
              className="rounded-xl border-2 border-accent/30 hover:border-accent p-6 text-left transition-all hover:-translate-y-1 glow-box"
            >
              <Paintbrush className="h-10 w-10 text-accent mb-3" />
              <div className="font-semibold">Skribble</div>
              <p className="text-sm text-muted-foreground mt-1">
                Host draws a secret word, others guess. Highest score wins.
              </p>
            </button>
          </div>
        ) : active.kind === "parkour" ? (
          <Parkour
            sessionId={active.id}
            chatId={chatId}
            userId={user!.id}
            username={username}
            isHost={active.started_by === user!.id}
            onClose={closeGame}
          />
        ) : (
          <Skribble
            sessionId={active.id}
            chatId={chatId}
            userId={user!.id}
            username={username}
            isHost={active.started_by === user!.id}
            onClose={closeGame}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};
