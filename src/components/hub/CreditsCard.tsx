import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCredits } from "@/hooks/useCredits";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Coins, Gift } from "lucide-react";
import { toast } from "sonner";

export const CreditsCard = () => {
  const { user } = useAuth();
  const { balance, refresh } = useCredits();
  const [claimedToday, setClaimedToday] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      if (!user) return;
      const { data } = await supabase
        .from("daily_claims")
        .select("last_claim_date")
        .eq("user_id", user.id)
        .maybeSingle();
      const today = new Date().toISOString().slice(0, 10);
      setClaimedToday(data?.last_claim_date === today);
    })();
  }, [user]);

  const claim = async () => {
    setBusy(true);
    const { data, error } = await supabase.rpc("claim_daily_credits");
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`+${data} credits`);
    setClaimedToday(true);
    refresh();
  };

  return (
    <Card className="p-6 glow-box border-primary/20">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold flex items-center gap-2">
          <Coins className="h-4 w-4 text-primary" /> Credits
        </h3>
        <span className="text-2xl font-bold gradient-text">{balance}</span>
      </div>
      <Button onClick={claim} disabled={claimedToday || busy} className="w-full">
        <Gift className="h-4 w-4 mr-2" />
        {claimedToday ? "Claimed today ✓" : "Claim daily +50"}
      </Button>
      <p className="text-xs text-muted-foreground mt-2">
        Earn more by winning mini-games (coming soon).
      </p>
    </Card>
  );
};
