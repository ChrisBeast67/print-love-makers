import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, Printer, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import type { User } from "@supabase/supabase-js";

type Profile = { id: string; username: string; avatar_url: string | null };
type Message = { id: string; user_id: string; content: string; created_at: string };

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const Chat = ({ user }: { user: User }) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Initial load
  useEffect(() => {
    let mounted = true;
    (async () => {
      const [{ data: msgs }, { data: profs }] = await Promise.all([
        supabase.from("messages").select("*").order("created_at", { ascending: true }).limit(200),
        supabase.from("profiles").select("id, username, avatar_url"),
      ]);
      if (!mounted) return;
      if (msgs) setMessages(msgs);
      if (profs) setProfiles(Object.fromEntries(profs.map((p) => [p.id, p])));
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("messages-room")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        async (payload) => {
          const msg = payload.new as Message;
          setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
          if (!profiles[msg.user_id]) {
            const { data } = await supabase
              .from("profiles")
              .select("id, username, avatar_url")
              .eq("id", msg.user_id)
              .maybeSingle();
            if (data) setProfiles((p) => ({ ...p, [data.id]: data }));
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "messages" },
        (payload) => {
          const old = payload.old as { id: string };
          setMessages((prev) => prev.filter((m) => m.id !== old.id));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = input.trim();
    if (!content || sending) return;
    setSending(true);
    const { error } = await supabase.from("messages").insert({ user_id: user.id, content });
    setSending(false);
    if (error) {
      toast({ title: "Couldn't send", description: error.message, variant: "destructive" });
    } else {
      setInput("");
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth", { replace: true });
  };

  const me = profiles[user.id];

  return (
    <div className="flex h-screen flex-col">
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2 text-xl font-bold">
            <Printer className="h-6 w-6 text-primary" />
            <span className="gradient-text">PrintForge Chat</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right text-sm sm:block">
              <div className="font-medium text-foreground">{me?.username ?? "..."}</div>
              <div className="text-xs text-muted-foreground">{user.email}</div>
            </div>
            <Avatar className="h-9 w-9 border border-border/50">
              <AvatarImage src={me?.avatar_url ?? undefined} />
              <AvatarFallback className="bg-primary/10 text-primary">
                {initials(me?.username ?? user.email ?? "?")}
              </AvatarFallback>
            </Avatar>
            <Button variant="ghost" size="icon" onClick={handleLogout} aria-label="Sign out">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden">
        <div ref={scrollRef} className="h-full overflow-y-auto">
          <div className="container mx-auto max-w-3xl space-y-4 px-6 py-6">
            {messages.length === 0 && (
              <div className="py-20 text-center text-muted-foreground">
                <div className="mb-2 text-lg">No messages yet</div>
                <div className="text-sm">Be the first to say hi 👋</div>
              </div>
            )}
            {messages.map((m) => {
              const p = profiles[m.user_id];
              const isMe = m.user_id === user.id;
              const name = p?.username ?? "Unknown";
              return (
                <div key={m.id} className={`flex gap-3 ${isMe ? "flex-row-reverse" : ""}`}>
                  <Avatar className="h-8 w-8 shrink-0 border border-border/50">
                    <AvatarImage src={p?.avatar_url ?? undefined} />
                    <AvatarFallback className="bg-primary/10 text-xs text-primary">
                      {initials(name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className={`max-w-[75%] ${isMe ? "items-end" : "items-start"} flex flex-col`}>
                    <div className={`mb-1 flex items-center gap-2 text-xs text-muted-foreground ${isMe ? "flex-row-reverse" : ""}`}>
                      <span className="font-medium text-foreground">{isMe ? "You" : name}</span>
                      <span>{formatTime(m.created_at)}</span>
                    </div>
                    <div
                      className={`rounded-2xl px-4 py-2 text-sm leading-relaxed ${
                        isMe
                          ? "bg-primary text-primary-foreground"
                          : "bg-card text-card-foreground border border-border/50"
                      }`}
                    >
                      {m.content}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>

      <footer className="border-t border-border/50 bg-background/80 backdrop-blur-xl">
        <form onSubmit={sendMessage} className="container mx-auto flex max-w-3xl items-center gap-2 px-6 py-4">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            maxLength={2000}
            className="border-border/50 bg-card"
            autoFocus
          />
          <Button type="submit" size="icon" disabled={sending || !input.trim()} aria-label="Send">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </footer>
    </div>
  );
};

export default Chat;