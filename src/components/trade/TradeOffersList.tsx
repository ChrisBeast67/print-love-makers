import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowRight, Coins } from "lucide-react";
import { toast } from "sonner";

interface AvatarItem {
  id: string;
  name: string;
  emoji: string;
  rarity: string;
}

interface Offer {
  id: string;
  from_user: string;
  to_user: string;
  offered_avatar_id: string | null;
  offered_credits: number;
  requested_avatar_id: string | null;
  requested_credits: number;
  status: string;
  created_at: string;
}

interface Props {
  chatId: string;
  usernames: Record<string, string>;
}

export const TradeOffersList = ({ chatId, usernames }: Props) => {
  const { user } = useAuth();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [items, setItems] = useState<Record<string, AvatarItem>>({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("trade_offers")
      .select("*")
      .eq("chat_id", chatId)
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    const list = (data ?? []) as Offer[];
    setOffers(list);
    const ids = Array.from(
      new Set(list.flatMap((o) => [o.offered_avatar_id, o.requested_avatar_id]).filter(Boolean) as string[]),
    );
    if (ids.length) {
      const { data: ai } = await supabase.from("avatar_items").select("id,name,emoji,rarity").in("id", ids);
      const map: Record<string, AvatarItem> = {};
      ((ai ?? []) as AvatarItem[]).forEach((it) => (map[it.id] = it));
      setItems(map);
    } else {
      setItems({});
    }
  }, [chatId]);

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`trades-${chatId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "trade_offers", filter: `chat_id=eq.${chatId}` },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [chatId, load]);

  const accept = async (id: string) => {
    setBusy(true);
    const { error } = await supabase.rpc("accept_trade_offer", { _id: id });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Trade complete!");
    load();
  };
  const decline = async (id: string) => {
    setBusy(true);
    const { error } = await supabase.rpc("decline_trade_offer", { _id: id });
    setBusy(false);
    if (error) return toast.error(error.message);
    load();
  };
  const cancel = async (id: string) => {
    setBusy(true);
    const { error } = await supabase.rpc("cancel_trade_offer", { _id: id });
    setBusy(false);
    if (error) return toast.error(error.message);
    load();
  };

  if (offers.length === 0) return null;

  return (
    <div className="border-b border-border bg-card/40 px-4 py-2 space-y-2">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">Pending trades</p>
      {offers.map((o) => {
        const fromMe = o.from_user === user?.id;
        const toMe = o.to_user === user?.id;
        const offered = o.offered_avatar_id ? items[o.offered_avatar_id] : null;
        const requested = o.requested_avatar_id ? items[o.requested_avatar_id] : null;
        return (
          <Card key={o.id} className="p-3 flex items-center gap-3 flex-wrap text-sm">
            <span className="font-medium">{usernames[o.from_user] ?? "user"}</span>
            <Stake item={offered} credits={o.offered_credits} />
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            <Stake item={requested} credits={o.requested_credits} />
            <span className="font-medium">{usernames[o.to_user] ?? "user"}</span>
            <div className="ml-auto flex gap-2">
              {toMe && (
                <>
                  <Button size="sm" disabled={busy} onClick={() => accept(o.id)}>
                    Accept
                  </Button>
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => decline(o.id)}>
                    Decline
                  </Button>
                </>
              )}
              {fromMe && (
                <Button size="sm" variant="outline" disabled={busy} onClick={() => cancel(o.id)}>
                  Cancel
                </Button>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
};

const Stake = ({ item, credits }: { item: AvatarItem | null; credits: number }) => (
  <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-secondary/60">
    {item && (
      <>
        <span className="text-lg">{item.emoji}</span>
        <span className="text-xs">{item.name}</span>
      </>
    )}
    {credits > 0 && (
      <>
        {item && <span className="text-muted-foreground">+</span>}
        <Coins className="h-3 w-3 text-primary" />
        <span className="text-xs font-semibold">{credits}</span>
      </>
    )}
    {!item && credits === 0 && <span className="text-xs text-muted-foreground">nothing</span>}
  </span>
);
