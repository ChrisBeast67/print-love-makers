import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Shield, Ban, CheckCircle2, Coins, MessageCircle, Crown, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useStaffRole } from "@/hooks/useStaffRole";

type Row = {
  id: string;
  username: string;
  balance: number;
  banned: boolean;
  roles: string[];
};

const Admin = () => {
  const { user, loading: authLoading } = useAuth();
  const { isStaff, isOwner, loading: roleLoading } = useStaffRole();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [grant, setGrant] = useState<Record<string, string>>({});

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
        (data ?? []).map((r: { id: string; username: string; balance: number; banned: boolean; roles: string[] | null }) => ({
          id: r.id,
          username: r.username,
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

  const filtered = useMemo(
    () => rows.filter((r) => r.username.toLowerCase().includes(q.toLowerCase())),
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
        </div>
      </nav>

      <section className="container mx-auto px-6 py-8 max-w-5xl">
        <Input
          placeholder="Search users by username…"
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
                    {r.roles.includes("moderator") && (
                      <Badge variant="secondary" className="gap-1"><UserCog className="h-3 w-3" /> Mod</Badge>
                    )}
                    {r.banned && <Badge variant="destructive">Banned</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                    <Coins className="h-3 w-3" /> {r.balance} credits
                  </div>
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
                  <Button size="sm" variant="outline" onClick={() => handleDM(r.id)}>
                    <MessageCircle className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant={r.banned ? "outline" : "destructive"}
                    onClick={() => handleBan(r.id, r.banned)}
                  >
                    {r.banned ? <CheckCircle2 className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
                  </Button>
                  {isOwner && r.id !== user?.id && (
                    <Button
                      size="sm"
                      variant={r.roles.includes("moderator") ? "destructive" : "secondary"}
                      onClick={() => handleRole(r.id, "moderator", r.roles.includes("moderator"))}
                    >
                      <UserCog className="h-4 w-4 mr-1" />
                      {r.roles.includes("moderator") ? "Demote" : "Mod"}
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
    </div>
  );
};

export default Admin;
