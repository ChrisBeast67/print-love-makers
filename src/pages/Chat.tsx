import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, MessageCircle, Send, Trash2, Ban } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  content: string;
  user_id: string;
  created_at: string;
}

interface Profile {
  id: string;
  username: string;
  avatar_url: string | null;
}

const Chat = () => {
  const navigate = useNavigate();
  const { user, loading, signOut } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isBanned, setIsBanned] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading && !user) navigate("/auth", { replace: true });
  }, [user, loading, navigate]);

  // Load admin & ban status
  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: roles }, { data: ban }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", user.id),
        supabase.from("banned_users").select("user_id").eq("user_id", user.id).maybeSingle(),
      ]);
      setIsAdmin(!!roles?.some((r) => r.role === "admin"));
      setIsBanned(!!ban);
    })();
  }, [user]);

  // Load initial messages and profiles
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: msgs } = await supabase
        .from("messages")
        .select("*")
        .order("created_at", { ascending: true })
        .limit(200);
      if (msgs) {
        setMessages(msgs);
        await loadProfiles(msgs.map((m) => m.user_id));
      }
    })();
  }, [user]);

  const loadProfiles = async (userIds: string[]) => {
    const unique = Array.from(new Set(userIds)).filter((id) => !profiles[id]);
    if (unique.length === 0) return;
    const { data } = await supabase.from("profiles").select("*").in("id", unique);
    if (data) {
      setProfiles((prev) => {
        const next = { ...prev };
        data.forEach((p) => (next[p.id] = p));
        return next;
      });
    }
  };

  // Realtime subscription
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("public:messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        async (payload) => {
          const m = payload.new as Message;
          setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
          await loadProfiles([m.user_id]);
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "messages" },
        (payload) => {
          const old = payload.old as Message;
          setMessages((prev) => prev.filter((m) => m.id !== old.id));
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !user || sending) return;
    setSending(true);
    const content = input.trim();
    setInput("");
    const { error } = await supabase.from("messages").insert({ content, user_id: user.id });
    setSending(false);
    if (error) {
      toast.error(isBanned ? "You are banned from sending messages." : error.message);
      setInput(content);
    }
  };

  const deleteMessage = async (id: string) => {
    const { error } = await supabase.from("messages").delete().eq("id", id);
    if (error) toast.error(error.message);
  };

  const banUser = async (targetId: string, username: string) => {
    if (!user) return;
    if (!confirm(`Ban ${username}?`)) return;
    const { error } = await supabase.from("banned_users").insert({ user_id: targetId, banned_by: user.id });
    if (error) toast.error(error.message);
    else toast.success(`${username} banned`);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  if (loading || !user) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-xl sticky top-0 z-10">
        <div className="container mx-auto flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-primary" />
            <span className="font-bold gradient-text">PrintChat</span>
            {isAdmin && (
              <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30">
                Admin
              </span>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Sign out</span>
          </Button>
        </div>
      </header>

      <main className="flex-1 container mx-auto flex flex-col max-w-3xl w-full px-4 py-4 min-h-0">
        <div ref={scrollRef} className="flex-1 overflow-y-auto pr-2">
          <div className="space-y-4 pb-4">
            {messages.length === 0 && (
              <p className="text-center text-muted-foreground text-sm py-12">
                No messages yet — say hello! 👋
              </p>
            )}
            {messages.map((m) => {
              const profile = profiles[m.user_id];
              const isMine = m.user_id === user.id;
              const name = profile?.username ?? "user";
              return (
                <div key={m.id} className={cn("flex gap-3 group", isMine && "flex-row-reverse")}>
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback className="bg-secondary text-xs">
                      {name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className={cn("flex flex-col max-w-[75%]", isMine && "items-end")}>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                      <span className="font-medium text-foreground/80">{name}</span>
                      <span>{new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                    <div
                      className={cn(
                        "rounded-2xl px-4 py-2 text-sm break-words",
                        isMine
                          ? "bg-primary text-primary-foreground rounded-br-sm"
                          : "bg-secondary text-secondary-foreground rounded-bl-sm"
                      )}
                    >
                      {m.content}
                    </div>
                    <div className="flex gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {(isMine || isAdmin) && (
                        <button
                          onClick={() => deleteMessage(m.id)}
                          className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1"
                        >
                          <Trash2 className="h-3 w-3" /> Delete
                        </button>
                      )}
                      {isAdmin && !isMine && (
                        <button
                          onClick={() => banUser(m.user_id, name)}
                          className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1 ml-2"
                        >
                          <Ban className="h-3 w-3" /> Ban
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <form onSubmit={sendMessage} className="flex gap-2 mt-2 pt-3 border-t border-border/50">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isBanned ? "You are banned from chatting" : "Type a message…"}
            disabled={sending || isBanned}
            maxLength={1000}
            className="flex-1"
          />
          <Button type="submit" disabled={!input.trim() || sending || isBanned}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </main>
    </div>
  );
};

export default Chat;