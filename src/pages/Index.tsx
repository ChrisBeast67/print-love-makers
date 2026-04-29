import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MessageCircle, Zap, Shield, Users, ShoppingBag, LogOut, BookOpen, Backpack as BackpackIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useStaffRole } from "@/hooks/useStaffRole";
import { CreateChatCard } from "@/components/hub/CreateChatCard";
import { FriendsCard } from "@/components/hub/FriendsCard";
import { CreditsCard } from "@/components/hub/CreditsCard";
import { Tutorial } from "@/components/Tutorial";

const features = [
  { icon: Zap, title: "Real-time", desc: "Messages appear instantly for everyone in the chat." },
  { icon: Shield, title: "Secure", desc: "Authenticated accounts with role-based moderation." },
  { icon: Users, title: "Friends + groups", desc: "Add friends, DM them, or invite anyone via link." },
];

const Index = () => {
  const { user, loading, signOut } = useAuth();
  const { isStaff } = useStaffRole();
  const navigate = useNavigate();
  const [showTutorial, setShowTutorial] = useState(false);

  useEffect(() => {
    document.title = "PrintChat — Hi-Tech Chat";
  }, []);

  return (
    <div className="min-h-screen bg-background hi-tech-grid">
      <nav className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto flex items-center justify-between px-6 py-3">
          <Link to="/" className="flex items-center gap-2 text-xl font-bold">
            <MessageCircle className="h-6 w-6 text-primary" />
            <span className="gradient-text">PrintChat</span>
          </Link>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => setShowTutorial(true)}>
              <BookOpen className="h-4 w-4 mr-1" /> Tutorial
            </Button>
            {user ? (
              <>
                {isStaff && (
                  <Button size="sm" variant="ghost" onClick={() => navigate("/admin")}>
                    <Shield className="h-4 w-4 mr-1" /> Admin
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => navigate("/shop")}>
                  <ShoppingBag className="h-4 w-4 mr-1" /> Shop
                </Button>
                <Button size="sm" variant="ghost" onClick={() => navigate("/backpack")}>
                  <BackpackIcon className="h-4 w-4 mr-1" /> Backpack
                </Button>
                <Button size="sm" variant="ghost" onClick={() => navigate("/chat")}>
                  Chats
                </Button>
                <Button size="sm" variant="ghost" onClick={() => signOut()}>
                  <LogOut className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                <Button size="sm" variant="ghost" onClick={() => navigate("/auth")} disabled={loading}>
                  Sign in
                </Button>
                <Button size="sm" onClick={() => navigate("/auth")} disabled={loading}>
                  Get started
                </Button>
              </>
            )}
          </div>
        </div>
      </nav>

      {user ? (
        <section className="container mx-auto px-6 py-10 max-w-6xl">
          <div className="text-center mb-8">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
              Your <span className="gradient-text glow-text">command center</span>
            </h1>
            <p className="text-muted-foreground mt-2">Create chats, manage friends, and earn credits — all from here.</p>
          </div>
          <div className="grid lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 space-y-5">
              <CreateChatCard />
              <FriendsCard />
            </div>
            <div className="space-y-5">
              <CreditsCard />
              <div className="rounded-xl border border-primary/20 bg-card p-6 glow-box">
                <h3 className="font-semibold flex items-center gap-2 mb-2">
                  <ShoppingBag className="h-4 w-4 text-primary" /> Profile shop
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Buy booster packs to roll 5 random avatars. Manage your collection in the backpack.
                </p>
                <div className="flex gap-2">
                  <Button onClick={() => navigate("/shop")} className="flex-1">Shop</Button>
                  <Button onClick={() => navigate("/backpack")} variant="secondary" className="flex-1">
                    <BackpackIcon className="h-4 w-4 mr-1" /> Backpack
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <>
          <section className="pt-24 pb-16 px-6">
            <div className="container mx-auto max-w-4xl text-center">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-card text-xs text-muted-foreground mb-6">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                Hi-tech messaging
              </div>
              <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6">
                Chat in <span className="gradient-text glow-text">real time</span>.
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
                Direct messages, group chats, friend requests, credits, and a profile-pack shop.
              </p>
              <Button size="lg" onClick={() => navigate("/auth")} className="glow-box">
                Get started
              </Button>
            </div>
          </section>

          <section className="py-12 px-6">
            <div className="container mx-auto max-w-5xl grid md:grid-cols-3 gap-5">
              {features.map((f) => (
                <div key={f.title} className="rounded-xl border border-border bg-card p-6 hover:border-primary/40 transition-colors">
                  <f.icon className="h-6 w-6 text-primary mb-4" />
                  <h3 className="font-semibold mb-2">{f.title}</h3>
                  <p className="text-sm text-muted-foreground">{f.desc}</p>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      <footer className="border-t border-border/60 py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} PrintChat
      </footer>

      {user && <Tutorial forceOpen={showTutorial} onClose={() => setShowTutorial(false)} />}
    </div>
  );
};

export default Index;
