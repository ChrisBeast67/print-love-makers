import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCredits } from "@/hooks/useCredits";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Coins, ArrowLeft, Sparkles, Backpack as BackpackIcon } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Pack {
  id: string;
  slug: string;
  name: string;
  theme: "robot" | "animal" | "circus" | "underwater";
  price: number;
  accent_hsl: string;
  emoji: string;
}

interface PullResult {
  avatar_item_id: string;
  name: string;
  emoji: string;
  rarity: "common" | "rare" | "epic" | "legendary";
  accent_hsl: string;
  is_new: boolean;
}

const rarityClass: Record<PullResult["rarity"], string> = {
  common: "border-slate-400 from-slate-500/10",
  rare: "border-blue-400 from-blue-500/20",
  epic: "border-violet-400 from-violet-500/25 shadow-[0_0_20px_-4px_hsl(270_80%_60%/0.6)]",
  legendary:
    "border-amber-400 from-amber-500/30 shadow-[0_0_30px_-4px_hsl(45_100%_60%/0.8)] animate-pulse",
};

const rarityLabel: Record<PullResult["rarity"], string> = {
  common: "Common",
  rare: "Rare",
  epic: "Epic",
  legendary: "Legendary",
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
  const [opening, setOpening] = useState(false);
  const [pulls, setPulls] = useState<PullResult[] | null>(null);
  const [revealedCount, setRevealedCount] = useState(0);

  const load = useCallback(async () => {
    const { data: ps } = await supabase.from("profile_packs").select("*").order("name");
    setPacks((ps ?? []) as Pack[]);
  }, []);

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [user, loading, navigate]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    document.title = "Shop — PrintChat";
  }, []);

  const openPack = async (pack: Pack) => {
    if (balance < pack.price) {
      toast.error("Not enough credits");
      return;
    }
    setOpening(true);
    const { data, error } = await supabase.rpc("open_pack", { _pack_id: pack.id });
    setOpening(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setPulls(data as PullResult[]);
    setRevealedCount(0);
    refresh();
    // Auto-reveal one card per ~500ms
    const total = (data as PullResult[]).length;
    let i = 0;
    const tick = () => {
      i += 1;
      setRevealedCount(i);
      if (i < total) setTimeout(tick, 500);
    };
    setTimeout(tick, 400);
  };

  const closePulls = () => {
    setPulls(null);
    setRevealedCount(0);
  };

  return (
    <div className="min-h-screen bg-background hi-tech-grid">
      <div className="container mx-auto px-6 py-8 max-w-6xl">
        <div className="flex items-center justify-between mb-8 gap-3 flex-wrap">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => navigate("/backpack")}>
              <BackpackIcon className="h-4 w-4 mr-1" /> Backpack
            </Button>
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-card border border-primary/20 glow-box">
              <Coins className="h-4 w-4 text-primary" />
              <span className="font-bold">{balance}</span>
              <span className="text-xs text-muted-foreground">credits</span>
            </div>
          </div>
        </div>

        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold gradient-text glow-text">Booster Packs</h1>
          <p className="text-muted-foreground mt-2">
            Open a pack to get <span className="text-foreground font-semibold">5 random avatars</span> from a theme.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Drop rates — Common 60% · Rare 25% · Epic 12% · Legendary 3%
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {packs.map((p) => (
            <Card
              key={p.id}
              className="p-6 border-2 border-primary/20 transition-all hover:-translate-y-1 hover:border-primary/60 glow-box"
              style={{ background: `linear-gradient(135deg, hsl(${p.accent_hsl} / 0.15), transparent)` }}
            >
              <div className="text-6xl mb-3 text-center drop-shadow-lg">{p.emoji}</div>
              <h3 className="font-bold text-center">{themeLabels[p.theme]}</h3>
              <p className="text-xs text-muted-foreground text-center mb-4">5 random avatars</p>
              <Button
                className="w-full"
                onClick={() => openPack(p)}
                disabled={opening || balance < p.price}
              >
                <Sparkles className="h-4 w-4 mr-1" /> Open · {p.price}
              </Button>
            </Card>
          ))}
        </div>
      </div>

      <Dialog open={!!pulls} onOpenChange={(o) => !o && closePulls()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-center text-2xl gradient-text">Pack opened!</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-5 gap-3 py-4">
            {pulls?.map((pull, idx) => {
              const revealed = idx < revealedCount;
              return (
                <div
                  key={idx}
                  className={cn(
                    "aspect-[3/4] rounded-lg border-2 flex flex-col items-center justify-center p-2 text-center transition-all duration-500 bg-gradient-to-br to-transparent",
                    revealed ? rarityClass[pull.rarity] : "border-primary/20 bg-card",
                    revealed ? "scale-100 opacity-100" : "scale-90 opacity-60",
                  )}
                  style={
                    revealed
                      ? { boxShadow: `0 0 20px -8px hsl(${pull.accent_hsl} / 0.8)` }
                      : undefined
                  }
                >
                  {revealed ? (
                    <>
                      <div className="text-4xl mb-1">{pull.emoji}</div>
                      <div className="text-[10px] uppercase tracking-wider font-bold">
                        {rarityLabel[pull.rarity]}
                      </div>
                      <div className="text-xs font-medium truncate w-full">{pull.name}</div>
                      {pull.is_new && (
                        <div className="text-[9px] mt-1 px-1.5 py-0.5 rounded bg-primary text-primary-foreground">
                          NEW
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-3xl opacity-30">?</div>
                  )}
                </div>
              );
            })}
          </div>
          <Button onClick={closePulls} className="w-full">
            Awesome
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Shop;
