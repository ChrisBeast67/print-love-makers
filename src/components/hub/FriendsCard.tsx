import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Search, UserPlus, MessageCircle, Check, X, Users } from "lucide-react";
import { toast } from "sonner";

interface Profile { id: string; username: string; avatar_url: string | null }
interface Friendship {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: "pending" | "accepted";
}

export const FriendsCard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Profile[]>([]);
  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});

  const load = useCallback(async () => {
    if (!user) return;
    const { data: fs } = await supabase
      .from("friendships")
      .select("*")
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);
    const list = (fs ?? []) as Friendship[];
    setFriendships(list);
    const ids = Array.from(new Set(list.flatMap((f) => [f.requester_id, f.addressee_id]).filter((id) => id !== user.id)));
    if (ids.length) {
      const { data: ps } = await supabase.from("profiles").select("id,username,avatar_url").in("id", ids);
      const map: Record<string, Profile> = {};
      (ps ?? []).forEach((p) => (map[p.id] = p as Profile));
      setProfiles((prev) => ({ ...prev, ...map }));
    }
  }, [user]);

  useEffect(() => {
    load();
    if (!user) return;
    const ch = supabase
      .channel("friendships-" + user.id)
      .on("postgres_changes", { event: "*", schema: "public", table: "friendships" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, load]);

  const doSearch = async () => {
    const term = search.trim();
    if (!term) return setResults([]);
    const { data } = await supabase
      .from("profiles")
      .select("id,username,avatar_url")
      .ilike("username", `%${term}%`)
      .limit(8);
    setResults((data ?? []).filter((p) => p.id !== user?.id) as Profile[]);
  };

  const sendRequest = async (username: string) => {
    const { error } = await supabase.rpc("send_friend_request", { _username: username });
    if (error) return toast.error(error.message);
    toast.success("Friend request sent");
    load();
  };

  const respond = async (id: string, accept: boolean) => {
    const { error } = await supabase.rpc("respond_friend_request", { _id: id, _accept: accept });
    if (error) return toast.error(error.message);
    load();
  };

  const openDm = async (otherId: string) => {
    const { data, error } = await supabase.rpc("create_or_get_dm", { _other_user: otherId });
    if (error) return toast.error(error.message);
    navigate(`/chat/${data}`);
  };

  const inviteToGroup = async (otherId: string, username: string) => {
    // Quickest UX: create a fresh group with the friend pre-added
    const { data: chatId, error } = await supabase.rpc("create_group_chat", { _name: `${username} & me` });
    if (error || !chatId) return toast.error(error?.message ?? "Failed");
    await supabase.rpc("add_member_by_username", { _chat_id: chatId, _username: username });
    toast.success("Group created with " + username);
    navigate(`/chat/${chatId}`);
    void otherId;
  };

  const incoming = friendships.filter((f) => f.status === "pending" && f.addressee_id === user?.id);
  const outgoing = friendships.filter((f) => f.status === "pending" && f.requester_id === user?.id);
  const accepted = friendships.filter((f) => f.status === "accepted");

  return (
    <Card className="p-6 glow-box border-primary/20 space-y-5">
      <div>
        <h3 className="font-semibold flex items-center gap-2 mb-3">
          <Search className="h-4 w-4 text-primary" /> Find people
        </h3>
        <div className="flex gap-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by username"
            onKeyDown={(e) => e.key === "Enter" && doSearch()}
          />
          <Button onClick={doSearch} variant="secondary">Search</Button>
        </div>
        {results.length > 0 && (
          <ul className="mt-3 space-y-2">
            {results.map((r) => (
              <li key={r.id} className="flex items-center justify-between rounded-lg border border-border/60 p-2">
                <div className="flex items-center gap-2">
                  <Avatar className="h-8 w-8"><AvatarFallback>{r.username[0]?.toUpperCase()}</AvatarFallback></Avatar>
                  <span className="text-sm font-medium">{r.username}</span>
                </div>
                <Button size="sm" onClick={() => sendRequest(r.username)}>
                  <UserPlus className="h-4 w-4 mr-1" /> Add
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {incoming.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-muted-foreground mb-2">Incoming requests</h4>
          <ul className="space-y-2">
            {incoming.map((f) => {
              const p = profiles[f.requester_id];
              return (
                <li key={f.id} className="flex items-center justify-between rounded-lg border border-border/60 p-2">
                  <span className="text-sm">{p?.username ?? "Loading…"}</span>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => respond(f.id, true)}><Check className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => respond(f.id, false)}><X className="h-4 w-4" /></Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div>
        <h4 className="text-sm font-semibold text-muted-foreground mb-2">
          Friends ({accepted.length})
        </h4>
        {accepted.length === 0 ? (
          <p className="text-xs text-muted-foreground">No friends yet — search above to add some.</p>
        ) : (
          <ul className="space-y-2">
            {accepted.map((f) => {
              const otherId = f.requester_id === user?.id ? f.addressee_id : f.requester_id;
              const p = profiles[otherId];
              if (!p) return null;
              return (
                <li key={f.id} className="flex items-center justify-between rounded-lg border border-border/60 p-2">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8"><AvatarFallback>{p.username[0]?.toUpperCase()}</AvatarFallback></Avatar>
                    <span className="text-sm font-medium">{p.username}</span>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => openDm(otherId)} title="Direct message">
                      <MessageCircle className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => inviteToGroup(otherId, p.username)} title="Invite to new group">
                      <Users className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {outgoing.length > 0 && (
        <p className="text-xs text-muted-foreground">{outgoing.length} pending sent request(s)</p>
      )}
    </Card>
  );
};
