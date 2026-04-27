import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCredits } from "@/hooks/useCredits";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Coins, Check, ArrowLeft, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Pack {
  id: string;
  slug: string;
  name: string;
  theme: "robot" | "animal" | "circus" | "underwater";
  rarity: "common" | "rare" | "epic" | "legendary";
  price: number;
  accent_hsl: string;
  emoji: string;
}

const rarityStyles: Record<Pack["rarity"], string> = {
  common: "border-slate-300 text-slate-600",
  rare: "border-blue-400 text-blue-600",
  epic: "border-violet-400 text-violet-600",
  legendary: "border-amber-400 text-amber-600",
};

const themeLabels: Record<Pack["theme"], string> = {
  robot: "Robot",
  animal: "Animal",
  circus: "Circus",
  underwater: "Underwater",
};

const Shop = () => {
  const { user, loading } = useAuth();
  const { balance, refresh } = useCredits();
  const navigate = useNavigate();
  const [packs, setPacks] = useState<Pack[]>([]);
  const [owned, setOwned] = useState<Set<string>>(new Set());
  const [equipped, setEquipped] = useState<string | null>(null);
  const [filter, setFilter] = useState<Pack["theme"] | "all">("all");

  const load = useCallback(async () => {
    const { data: ps } = await supabase.from("profile_packs").select("*").order("price");
    setPacks((ps ?? []) as Pack[]);
    if (user) {
      const { data: up } = await supabase.from("user_packs").select("pack_id").eq("user_id", user.id);
      setOwned(new Set((up ?? []).map((u) => u.pack_id)));
      const { data: prof } = await supabase
        .from("profiles")
        .select("equipped_pack_id")
        .eq("id", user.id)
        .maybeSingle();
      setEquipped(prof?.equipped_pack_id ?? null);
    }
  }, [user]);

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [user, loading, navigate]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    document.title = "Shop — PrintChat";
  }, []);

  const buy = async (pack: Pack) => {
    const { error } = await supabase.rpc("purchase_pack", { _pack_id: pack.id });
    if (error) return toast.error(error.message);
    toast.success(`Unlocked ${pack.name}!`);
    refresh();
    load();
  };

  const equip = async (packId: string | null) => {
    if (!user) return;
    const { error } = await supabase
      .from("profiles")
      .update({ equipped_pack_id: packId })
      .eq("id", user.id);
    if (error) return toast.error(error.message);
    setEquipped(packId);
    toast.success(packId ? "Equipped!" : "Unequipped");
  };

  const filtered = filter === "all" ? packs : packs.filter((p) => p.theme === filter);

  return (
    <div className="min-h-screen bg-background hi-tech-grid">
      <div className="container mx-auto px-6 py-8 max-w-6xl">
        <div className="flex items-center justify-between mb-8">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-card border border-primary/20 glow-box">
            <Coins className="h-4 w-4 text-primary" />
            <span className="font-bold">{balance}</span>
          </div>
        </div>

        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold gradient-text glow-text">Profile Packs</h1>
          <p className="text-muted-foreground mt-2">Spend credits, equip a look. Higher rarity = rarer drip.</p>
        </div>

        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {(["all","robot","animal","circus","underwater"] as const).map((t) => (
            <Button
              key={t}
              variant={filter === t ? "default" : "secondary"}
              size="sm"
              onClick={() => setFilter(t)}
            >
              {t === "all" ? "All" : themeLabels[t]}
            </Button>
          ))}
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {filtered.map((p) => {
            const isOwned = owned.has(p.id);
            const isEquipped = equipped === p.id;
            return (
              <Card
                key={p.id}
                className={cn(
                  "p-5 border-2 transition-all hover:-translate-y-1",
                  rarityStyles[p.rarity],
                  isEquipped && "ring-2 ring-primary",
                )}
                style={{ background: `linear-gradient(135deg, hsl(${p.accent_hsl} / 0.08), transparent)` }}
              >
                <div className="text-5xl mb-3 text-center">{p.emoji}</div>
                <div className="text-xs uppercase tracking-wider mb-1 font-semibold">{p.rarity}</div>
                <h3 className="font-bold">{p.name}</h3>
                <p className="text-xs text-muted-foreground mb-4">{themeLabels[p.theme]} pack</p>
                {isOwned ? (
                  <Button
                    className="w-full"
                    variant={isEquipped ? "secondary" : "default"}
                    onClick={() => equip(isEquipped ? null : p.id)}
                  >
                    {isEquipped ? <><Check className="h-4 w-4 mr-1" /> Equipped</> : "Equip"}
                  </Button>
                ) : (
                  <Button className="w-full" onClick={() => buy(p)} disabled={balance < p.price}>
                    <Sparkles className="h-4 w-4 mr-1" /> {p.price}
                  </Button>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Shop;
