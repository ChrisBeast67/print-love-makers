import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, Printer, Send, Shield, Ban, ShieldCheck, Trash2 } from "lucide-react";
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
  const [isAdmin, setIsAdmin] = useState(false);
  const [bannedIds, setBannedIds] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);

  // Initial load
  useEffect(() => {
    let mounted = true;
    (async () => {
      const [{ data: msgs }, { data: profs }, { data: roles }, { data: bans }] = await Promise.all([
        supabase.from("messages").select("*").order("created_at", { ascending: true }).limit(200),
        supabase.from("profiles").select("id, username, avatar_url"),
        supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin"),
        supabase.from("banned_users").select("user_id"),
      ]);
      if (!mounted) return;
      if (msgs) setMessages(msgs);
      if (profs) setProfiles(Object.fromEntries(profs.map((p) => [p.id, p])));
      setIsAdmin((roles?.length ?? 0) > 0);
      if (bans) setBannedIds(new Set(bans.map((b) => b.user_id)));
    })();
    return () => {
      mounted = false;
    };
  }, [user.id]);

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
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "banned_users" },
        (payload) => {
          const row = payload.new as { user_id: string };
          setBannedIds((s) => new Set(s).add(row.user_id));
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "banned_users" },
        (payload) => {
          const row = payload.old as { user_id: string };
          setBannedIds((s) => {
            const next = new Set(s);
            next.delete(row.user_id);
            return next;
          });
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

  const banUser = async (targetId: string, username: string) => {
    const { error } = await supabase
      .from("banned_users")
      .insert({ user_id: targetId, banned_by: user.id });
    if (error) {
      toast({ title: "Couldn't ban", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `Banned ${username}` });
    }
  };

  const unbanUser = async (targetId: string, username: string) => {
    const { error } = await supabase.from("banned_users").delete().eq("user_id", targetId);
    if (error) {
      toast({ title: "Couldn't unban", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `Unbanned ${username}` });
    }
  };

  const deleteMessage = async (id: string) => {
    const { error } = await supabase.from("messages").delete().eq("id", id);
    if (error) {
      toast({ title: "Couldn't delete", description: error.message, variant: "destructive" });
    }
  };

  const me = profiles[user.id];
  const iAmBanned = bannedIds.has(user.id);

  return (
    <div className="flex h-screen flex-col">
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2 text-xl font-bold">
            <Printer className="h-6 w-6 text-primary" />
            <span className="gradient-text">PrintForge Chat</span>
            {isAdmin && (
              <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                <Shield className="h-3 w-3" /> Admin
              </span>
            )}
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
              const userBanned = bannedIds.has(m.user_id);
              return (
                <div key={m.id} className={`group flex gap-3 ${isMe ? "flex-row-reverse" : ""}`}>
                  <Avatar className="h-8 w-8 shrink-0 border border-border/50">
                    <AvatarImage src={p?.avatar_url ?? undefined} />
                    <AvatarFallback className="bg-primary/10 text-xs text-primary">
                      {initials(name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className={`max-w-[75%] ${isMe ? "items-end" : "items-start"} flex flex-col`}>
                    <div className={`mb-1 flex items-center gap-2 text-xs text-muted-foreground ${isMe ? "flex-row-reverse" : ""}`}>
                      <span className="font-medium text-foreground">{isMe ? "You" : name}</span>
                      {userBanned && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
                          <Ban className="h-2.5 w-2.5" /> banned
                        </span>
                      )}
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
                    {isAdmin && (
                      <div className={`mt-1 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 ${isMe ? "flex-row-reverse" : ""}`}>
                        {!isMe && (
                          userBanned ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 gap-1 px-2 text-xs text-primary hover:text-primary"
                              onClick={() => unbanUser(m.user_id, name)}
                            >
                              <ShieldCheck className="h-3 w-3" /> Unban
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 gap-1 px-2 text-xs text-destructive hover:text-destructive"
                              onClick={() => banUser(m.user_id, name)}
                            >
                              <Ban className="h-3 w-3" /> Ban
                            </Button>
                          )
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 gap-1 px-2 text-xs text-muted-foreground hover:text-destructive"
                          onClick={() => deleteMessage(m.id)}
                        >
                          <Trash2 className="h-3 w-3" /> Delete
                        </Button>
                      </div>
                    )}
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
            placeholder={iAmBanned ? "You are banned from sending messages" : "Type a message..."}
            maxLength={2000}
            className="border-border/50 bg-card"
            autoFocus
            disabled={iAmBanned}
          />
          <Button type="submit" size="icon" disabled={sending || !input.trim() || iAmBanned} aria-label="Send">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </footer>
    </div>
  );
};

export default Chat;