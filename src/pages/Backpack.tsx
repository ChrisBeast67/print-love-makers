import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCredits } from "@/hooks/useCredits";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Coins, ArrowLeft, Check, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface AvatarItem {
  id: string;
  slug: string;
  name: string;
  theme: string;
  rarity: "common" | "rare" | "epic" | "legendary";
  emoji: string;
  accent_hsl: string;
}

interface OwnedRow {
  avatar_item_id: string;
  quantity: number;
}

const rarityRing: Record<AvatarItem["rarity"], string> = {
  common: "border-slate-400",
  rare: "border-blue-400",
  epic: "border-violet-400",
  legendary: "border-amber-400",
};

const rarityLabel: Record<AvatarItem["rarity"], string> = {
  common: "Common",
  rare: "Rare",
  epic: "Epic",
  legendary: "Legendary",
};

const sellPrice = (r: AvatarItem["rarity"]) =>
  ({ common: 15, rare: 50, epic: 200, legendary: 750 }[r]);

const rarityOrder = { legendary: 0, epic: 1, rare: 2, common: 3 } as const;

const Backpack = () => {
  const { user, loading } = useAuth();
  const { balance, refresh } = useCredits();
  const navigate = useNavigate();
  const [items, setItems] = useState<AvatarItem[]>([]);
  const [owned, setOwned] = useState<Record<string, number>>({});
  const [equipped, setEquipped] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | AvatarItem["theme"]>("all");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const [{ data: catalog }, { data: mine }, { data: prof }] = await Promise.all([
      supabase.from("avatar_items").select("*"),
      supabase.from("user_avatars").select("avatar_item_id, quantity").eq("user_id", user.id),
      supabase.from("profiles").select("equipped_avatar_id").eq("id", user.id).maybeSingle(),
    ]);
    setItems((catalog ?? []) as AvatarItem[]);
    const map: Record<string, number> = {};
    ((mine ?? []) as OwnedRow[]).forEach((r) => (map[r.avatar_item_id] = r.quantity));
    setOwned(map);
    setEquipped(prof?.equipped_avatar_id ?? null);
  }, [user]);

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [user, loading, navigate]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    document.title = "Backpack — PrintChat";
  }, []);

  const equip = async (id: string | null) => {
    setBusy(true);
    const { error } = id
      ? await supabase.rpc("equip_avatar", { _avatar_item_id: id })
      : await supabase.rpc("unequip_avatar");
    setBusy(false);
    if (error) return toast.error(error.message);
    setEquipped(id);
    toast.success(id ? "Equipped!" : "Unequipped");
  };

  const sell = async (item: AvatarItem) => {
    const owns = owned[item.id] ?? 0;
    if (equipped === item.id && owns <= 1) {
      const ok = confirm(`This is your only ${item.name} and it's equipped. Sell anyway?`);
      if (!ok) return;
    }
    setBusy(true);
    const { data, error } = await supabase.rpc("sell_avatar", { _avatar_item_id: item.id });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`Sold for +${data} credits`);
    refresh();
    load();
  };

  const ownedItems = items
    .filter((i) => (owned[i.id] ?? 0) > 0)
    .filter((i) => filter === "all" || i.theme === filter)
    .sort((a, b) => rarityOrder[a.rarity] - rarityOrder[b.rarity]);

  const themes = Array.from(new Set(items.map((i) => i.theme)));

  return (
    <div className="min-h-screen bg-background hi-tech-grid">
      <div className="container mx-auto px-6 py-8 max-w-6xl">
        <div className="flex items-center justify-between mb-8 gap-3 flex-wrap">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => navigate("/shop")}>
              <ShoppingBag className="h-4 w-4 mr-1" /> Shop
            </Button>
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-card border border-primary/20 glow-box">
              <Coins className="h-4 w-4 text-primary" />
              <span className="font-bold">{balance}</span>
              <span className="text-xs text-muted-foreground">credits</span>
            </div>
          </div>
        </div>

        <div className="text-center mb-6">
          <h1 className="text-4xl font-bold gradient-text glow-text">Your Backpack</h1>
          <p className="text-muted-foreground mt-2">
            {ownedItems.length} unique avatar{ownedItems.length === 1 ? "" : "s"} · Equip, sell, or trade in chats.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Sell value — Common 15 · Rare 50 · Epic 200 · Legendary 750
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-2 mb-6">
          <Button size="sm" variant={filter === "all" ? "default" : "secondary"} onClick={() => setFilter("all")}>
            All
          </Button>
          {themes.map((t) => (
            <Button
              key={t}
              size="sm"
              variant={filter === t ? "default" : "secondary"}
              onClick={() => setFilter(t as typeof filter)}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Button>
          ))}
        </div>

        {ownedItems.length === 0 ? (
          <Card className="p-12 text-center">
            <p className="text-muted-foreground mb-4">Your backpack is empty. Open some packs!</p>
            <Button onClick={() => navigate("/shop")}>
              <ShoppingBag className="h-4 w-4 mr-2" /> Go to Shop
            </Button>
          </Card>
        ) : (
          <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {ownedItems.map((item) => {
              const qty = owned[item.id] ?? 0;
              const isEquipped = equipped === item.id;
              return (
                <Card
                  key={item.id}
                  className={cn(
                    "p-4 border-2 transition-all hover:-translate-y-1",
                    rarityRing[item.rarity],
                    isEquipped && "ring-2 ring-primary",
                  )}
                  style={{
                    background: `linear-gradient(135deg, hsl(${item.accent_hsl} / 0.12), transparent)`,
                  }}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="text-[10px] uppercase font-bold tracking-wider">
                      {rarityLabel[item.rarity]}
                    </div>
                    {qty > 1 && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary font-bold">
                        ×{qty}
                      </span>
                    )}
                  </div>
                  <div className="text-5xl text-center my-3">{item.emoji}</div>
                  <h3 className="font-bold text-center text-sm">{item.name}</h3>
                  <p className="text-xs text-muted-foreground text-center capitalize mb-3">{item.theme}</p>
                  <div className="space-y-2">
                    <Button
                      size="sm"
                      className="w-full"
                      variant={isEquipped ? "secondary" : "default"}
                      disabled={busy}
                      onClick={() => equip(isEquipped ? null : item.id)}
                    >
                      {isEquipped ? (
                        <>
                          <Check className="h-3 w-3 mr-1" /> Equipped
                        </>
                      ) : (
                        "Equip"
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      disabled={busy}
                      onClick={() => sell(item)}
                    >
                      Sell · +{sellPrice(item.rarity)}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Backpack;
