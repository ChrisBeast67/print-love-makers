import { useEffect, useMemo, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Shield, Ban, CheckCircle2, Coins, MessageCircle, Crown, UserCog, Trash2, Mail, Sparkles, Gift, X, Zap, PartyPopper } from "lucide-react";
import { Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useStaffRole } from "@/hooks/useStaffRole";

type Row = {
  id: string;
  username: string;
  email: string;
  balance: number;
  banned: boolean;
  roles: string[];
};

const Admin = () => {
  const { user, loading: authLoading } = useAuth();
  const { isStaff, isOwner, isActualOwner, loading: roleLoading } = useStaffRole();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [grant, setGrant] = useState<Record<string, string>>({});
  const [events, setEvents] = useState<{ id: string; name: string; type: string; luck_multiplier: number; active: boolean; created_at: string }[]>([]);
  const [newEvent, setNewEvent] = useState({ name: "", type: "custom" as string, luck: "1" });
  const [avatarItems, setAvatarItems] = useState<{ id: string; name: string; emoji: string; rarity: string }[]>([]);
  const [grantAvatar, setGrantAvatar] = useState<Record<string, string>>({});
  const [removeAvatar, setRemoveAvatar] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<"users" | "events">("users");

  useEffect(() => {
    document.title = "Admin Panel — PrintChat";
  }, []);

  useEffect(() => {
    if (authLoading || roleLoading) return;
    if (!user) navigate("/auth");
    else if (!isStaff) navigate("/");
  }, [user, isStaff, authLoading, roleLoading, navigate]);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_list_users");
    if (error) {
      toast.error(error.message);
      setRows([]);
    } else {
      setRows(
        (data ?? []).map((r: { id: string; username: string; email: string; balance: number; banned: boolean; roles: string[] | null }) => ({
          id: r.id,
          username: r.username,
          email: r.email ?? "",
          balance: r.balance ?? 0,
          banned: !!r.banned,
          roles: r.roles ?? [],
        })),
      );
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isStaff) load();
  }, [isStaff]);

  const loadEvents = useCallback(async () => {
    const { data } = await supabase.from("events").select("*").order("created_at", { ascending: false });
    setEvents((data as any[]) ?? []);
  }, []);

  const loadAvatarItems = useCallback(async () => {
    const { data } = await supabase.from("avatar_items").select("id, name, emoji, rarity").order("name");
    setAvatarItems((data as any[]) ?? []);
  }, []);

  useEffect(() => {
    if (isStaff) { loadEvents(); loadAvatarItems(); }
  }, [isStaff, loadEvents, loadAvatarItems]);

  const handleStartEvent = async () => {
    if (!newEvent.name.trim()) return toast.error("Enter event name");
    const luck = parseFloat(newEvent.luck) || 1;
    const { error } = await supabase.rpc("admin_start_event", { _name: newEvent.name.trim(), _type: newEvent.type as any, _luck_multiplier: luck });
    if (error) return toast.error(error.message);
    toast.success("Event started!");
    setNewEvent({ name: "", type: "custom", luck: "1" });
    loadEvents();
  };

  const handleEndEvent = async (id: string) => {
    const { error } = await supabase.rpc("admin_end_event", { _event_id: id });
    if (error) return toast.error(error.message);
    toast.success("Event ended");
    loadEvents();
  };

  const handleGrantAvatar = async (userId: string) => {
    const avatarId = grantAvatar[userId];
    if (!avatarId) return toast.error("Select an avatar");
    const { error } = await supabase.rpc("admin_grant_avatar", { _target: userId, _avatar_item_id: avatarId });
    if (error) return toast.error(error.message);
    toast.success("Avatar granted!");
    setGrantAvatar((g) => ({ ...g, [userId]: "" }));
  };

  const handleRemoveAvatar = async (userId: string) => {
    const avatarId = removeAvatar[userId];
    if (!avatarId) return toast.error("Select an avatar");
    const { error } = await supabase.rpc("admin_remove_avatar", { _target: userId, _avatar_item_id: avatarId });
    if (error) return toast.error(error.message);
    toast.success("Avatar removed!");
    setRemoveAvatar((g) => ({ ...g, [userId]: "" }));
  };

  const filtered = useMemo(
    () => rows.filter((r) => r.username.toLowerCase().includes(q.toLowerCase()) || r.email.toLowerCase().includes(q.toLowerCase())),
    [rows, q],
  );

  const handleGrant = async (id: string) => {
    const amount = parseInt(grant[id] || "0", 10);
    if (!amount) return toast.error("Enter an amount");
    const { error } = await supabase.rpc("admin_grant_credits", { _target: id, _amount: amount });
    if (error) return toast.error(error.message);
    toast.success(`Granted ${amount} credits`);
    setGrant((g) => ({ ...g, [id]: "" }));
    load();
  };

  const handleBan = async (id: string, banned: boolean) => {
    const { error } = banned
      ? await supabase.rpc("admin_unban_user", { _target: id })
      : await supabase.rpc("admin_ban_user", { _target: id, _reason: "Banned by staff" });
    if (error) return toast.error(error.message);
    toast.success(banned ? "Unbanned" : "Banned");
    load();
  };

  const handleRole = async (id: string, role: "moderator" | "owner", remove: boolean) => {
    const { error } = remove
      ? await supabase.rpc("admin_remove_role", { _target: id, _role: role })
      : await supabase.rpc("admin_set_role", { _target: id, _role: role });
    if (error) return toast.error(error.message);
    toast.success(`${remove ? "Removed" : "Granted"} ${role}`);
    load();
  };

  const handleDM = async (id: string) => {
    const { data, error } = await supabase.rpc("create_or_get_dm", { _other_user: id });
    if (error) return toast.error(error.message);
    navigate(`/chat/${data}`);
  };

  const handleGrantPremium = async (id: string) => {
    const { error } = await supabase.rpc("admin_grant_premium", { _target: id });
    if (error) return toast.error(error.message);
    toast.success("Premium granted! ✨");
  };

  const handleDelete = async (id: string, username: string) => {
    if (!confirm(`Permanently delete "${username}"? This wipes their account, messages, credits and inventory. This cannot be undone.`)) return;
    const { data, error } = await supabase.functions.invoke("admin-delete-user", {
      body: { user_id: id },
    });
    if (error || (data as { error?: string })?.error) {
      return toast.error((data as { error?: string })?.error || error?.message || "Delete failed");
    }
    toast.success(`Deleted ${username}`);
    load();
  };

  if (authLoading || roleLoading) return null;

  return (
    <div className="min-h-screen bg-background hi-tech-grid">
      <nav className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto flex items-center justify-between px-6 py-3">
          <Link to="/" className="flex items-center gap-2 font-bold">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <span className="font-bold gradient-text">Admin Panel</span>
            <Badge variant="outline" className="ml-2">{isOwner ? "Owner" : "Moderator"}</Badge>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant={tab === "users" ? "default" : "outline"} onClick={() => setTab("users")}>Users</Button>
            <Button size="sm" variant={tab === "events" ? "default" : "outline"} onClick={() => setTab("events")}>
              <PartyPopper className="h-4 w-4 mr-1" /> Events
            </Button>
          </div>
        </div>
      </nav>

      {tab === "users" && (
        <section className="container mx-auto px-6 py-8 max-w-5xl">
          <Input
            placeholder="Search users by username or email…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="mb-6"
          />

          {loading ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : (
            <div className="space-y-3">
              {filtered.map((r) => (
                <div
                  key={r.id}
                  className="rounded-xl border border-border bg-card p-4 flex flex-col md:flex-row md:items-center gap-3 hover:border-primary/40 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold truncate">{r.username}</span>
                      {r.roles.includes("owner") && (
                        <Badge className="gap-1"><Crown className="h-3 w-3" /> Owner</Badge>
                      )}
                      {r.roles.includes("deputy") && (
                        <Badge className="gap-1 bg-amber-600"><Crown className="h-3 w-3" /> Deputy</Badge>
                      )}
                      {r.roles.includes("moderator") && (
                        <Badge variant="secondary" className="gap-1"><UserCog className="h-3 w-3" /> Mod</Badge>
                      )}
                      {r.banned && <Badge variant="destructive">Banned</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                      <Coins className="h-3 w-3" /> {r.balance} credits
                    </div>
                    {r.email && (
                      <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Mail className="h-3 w-3" /> {r.email}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <Input
                      type="number"
                      placeholder="±credits"
                      className="w-24"
                      value={grant[r.id] ?? ""}
                      onChange={(e) => setGrant((g) => ({ ...g, [r.id]: e.target.value }))}
                    />
                    <Button size="sm" variant="outline" onClick={() => handleGrant(r.id)}>
                      <Coins className="h-4 w-4" />
                    </Button>

                    {/* Grant Avatar */}
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="outline" title="Give avatar">
                          <Gift className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader><DialogTitle>Give avatar to {r.username}</DialogTitle></DialogHeader>
                        <div className="flex gap-2 items-end">
                          <Select value={grantAvatar[r.id] ?? ""} onValueChange={(v) => setGrantAvatar((g) => ({ ...g, [r.id]: v }))}>
                            <SelectTrigger className="flex-1"><SelectValue placeholder="Select avatar…" /></SelectTrigger>
                            <SelectContent className="max-h-60">
                              {avatarItems.map((a) => (
                                <SelectItem key={a.id} value={a.id}>{a.emoji} {a.name} ({a.rarity})</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button onClick={() => handleGrantAvatar(r.id)}>Give</Button>
                        </div>
                      </DialogContent>
                    </Dialog>

                    {/* Remove Avatar */}
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="outline" title="Remove avatar">
                          <Minus className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader><DialogTitle>Remove avatar from {r.username}</DialogTitle></DialogHeader>
                        <div className="flex gap-2 items-end">
                          <Select value={removeAvatar[r.id] ?? ""} onValueChange={(v) => setRemoveAvatar((g) => ({ ...g, [r.id]: v }))}>
                            <SelectTrigger className="flex-1"><SelectValue placeholder="Select avatar…" /></SelectTrigger>
                            <SelectContent className="max-h-60">
                              {avatarItems.map((a) => (
                                <SelectItem key={a.id} value={a.id}>{a.emoji} {a.name} ({a.rarity})</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button variant="destructive" onClick={() => handleRemoveAvatar(r.id)}>Remove</Button>
                        </div>
                      </DialogContent>
                    </Dialog>

                    <Button size="sm" variant="outline" onClick={() => handleDM(r.id)}>
                      <MessageCircle className="h-4 w-4" />
                    </Button>
                    {r.id !== user?.id && (
                      <Button size="sm" variant="outline" onClick={() => handleGrantPremium(r.id)} title="Grant Premium">
                        <Crown className="h-4 w-4 text-amber-500" />
                      </Button>
                    )}
                    {r.id !== user?.id &&
                      !r.roles.includes("owner") &&
                      (!r.roles.includes("moderator") || isOwner) &&
                      (!r.roles.includes("deputy") || isOwner) && (
                        <Button
                          size="sm"
                          variant={r.banned ? "outline" : "destructive"}
                          onClick={() => handleBan(r.id, r.banned)}
                        >
                          {r.banned ? <CheckCircle2 className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
                        </Button>
                      )}
                    {(isOwner || isStaff) && r.id !== user?.id && (
                      <Button
                        size="sm"
                        variant={r.roles.includes("moderator") ? "destructive" : "secondary"}
                        onClick={() => handleRole(r.id, "moderator", r.roles.includes("moderator"))}
                      >
                        <UserCog className="h-4 w-4 mr-1" />
                        {r.roles.includes("moderator") ? "Demote" : "Mod"}
                      </Button>
                    )}
                    {isActualOwner && r.id !== user?.id && !r.roles.includes("owner") && (
                      <Button
                        size="sm"
                        variant={r.roles.includes("deputy") ? "destructive" : "outline"}
                        onClick={() => handleRole(r.id, "deputy" as any, r.roles.includes("deputy"))}
                      >
                        <Crown className="h-4 w-4 mr-1" />
                        {r.roles.includes("deputy") ? "Remove Deputy" : "Deputy"}
                      </Button>
                    )}
                    {r.id !== user?.id &&
                      !r.roles.includes("owner") &&
                      (!r.roles.includes("moderator") || isOwner) &&
                      (!r.roles.includes("deputy") || isOwner) && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDelete(r.id, r.username)}
                        title="Delete account"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              {filtered.length === 0 && (
                <p className="text-center text-muted-foreground py-8">No users match your search.</p>
              )}
            </div>
          )}
        </section>
      )}

      {tab === "events" && (
        <section className="container mx-auto px-6 py-8 max-w-3xl space-y-6">
          {/* Create event */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <h2 className="font-bold text-lg flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> Start Event</h2>
            <div className="flex flex-col sm:flex-row gap-3">
              <Input placeholder="Event name…" value={newEvent.name} onChange={(e) => setNewEvent((ev) => ({ ...ev, name: e.target.value }))} className="flex-1" />
              <Select value={newEvent.type} onValueChange={(v) => setNewEvent((ev) => ({ ...ev, type: v }))}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="easter">🐣 Easter</SelectItem>
                  <SelectItem value="christmas">🎄 Christmas</SelectItem>
                  <SelectItem value="halloween">🎃 Halloween</SelectItem>
                  <SelectItem value="luck_boost">🍀 Luck Boost</SelectItem>
                  <SelectItem value="custom">⭐ Custom</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-1">
                <Zap className="h-4 w-4 text-muted-foreground" />
                <Input type="number" placeholder="Luck x" className="w-20" value={newEvent.luck} onChange={(e) => setNewEvent((ev) => ({ ...ev, luck: e.target.value }))} />
              </div>
              <Button onClick={handleStartEvent}>Start</Button>
            </div>
          </div>

          {/* Active events */}
          <div className="space-y-3">
            <h3 className="font-semibold text-muted-foreground">Active Events</h3>
            {events.filter((e) => e.active).length === 0 && <p className="text-sm text-muted-foreground">No active events.</p>}
            {events.filter((e) => e.active).map((e) => (
              <div key={e.id} className="rounded-xl border border-primary/40 bg-card p-4 flex items-center justify-between">
                <div>
                  <span className="font-semibold">{e.name}</span>
                  <Badge variant="outline" className="ml-2">{e.type}</Badge>
                  {e.luck_multiplier > 1 && <Badge className="ml-2 gap-1"><Zap className="h-3 w-3" />{e.luck_multiplier}x luck</Badge>}
                </div>
                <Button size="sm" variant="destructive" onClick={() => handleEndEvent(e.id)}>
                  <X className="h-4 w-4 mr-1" /> End
                </Button>
              </div>
            ))}
          </div>

          {/* Past events */}
          {events.filter((e) => !e.active).length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-muted-foreground">Past Events</h3>
              {events.filter((e) => !e.active).map((e) => (
                <div key={e.id} className="rounded-xl border border-border bg-card/50 p-4 flex items-center justify-between opacity-60">
                  <div>
                    <span className="font-semibold">{e.name}</span>
                    <Badge variant="outline" className="ml-2">{e.type}</Badge>
                    {e.luck_multiplier > 1 && <Badge variant="secondary" className="ml-2">{e.luck_multiplier}x</Badge>}
                  </div>
                  <span className="text-xs text-muted-foreground">{new Date(e.created_at).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
};

export default Admin;
