import { useCallback, useEffect, useState } from "react";
import { PhoneMissed } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

interface MissedCall {
  id: string;
  kind: string;
  created_at: string;
  callerName: string;
  chatName: string;
}

const SEEN_KEY = "missedCallsSeenAt";

export const MissedCallsDialog = () => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [calls, setCalls] = useState<MissedCall[]>([]);
  const [unseen, setUnseen] = useState(0);

  const load = useCallback(async () => {
    if (!user) return;
    const { data: parts } = await sb
      .from("call_participants")
      .select("call_id, state")
      .eq("user_id", user.id)
      .in("state", ["invited", "declined"])
      .order("created_at", { ascending: false })
      .limit(50);
    const ids = (parts ?? []).map((p: { call_id: string }) => p.call_id);
    if (ids.length === 0) { setCalls([]); setUnseen(0); return; }

    const { data: rows } = await sb
      .from("calls")
      .select("id, chat_id, started_by, kind, status, created_at")
      .in("id", ids)
      .eq("status", "ended")
      .order("created_at", { ascending: false })
      .limit(30);
    const list = rows ?? [];
    if (list.length === 0) { setCalls([]); setUnseen(0); return; }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const callerIds = [...new Set(list.map((c: any) => c.started_by))];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chatIds = [...new Set(list.map((c: any) => c.chat_id))];
    const [{ data: profs }, { data: chats }] = await Promise.all([
      sb.from("profiles").select("id, username").in("id", callerIds),
      sb.from("chats").select("id, name, type").in("id", chatIds),
    ]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nameById: Record<string, string> = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p.username]));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chatById: Record<string, any> = Object.fromEntries((chats ?? []).map((c: any) => [c.id, c]));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mapped: MissedCall[] = list.map((c: any) => ({
      id: c.id,
      kind: c.kind,
      created_at: c.created_at,
      callerName: nameById[c.started_by] ?? "Someone",
      chatName: chatById[c.chat_id]?.type === "dm" ? "Direct message" : (chatById[c.chat_id]?.name ?? "Group"),
    }));
    setCalls(mapped);

    const seenAt = localStorage.getItem(SEEN_KEY);
    setUnseen(seenAt ? mapped.filter((m) => m.created_at > seenAt).length : mapped.length);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!open) return;
    load();
    localStorage.setItem(SEEN_KEY, new Date().toISOString());
    setUnseen(0);
  }, [open, load]);

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" className="h-8 px-2 relative" title="Missed calls">
          <PhoneMissed className="h-4 w-4" />
          {unseen > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] leading-4 text-center">
              {unseen > 9 ? "9+" : unseen}
            </span>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Missed calls</DialogTitle>
          <DialogDescription>Calls you did not answer.</DialogDescription>
        </DialogHeader>
        <div className="max-h-80 overflow-y-auto space-y-2">
          {calls.length === 0 && (
            <p className="text-sm text-muted-foreground">No missed calls.</p>
          )}
          {calls.map((c) => (
            <div key={c.id} className="flex items-center gap-3 rounded-md border border-border/50 p-2">
              <PhoneMissed className="h-4 w-4 text-destructive shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm truncate">{c.callerName}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {c.kind === "video" ? "Video call" : "Voice call"} · {c.chatName}
                </p>
              </div>
              <span className="text-xs text-muted-foreground shrink-0">
                {new Date(c.created_at).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};
