import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCredits } from "@/hooks/useCredits";
import { useStaffRole } from "@/hooks/useStaffRole";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Coins, ArrowLeft, Check, ShoppingBag, Upload } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface AvatarItem {
  id: string;
  slug: string;
  name: string;
  theme: string;
  rarity: "common" | "rare" | "epic" | "legendary" | "mythic" | "secret";
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
  mythic: "border-pink-500",
  secret: "border-fuchsia-500",
};

const rarityLabel: Record<AvatarItem["rarity"], string> = {
  common: "Common",
  rare: "Rare",
  epic: "Epic",
  legendary: "Legendary",
  mythic: "✦ MYTHIC ✦",
  secret: "❂ SECRET ❂",
};

const sellPrice = (r: AvatarItem["rarity"]) =>
  ({ common: 15, rare: 50, epic: 200, legendary: 750, mythic: 3000, secret: 0 }[r]);

const rarityOrder = { secret: -1, mythic: 0, legendary: 1, epic: 2, rare: 3, common: 4 } as const;

const THEME_OPTIONS: { value: string; label: string }[] = [
  { value: "robot", label: "Robot" },
  { value: "animal", label: "Animal" },
  { value: "circus", label: "Circus" },
  { value: "underwater", label: "Underwater" },
];

const RARITY_OPTIONS: { value: AvatarItem["rarity"]; label: string }[] = [
  { value: "common", label: "Common" },
  { value: "rare", label: "Rare" },
  { value: "epic", label: "Epic" },
  { value: "legendary", label: "Legendary" },
  { value: "mythic", label: "✦ Mythic ✦" },
];

const Backpack = () => {
  const { user, loading } = useAuth();
  const { balance, refresh } = useCredits();
  const { isDeputy, loading: roleLoading } = useStaffRole();
  const navigate = useNavigate();
  const [items, setItems] = useState<AvatarItem[]>([]);
  const [owned, setOwned] = useState<Record<string, number>>({});
  const [equipped, setEquipped] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | AvatarItem["theme"]>("all");
  const [busy, setBusy] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadName, setUploadName] = useState("");
  const [uploadEmoji, setUploadEmoji] = useState("");
  const [uploadTheme, setUploadTheme] = useState<string>("robot");
  const [uploadRarity, setUploadRarity] = useState<AvatarItem["rarity"]>("common");
  const [uploadColor, setUploadColor] = useState("#14b8a6");
  const [uploading, setUploading] = useState(false);

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

  const handleUploadCustom = async () => {
    if (!uploadName.trim() || !uploadEmoji.trim()) {
      toast.error("Name and emoji are required");
      return;
    }
    setUploading(true);
    const hsl = hexToHsl(uploadColor);
    const { error } = await supabase.rpc("insert_custom_avatar" as any, {
      _name: uploadName.trim(),
      _emoji: uploadEmoji.trim(),
      _theme: uploadTheme,
      _rarity: uploadRarity,
      _accent_hsl: hsl,
    });
    setUploading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Custom avatar uploaded!");
    setUploadOpen(false);
    setUploadName("");
    setUploadEmoji("");
    setUploadTheme("robot");
    setUploadRarity("common");
    setUploadColor("#14b8a6");
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
            {isDeputy && (
              <Button variant="secondary" size="sm" onClick={() => setUploadOpen(true)}>
                <Upload className="h-4 w-4 mr-1" /> Upload Custom
              </Button>
            )}
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
                    {item.rarity === "secret" ? (
                      <p className="text-center text-[11px] text-fuchsia-400 font-semibold">
                        Exclusive · cannot be sold or traded
                      </p>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        disabled={busy}
                        onClick={() => sell(item)}
                      >
                        Sell · +{sellPrice(item.rarity)}
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="gradient-text">Upload Custom Avatar</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium mb-1 block">Emoji</label>
              <input
                type="text"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-lg text-center"
                placeholder="😸"
                value={uploadEmoji}
                onChange={(e) => setUploadEmoji(e.target.value.slice(0, 4))}
                maxLength={4}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Name</label>
              <input
                type="text"
                className="w-full rounded-md border border-input bg-background px-3 py-2"
                placeholder="Cool Cat"
                value={uploadName}
                onChange={(e) => setUploadName(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Theme</label>
                <Select value={uploadTheme} onValueChange={setUploadTheme}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {THEME_OPTIONS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Rarity</label>
                <Select value={uploadRarity} onValueChange={(v) => setUploadRarity(v as AvatarItem["rarity"])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RARITY_OPTIONS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Accent Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  className="w-12 h-10 rounded border border-input cursor-pointer"
                  value={uploadColor}
                  onChange={(e) => setUploadColor(e.target.value)}
                />
                <input
                  type="text"
                  className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={uploadColor}
                  onChange={(e) => setUploadColor(e.target.value)}
                  placeholder="#14b8a6"
                />
              </div>
            </div>
            <Button className="w-full" onClick={handleUploadCustom} disabled={uploading}>
              {uploading ? "Uploading…" : "Upload Avatar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Backpack;

function hexToHsl(hex: string): string {
  let r = 0, g = 0, b = 0;
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return "180 80% 50%";
  r = parseInt(m[1], 16) / 255; g = parseInt(m[2], 16) / 255; b = parseInt(m[3], 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}
