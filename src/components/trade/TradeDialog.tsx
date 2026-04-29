import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeftRight, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface TradeDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  chatId: string;
  members: { user_id: string; username: string }[];
}

interface AvatarItem {
  id: string;
  name: string;
  emoji: string;
  rarity: "common" | "rare" | "epic" | "legendary";
  accent_hsl: string;
}

const rarityColor: Record<AvatarItem["rarity"], string> = {
  common: "border-slate-400",
  rare: "border-blue-400",
  epic: "border-violet-400",
  legendary: "border-amber-400",
};

export const TradeDialog = ({ open, onOpenChange, chatId, members }: TradeDialogProps) => {
  const { user } = useAuth();
  const [step, setStep] = useState<"pick-target" | "build">("pick-target");
  const [target, setTarget] = useState<{ user_id: string; username: string } | null>(null);
  const [myItems, setMyItems] = useState<AvatarItem[]>([]);
  const [theirItems, setTheirItems] = useState<AvatarItem[]>([]);
  const [offeredAvatar, setOfferedAvatar] = useState<string | null>(null);
  const [requestedAvatar, setRequestedAvatar] = useState<string | null>(null);
  const [offeredCredits, setOfferedCredits] = useState(0);
  const [requestedCredits, setRequestedCredits] = useState(0);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setStep("pick-target");
    setTarget(null);
    setOfferedAvatar(null);
    setRequestedAvatar(null);
    setOfferedCredits(0);
    setRequestedCredits(0);
  };

  useEffect(() => {
    if (!open) reset();
  }, [open]);

  const loadInventories = useCallback(
    async (otherId: string) => {
      if (!user) return;
      const [mine, theirs] = await Promise.all([
        supabase
          .from("user_avatars")
          .select("avatar_item_id, avatar_items(*)")
          .eq("user_id", user.id),
        supabase
          .from("user_avatars")
          .select("avatar_item_id, avatar_items(*)")
          .eq("user_id", otherId),
      ]);
      setMyItems(((mine.data ?? []) as { avatar_items: AvatarItem }[]).map((r) => r.avatar_items).filter(Boolean));
      setTheirItems(((theirs.data ?? []) as { avatar_items: AvatarItem }[]).map((r) => r.avatar_items).filter(Boolean));
    },
    [user],
  );

  const pickTarget = (m: { user_id: string; username: string }) => {
    setTarget(m);
    loadInventories(m.user_id);
    setStep("build");
  };

  const submit = async () => {
    if (!target) return;
    if (!offeredAvatar && offeredCredits <= 0) {
      toast.error("Offer at least an avatar or some credits");
      return;
    }
    if (!requestedAvatar && requestedCredits <= 0) {
      toast.error("Request at least an avatar or some credits");
      return;
    }
    setBusy(true);
    const { error } = await supabase.rpc("create_trade_offer", {
      _chat_id: chatId,
      _to_user: target.user_id,
      _offered_avatar: offeredAvatar,
      _offered_credits: offeredCredits,
      _requested_avatar: requestedAvatar,
      _requested_credits: requestedCredits,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`Trade offer sent to ${target.username}`);
    onOpenChange(false);
  };

  const otherMembers = members.filter((m) => m.user_id !== user?.id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5" /> Trade in this chat
          </DialogTitle>
          <DialogDescription>
            {step === "pick-target"
              ? "Pick someone to trade with."
              : `Trading with ${target?.username}`}
          </DialogDescription>
        </DialogHeader>

        {step === "pick-target" ? (
          <ScrollArea className="max-h-72">
            <div className="space-y-2">
              {otherMembers.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No one else is in this chat yet.
                </p>
              )}
              {otherMembers.map((m) => (
                <button
                  key={m.user_id}
                  onClick={() => pickTarget(m)}
                  className="w-full text-left px-4 py-3 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition"
                >
                  {m.username}
                </button>
              ))}
            </div>
          </ScrollArea>
        ) : (
          <div className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <TradeSide
                title="You give"
                items={myItems}
                selected={offeredAvatar}
                onSelect={setOfferedAvatar}
                credits={offeredCredits}
                onCredits={setOfferedCredits}
              />
              <TradeSide
                title={`${target?.username} gives`}
                items={theirItems}
                selected={requestedAvatar}
                onSelect={setRequestedAvatar}
                credits={requestedCredits}
                onCredits={setRequestedCredits}
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("pick-target")} className="flex-1">
                Back
              </Button>
              <Button onClick={submit} disabled={busy} className="flex-1">
                Send offer
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

const TradeSide = ({
  title,
  items,
  selected,
  onSelect,
  credits,
  onCredits,
}: {
  title: string;
  items: AvatarItem[];
  selected: string | null;
  onSelect: (id: string | null) => void;
  credits: number;
  onCredits: (n: number) => void;
}) => (
  <div className="rounded-lg border border-border p-3">
    <h4 className="font-semibold text-sm mb-2">{title}</h4>
    <ScrollArea className="h-40 mb-2">
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-6">No avatars</p>
      ) : (
        <div className="grid grid-cols-3 gap-1.5">
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => onSelect(selected === item.id ? null : item.id)}
              className={cn(
                "aspect-square rounded border-2 flex flex-col items-center justify-center text-xs transition relative",
                rarityColor[item.rarity],
                selected === item.id ? "ring-2 ring-primary scale-95" : "opacity-80 hover:opacity-100",
              )}
              title={`${item.name} (${item.rarity})`}
            >
              <span className="text-2xl">{item.emoji}</span>
            </button>
          ))}
        </div>
      )}
    </ScrollArea>
    <div className="flex items-center gap-2">
      <label className="text-xs text-muted-foreground shrink-0">+ credits</label>
      <Input
        type="number"
        min={0}
        value={credits || ""}
        onChange={(e) => onCredits(Math.max(0, parseInt(e.target.value || "0", 10)))}
        placeholder="0"
        className="h-8"
      />
      {selected && (
        <Button size="sm" variant="ghost" onClick={() => onSelect(null)}>
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  </div>
);
