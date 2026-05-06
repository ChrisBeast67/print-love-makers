import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Star, Crown, Lock, CheckCircle2, Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type Milestone = {
  id: string;
  level: number;
  name: string;
  exp_required: number;
  reward_credits: number;
  reward_avatar_id: string | null;
  is_premium: boolean;
};

const Exp = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [totalExp, setTotalExp] = useState(0);
  const [isPremium, setIsPremium] = useState(false);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [claimed, setClaimed] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(false);

  useEffect(() => {
    document.title = "EXP & Milestones — PrintChat";
  }, []);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const [expRes, msRes, claimRes] = await Promise.all([
      supabase.from("user_exp").select("total_exp, is_premium").eq("user_id", user.id).maybeSingle(),
      supabase.from("exp_milestones").select("*").order("exp_required"),
      supabase.from("user_milestone_claims").select("milestone_id").eq("user_id", user.id),
    ]);

    setTotalExp(expRes.data?.total_exp ?? 0);
    setIsPremium(expRes.data?.is_premium ?? false);
    setMilestones((msRes.data as Milestone[]) ?? []);
    setClaimed(new Set((claimRes.data ?? []).map((c: { milestone_id: string }) => c.milestone_id)));
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const handleClaim = async (id: string) => {
    const { error } = await supabase.rpc("claim_milestone", { _milestone_id: id });
    if (error) return toast.error(error.message);
    toast.success("Milestone claimed! 🎉");
    load();
  };

  const handleBuyPremium = async () => {
    setBuying(true);
    const { error } = await supabase.rpc("buy_premium");
    setBuying(false);
    if (error) return toast.error(error.message);
    toast.success("Premium unlocked! ✨");
    load();
  };

  const freeMilestones = milestones.filter((m) => !m.is_premium);
  const premiumMilestones = milestones.filter((m) => m.is_premium);

  const nextMilestone = freeMilestones.find((m) => totalExp < m.exp_required);
  const progressPercent = nextMilestone
    ? Math.min(100, (totalExp / nextMilestone.exp_required) * 100)
    : 100;

  if (authLoading || loading) return null;

  return (
    <div className="min-h-screen bg-background hi-tech-grid">
      <nav className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto flex items-center justify-between px-6 py-3">
          <Link to="/" className="flex items-center gap-2 font-bold">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <div className="flex items-center gap-2">
            <Star className="h-5 w-5 text-primary" />
            <span className="font-bold gradient-text">EXP & Milestones</span>
            {isPremium && (
              <Badge className="bg-amber-500 text-black gap-1">
                <Crown className="h-3 w-3" /> Premium
              </Badge>
            )}
          </div>
          <div />
        </div>
      </nav>

      <section className="container mx-auto px-6 py-8 max-w-3xl space-y-8">
        {/* EXP Overview */}
        <div className="rounded-2xl border border-primary/30 bg-card p-6 glow-box space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total EXP</p>
              <p className="text-4xl font-bold gradient-text">{totalExp.toLocaleString()}</p>
            </div>
            <Zap className="h-10 w-10 text-primary opacity-60" />
          </div>
          {nextMilestone && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Next: {nextMilestone.name}</span>
                <span>{totalExp.toLocaleString()} / {nextMilestone.exp_required.toLocaleString()}</span>
              </div>
              <Progress value={progressPercent} className="h-3" />
            </div>
          )}
          {!nextMilestone && freeMilestones.length > 0 && (
            <p className="text-sm text-primary font-semibold">🎉 All free milestones completed!</p>
          )}
        </div>

        {/* Premium Upsell */}
        {!isPremium && (
          <div className="rounded-2xl border border-amber-500/40 bg-gradient-to-r from-amber-500/10 to-amber-600/5 p-6 space-y-3">
            <div className="flex items-center gap-2">
              <Crown className="h-6 w-6 text-amber-500" />
              <h2 className="text-lg font-bold text-amber-400">Unlock Premium</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Premium milestones give <strong>3× more rewards</strong> at every level. 
              Buy for <strong>100,000 credits</strong> or get it granted by an admin.
            </p>
            <Button
              onClick={handleBuyPremium}
              disabled={buying}
              className="bg-amber-500 hover:bg-amber-600 text-black font-bold"
            >
              <Crown className="h-4 w-4 mr-1" /> Buy Premium — 100,000 credits
            </Button>
          </div>
        )}

        {/* Free Milestones */}
        <div className="space-y-3">
          <h2 className="font-bold text-lg flex items-center gap-2">
            <Star className="h-5 w-5 text-primary" /> Free Milestones
          </h2>
          {freeMilestones.map((ms) => {
            const isClaimed = claimed.has(ms.id);
            const canClaim = totalExp >= ms.exp_required && !isClaimed;
            const isLocked = totalExp < ms.exp_required;
            return (
              <div
                key={ms.id}
                className={`rounded-xl border p-4 flex items-center justify-between transition-colors ${
                  isClaimed
                    ? "border-primary/30 bg-primary/5 opacity-70"
                    : canClaim
                    ? "border-primary/60 bg-card glow-box"
                    : "border-border bg-card/50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                    isClaimed ? "bg-primary/20 text-primary" : isLocked ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground"
                  }`}>
                    {ms.level}
                  </div>
                  <div>
                    <p className="font-semibold">{ms.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {ms.exp_required.toLocaleString()} EXP — Reward: {ms.reward_credits.toLocaleString()} credits
                    </p>
                  </div>
                </div>
                {isClaimed ? (
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                ) : canClaim ? (
                  <Button size="sm" onClick={() => handleClaim(ms.id)}>
                    <Sparkles className="h-4 w-4 mr-1" /> Claim
                  </Button>
                ) : (
                  <Lock className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
            );
          })}
        </div>

        {/* Premium Milestones */}
        <div className="space-y-3">
          <h2 className="font-bold text-lg flex items-center gap-2">
            <Crown className="h-5 w-5 text-amber-500" /> Premium Milestones
          </h2>
          {premiumMilestones.map((ms) => {
            const isClaimed = claimed.has(ms.id);
            const canClaim = totalExp >= ms.exp_required && !isClaimed && isPremium;
            const isLocked = totalExp < ms.exp_required || !isPremium;
            return (
              <div
                key={ms.id}
                className={`rounded-xl border p-4 flex items-center justify-between transition-colors ${
                  isClaimed
                    ? "border-amber-500/30 bg-amber-500/5 opacity-70"
                    : canClaim
                    ? "border-amber-500/60 bg-card"
                    : "border-border bg-card/50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                    isClaimed ? "bg-amber-500/20 text-amber-500" : isLocked ? "bg-muted text-muted-foreground" : "bg-amber-500 text-black"
                  }`}>
                    {ms.level}
                  </div>
                  <div>
                    <p className="font-semibold">{ms.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {ms.exp_required.toLocaleString()} EXP — Reward: {ms.reward_credits.toLocaleString()} credits
                      {!isPremium && " 🔒 Premium"}
                    </p>
                  </div>
                </div>
                {isClaimed ? (
                  <CheckCircle2 className="h-5 w-5 text-amber-500" />
                ) : canClaim ? (
                  <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-black" onClick={() => handleClaim(ms.id)}>
                    <Sparkles className="h-4 w-4 mr-1" /> Claim
                  </Button>
                ) : (
                  <Lock className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};

export default Exp;