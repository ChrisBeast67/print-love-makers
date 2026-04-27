import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { LogOut, MessageCircle, Send, Trash2, Plus, Users, UserPlus, Link2, Pencil, LogOut as LeaveIcon, X, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { GamesLauncher } from "@/components/games/GamesLauncher";

interface Message {
  id: string;
  content: string;
  user_id: string;
  chat_id: string;
  created_at: string;
}

interface Profile {
  id: string;
  username: string;
  avatar_url: string | null;
}

interface Chat {
  id: string;
  name: string | null;
  type: "dm" | "group";
  created_by: string;
  updated_at: string;
}

interface Member {
  chat_id: string;
  user_id: string;
  role: "admin" | "member";
  last_read_at: string;
}

const ChatPage = () => {
  const navigate = useNavigate();
  const { chatId } = useParams();
  const { user, loading, signOut } = useAuth();

  const [chats, setChats] = useState<Chat[]>([]);
  const [members, setMembers] = useState<Member[]>([]); // members of currently-open chat
  const [allMyMemberships, setAllMyMemberships] = useState<Member[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Dialogs
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [newChatType, setNewChatType] = useState<"group" | "dm">("group");
  const [newChatName, setNewChatName] = useState("");
  const [dmUsername, setDmUsername] = useState("");
  const [membersOpen, setMembersOpen] = useState(false);
  const [inviteUsername, setInviteUsername] = useState("");
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");

  useEffect(() => {
    if (!loading && !user) navigate("/auth", { replace: true });
  }, [user, loading, navigate]);

  // Load my chats
  const loadChats = async () => {
    if (!user) return;
    const { data: mems } = await supabase.from("chat_members").select("*").eq("user_id", user.id);
    if (!mems) return;
    setAllMyMemberships(mems);
    const ids = mems.map((m) => m.chat_id);
    if (ids.length === 0) {
      setChats([]);
      return;
    }
    const { data: cs } = await supabase
      .from("chats")
      .select("*")
      .in("id", ids)
      .order("updated_at", { ascending: false });
    if (cs) setChats(cs as Chat[]);

    // Load profiles for DM display names
    const dmChats = (cs ?? []).filter((c) => c.type === "dm");
    if (dmChats.length) {
      const { data: dmMems } = await supabase
        .from("chat_members")
        .select("*")
        .in("chat_id", dmChats.map((c) => c.id));
      if (dmMems) {
        await loadProfiles(dmMems.map((m) => m.user_id));
        // Stash dm members into allMyMemberships for name lookup
        setAllMyMemberships((prev) => {
          const seen = new Set(prev.map((m) => `${m.chat_id}:${m.user_id}`));
          const merged = [...prev];
          dmMems.forEach((m) => {
            const k = `${m.chat_id}:${m.user_id}`;
            if (!seen.has(k)) merged.push(m as Member);
          });
          return merged;
        });
      }
    }
  };

  useEffect(() => {
    loadChats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Auto-select first chat if none in URL
  useEffect(() => {
    if (!chatId && chats.length > 0) {
      navigate(`/chat/${chats[0].id}`, { replace: true });
    }
  }, [chatId, chats, navigate]);

  const loadProfiles = async (userIds: string[]) => {
    const unique = Array.from(new Set(userIds)).filter((id) => id && !profiles[id]);
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

  // Load messages + members for active chat
  useEffect(() => {
    if (!user || !chatId) {
      setMessages([]);
      setMembers([]);
      return;
    }
    (async () => {
      const [{ data: msgs }, { data: mems }] = await Promise.all([
        supabase.from("messages").select("*").eq("chat_id", chatId).order("created_at", { ascending: true }).limit(500),
        supabase.from("chat_members").select("*").eq("chat_id", chatId),
      ]);
      if (msgs) {
        setMessages(msgs as Message[]);
        await loadProfiles(msgs.map((m) => m.user_id));
      }
      if (mems) {
        setMembers(mems as Member[]);
        await loadProfiles(mems.map((m) => m.user_id));
      }
      // Update last_read_at
      await supabase
        .from("chat_members")
        .update({ last_read_at: new Date().toISOString() })
        .eq("chat_id", chatId)
        .eq("user_id", user.id);
    })();
  }, [chatId, user]);

  // Realtime: messages + typing for active chat
  useEffect(() => {
    if (!user || !chatId) return;

    const channel = supabase
      .channel(`chat:${chatId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `chat_id=eq.${chatId}` },
        async (payload) => {
          const m = payload.new as Message;
          setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
          await loadProfiles([m.user_id]);
          // Mark as read immediately if our window is open
          await supabase
            .from("chat_members")
            .update({ last_read_at: new Date().toISOString() })
            .eq("chat_id", chatId)
            .eq("user_id", user.id);
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "messages", filter: `chat_id=eq.${chatId}` },
        (payload) => {
          const old = payload.old as Message;
          setMessages((prev) => prev.filter((m) => m.id !== old.id));
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "typing_indicators", filter: `chat_id=eq.${chatId}` },
        async () => {
          const { data } = await supabase
            .from("typing_indicators")
            .select("*")
            .eq("chat_id", chatId)
            .gte("updated_at", new Date(Date.now() - 5000).toISOString());
          if (data) setTypingUsers(data.filter((t) => t.user_id !== user.id).map((t) => t.user_id));
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "chat_members", filter: `chat_id=eq.${chatId}` },
        (payload) => {
          const m = payload.new as Member;
          setMembers((prev) => prev.map((x) => (x.user_id === m.user_id ? m : x)));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [chatId, user]);

  // Realtime: my memberships (so new chats appear)
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`my-memberships:${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_members", filter: `user_id=eq.${user.id}` },
        () => loadChats()
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "chats" },
        () => loadChats()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Auto-scroll on new messages
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, typingUsers]);

  // Typing emit (debounced)
  const lastTypingSent = useRef(0);
  const onInputChange = async (v: string) => {
    setInput(v);
    if (!user || !chatId || !v) return;
    const now = Date.now();
    if (now - lastTypingSent.current < 2000) return;
    lastTypingSent.current = now;
    await supabase
      .from("typing_indicators")
      .upsert({ chat_id: chatId, user_id: user.id, updated_at: new Date().toISOString() });
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !user || !chatId || sending) return;
    setSending(true);
    const content = input.trim();
    setInput("");
    const { error } = await supabase.from("messages").insert({ content, user_id: user.id, chat_id: chatId });
    setSending(false);
    if (error) {
      toast.error(error.message);
      setInput(content);
      return;
    }
    // Clear typing
    await supabase.from("typing_indicators").delete().eq("chat_id", chatId).eq("user_id", user.id);
  };

  const deleteMessage = async (id: string) => {
    const { error } = await supabase.from("messages").delete().eq("id", id);
    if (error) toast.error(error.message);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const activeChat = chats.find((c) => c.id === chatId);
  const myMembership = members.find((m) => m.user_id === user?.id);
  const isAdminHere = myMembership?.role === "admin";

  // Derived: chat display name
  const getChatName = (c: Chat): string => {
    if (c.name) return c.name;
    if (c.type === "dm") {
      const others = allMyMemberships.filter((m) => m.chat_id === c.id && m.user_id !== user?.id);
      const other = others[0];
      return other ? profiles[other.user_id]?.username ?? "Direct message" : "Direct message";
    }
    return "Untitled chat";
  };

  // Unread per chat (basic: latest message after last_read)
  const lastReadByChat = useMemo(() => {
    const map: Record<string, string> = {};
    allMyMemberships.forEach((m) => {
      if (m.user_id === user?.id) map[m.chat_id] = m.last_read_at;
    });
    return map;
  }, [allMyMemberships, user]);

  // Read receipts: who has last_read_at >= message.created_at?
  const readByOthers = (msg: Message) => {
    return members.filter(
      (m) => m.user_id !== user?.id && new Date(m.last_read_at).getTime() >= new Date(msg.created_at).getTime()
    );
  };

  const createGroupChat = async () => {
    if (!newChatName.trim()) {
      toast.error("Enter a chat name");
      return;
    }
    const { data, error } = await supabase.rpc("create_group_chat", { _name: newChatName.trim() });
    if (error) return toast.error(error.message);
    setNewChatName("");
    setNewChatOpen(false);
    await loadChats();
    navigate(`/chat/${data}`);
    toast.success("Chat created");
  };

  const createDM = async () => {
    if (!dmUsername.trim()) return toast.error("Enter a username");
    const { data: prof, error: pErr } = await supabase
      .from("profiles")
      .select("id")
      .ilike("username", dmUsername.trim())
      .maybeSingle();
    if (pErr || !prof) return toast.error("User not found");
    const { data, error } = await supabase.rpc("create_or_get_dm", { _other_user: prof.id });
    if (error) return toast.error(error.message);
    setDmUsername("");
    setNewChatOpen(false);
    await loadChats();
    navigate(`/chat/${data}`);
  };

  const addMemberByUsername = async () => {
    if (!chatId || !inviteUsername.trim()) return;
    const { error } = await supabase.rpc("add_member_by_username", {
      _chat_id: chatId,
      _username: inviteUsername.trim(),
    });
    if (error) return toast.error(error.message);
    setInviteUsername("");
    toast.success("Member added");
    // Refresh members
    const { data: mems } = await supabase.from("chat_members").select("*").eq("chat_id", chatId);
    if (mems) {
      setMembers(mems as Member[]);
      await loadProfiles(mems.map((m) => m.user_id));
    }
  };

  const generateInvite = async () => {
    if (!chatId || !user) return;
    const { data, error } = await supabase
      .from("chat_invites")
      .insert({ chat_id: chatId, created_by: user.id })
      .select("token")
      .single();
    if (error) return toast.error(error.message);
    const link = `${window.location.origin}/invite/${data.token}`;
    setInviteLink(link);
    await navigator.clipboard.writeText(link).catch(() => {});
    toast.success("Invite link copied");
  };

  const removeMember = async (uid: string) => {
    if (!chatId) return;
    if (!confirm("Remove this member?")) return;
    const { error } = await supabase.from("chat_members").delete().eq("chat_id", chatId).eq("user_id", uid);
    if (error) return toast.error(error.message);
    setMembers((prev) => prev.filter((m) => m.user_id !== uid));
    toast.success("Removed");
  };

  const leaveChat = async () => {
    if (!chatId || !user) return;
    if (!confirm("Leave this chat?")) return;
    const { error } = await supabase.from("chat_members").delete().eq("chat_id", chatId).eq("user_id", user.id);
    if (error) return toast.error(error.message);
    setMembersOpen(false);
    navigate("/chat", { replace: true });
    await loadChats();
  };

  const renameChat = async () => {
    if (!chatId || !renameValue.trim()) return;
    const { error } = await supabase.from("chats").update({ name: renameValue.trim() }).eq("id", chatId);
    if (error) return toast.error(error.message);
    setRenameOpen(false);
    setChats((prev) => prev.map((c) => (c.id === chatId ? { ...c, name: renameValue.trim() } : c)));
    toast.success("Renamed");
  };

  if (loading || !user) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  }

  const typingNames = typingUsers
    .map((id) => profiles[id]?.username)
    .filter(Boolean) as string[];

  return (
    <div className="h-screen flex flex-col bg-background">
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-xl shrink-0">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <button
              className="md:hidden text-muted-foreground hover:text-foreground"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open chats"
            >
              <MessageCircle className="h-5 w-5" />
            </button>
            <MessageCircle className="h-5 w-5 text-primary hidden md:block" />
            <span className="font-bold gradient-text">PrintChat</span>
          </div>
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Sign out</span>
          </Button>
        </div>
      </header>

      <div className="flex-1 flex min-h-0">
        {/* Sidebar */}
        <aside
          className={cn(
            "w-72 border-r border-border/50 bg-card/30 flex flex-col shrink-0",
            "fixed md:static inset-y-0 left-0 top-[57px] md:top-auto z-20 transition-transform",
            sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
          )}
        >
          <div className="p-3 flex items-center justify-between gap-2 border-b border-border/50">
            <span className="text-sm font-semibold">Chats</span>
            <div className="flex items-center gap-1">
              <Dialog open={newChatOpen} onOpenChange={setNewChatOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="ghost" className="h-8 px-2">
                    <Plus className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>New chat</DialogTitle>
                    <DialogDescription>Create a group chat or start a DM.</DialogDescription>
                  </DialogHeader>
                  <div className="flex gap-2">
                    <Button
                      variant={newChatType === "group" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setNewChatType("group")}
                    >
                      <Users className="h-4 w-4" /> Group
                    </Button>
                    <Button
                      variant={newChatType === "dm" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setNewChatType("dm")}
                    >
                      <MessageCircle className="h-4 w-4" /> Direct
                    </Button>
                  </div>
                  {newChatType === "group" ? (
                    <div className="space-y-2">
                      <label className="text-sm text-muted-foreground">Chat name</label>
                      <Input
                        value={newChatName}
                        onChange={(e) => setNewChatName(e.target.value)}
                        placeholder="e.g. Design team"
                        onKeyDown={(e) => e.key === "Enter" && createGroupChat()}
                      />
                      <DialogFooter>
                        <Button onClick={createGroupChat}>Create</Button>
                      </DialogFooter>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <label className="text-sm text-muted-foreground">Username to DM</label>
                      <Input
                        value={dmUsername}
                        onChange={(e) => setDmUsername(e.target.value)}
                        placeholder="username"
                        onKeyDown={(e) => e.key === "Enter" && createDM()}
                      />
                      <DialogFooter>
                        <Button onClick={createDM}>Start chat</Button>
                      </DialogFooter>
                    </div>
                  )}
                </DialogContent>
              </Dialog>
              <button
                className="md:hidden text-muted-foreground hover:text-foreground p-1"
                onClick={() => setSidebarOpen(false)}
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {chats.length === 0 && (
              <div className="p-4 text-sm text-muted-foreground text-center">
                No chats yet. Create one to get started.
              </div>
            )}
            {chats.map((c) => {
              const lastRead = lastReadByChat[c.id];
              const isUnread = lastRead && new Date(c.updated_at).getTime() > new Date(lastRead).getTime() && c.id !== chatId;
              return (
                <button
                  key={c.id}
                  onClick={() => {
                    navigate(`/chat/${c.id}`);
                    setSidebarOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 hover:bg-secondary/50 text-left border-b border-border/30",
                    chatId === c.id && "bg-secondary/70"
                  )}
                >
                  <Avatar className="h-9 w-9 shrink-0">
                    <AvatarFallback className="bg-primary/20 text-primary text-xs">
                      {c.type === "dm" ? getChatName(c).slice(0, 2).toUpperCase() : (c.name ?? "G").slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className={cn("text-sm truncate", isUnread && "font-bold")}>{getChatName(c)}</span>
                      {isUnread && <span className="h-2 w-2 rounded-full bg-primary shrink-0" />}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {c.type === "dm" ? "Direct message" : "Group"}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-background/60 z-10 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main */}
        <main className="flex-1 flex flex-col min-h-0 min-w-0">
          {!chatId || !activeChat ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm px-4 text-center">
              Select a chat or create a new one to get started.
            </div>
          ) : (
            <>
              <div className="border-b border-border/50 px-4 py-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback className="bg-primary/20 text-primary text-xs">
                      {getChatName(activeChat).slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{getChatName(activeChat)}</div>
                    <div className="text-xs text-muted-foreground">
                      {members.length} member{members.length === 1 ? "" : "s"}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                {activeChat.type === "group" && user && (
                  <GamesLauncher
                    chatId={activeChat.id}
                    username={profiles[user.id]?.username ?? "Player"}
                  />
                )}
                <Dialog open={membersOpen} onOpenChange={setMembersOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline">
                      <Users className="h-4 w-4" />
                      <span className="hidden sm:inline">Members</span>
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>{getChatName(activeChat)}</DialogTitle>
                      <DialogDescription>Manage members and invites</DialogDescription>
                    </DialogHeader>

                    {activeChat.type === "group" && isAdminHere && (
                      <>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Add by username</label>
                          <div className="flex gap-2">
                            <Input
                              value={inviteUsername}
                              onChange={(e) => setInviteUsername(e.target.value)}
                              placeholder="username"
                              onKeyDown={(e) => e.key === "Enter" && addMemberByUsername()}
                            />
                            <Button onClick={addMemberByUsername} size="sm">
                              <UserPlus className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Invite link</label>
                          <div className="flex gap-2">
                            <Input value={inviteLink ?? ""} readOnly placeholder="Generate to share" />
                            <Button onClick={generateInvite} size="sm" variant="outline">
                              <Link2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </>
                    )}

                    <div className="space-y-1 max-h-60 overflow-y-auto">
                      <div className="text-sm font-medium mb-1">Members</div>
                      {members.map((m) => {
                        const p = profiles[m.user_id];
                        return (
                          <div key={m.user_id} className="flex items-center justify-between gap-2 py-1.5 px-2 rounded hover:bg-secondary/40">
                            <div className="flex items-center gap-2 min-w-0">
                              <Avatar className="h-7 w-7 shrink-0">
                                <AvatarFallback className="bg-secondary text-xs">
                                  {(p?.username ?? "?").slice(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-sm truncate">{p?.username ?? "user"}</span>
                              {m.role === "admin" && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30">
                                  admin
                                </span>
                              )}
                            </div>
                            {activeChat.type === "group" && isAdminHere && m.user_id !== user.id && (
                              <button
                                onClick={() => removeMember(m.user_id)}
                                className="text-xs text-muted-foreground hover:text-destructive"
                              >
                                Remove
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <DialogFooter className="flex-col sm:flex-row gap-2">
                      {activeChat.type === "group" && isAdminHere && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setRenameValue(activeChat.name ?? "");
                            setRenameOpen(true);
                            setMembersOpen(false);
                          }}
                        >
                          <Pencil className="h-4 w-4" /> Rename
                        </Button>
                      )}
                      {activeChat.type === "group" && (
                        <Button variant="destructive" size="sm" onClick={leaveChat}>
                          <LeaveIcon className="h-4 w-4" /> Leave chat
                        </Button>
                      )}
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                </div>
              </div>

              <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
                <div className="space-y-4 max-w-3xl mx-auto">
                  {messages.length === 0 && (
                    <p className="text-center text-muted-foreground text-sm py-12">
                      No messages yet — say hello! 👋
                    </p>
                  )}
                  {messages.map((m, idx) => {
                    const profile = profiles[m.user_id];
                    const isMine = m.user_id === user.id;
                    const name = profile?.username ?? "user";
                    const isLastMine = isMine && idx === messages.length - 1;
                    const readers = isLastMine ? readByOthers(m) : [];
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
                          {isLastMine && readers.length > 0 && (
                            <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground">
                              <Check className="h-3 w-3" />
                              <span>Seen by {readers.length === 1 ? profiles[readers[0].user_id]?.username ?? "1" : `${readers.length}`}</span>
                            </div>
                          )}
                          <div className="flex gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {(isMine || isAdminHere) && (
                              <button
                                onClick={() => deleteMessage(m.id)}
                                className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1"
                              >
                                <Trash2 className="h-3 w-3" /> Delete
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {typingNames.length > 0 && (
                    <div className="text-xs text-muted-foreground italic px-2">
                      {typingNames.join(", ")} {typingNames.length === 1 ? "is" : "are"} typing…
                    </div>
                  )}
                </div>
              </div>

              <form onSubmit={sendMessage} className="flex gap-2 p-3 border-t border-border/50 max-w-3xl mx-auto w-full">
                <Input
                  value={input}
                  onChange={(e) => onInputChange(e.target.value)}
                  placeholder="Type a message…"
                  disabled={sending}
                  maxLength={1000}
                  className="flex-1"
                />
                <Button type="submit" disabled={!input.trim() || sending}>
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </>
          )}
        </main>
      </div>

      {/* Rename dialog */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename chat</DialogTitle>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && renameChat()}
          />
          <DialogFooter>
            <Button onClick={renameChat}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ChatPage;
