import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MessageCircle, Zap, Shield, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

const features = [
  { icon: Zap, title: "Real-time", desc: "Messages appear instantly for everyone in the room." },
  { icon: Shield, title: "Secure", desc: "Authenticated accounts with role-based moderation." },
  { icon: Users, title: "Community", desc: "Chat with anyone who joins — no rooms, just one global channel." },
];

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "PrintChat — Real-time Chat";
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2 text-xl font-bold">
            <MessageCircle className="h-6 w-6 text-primary" />
            <span className="gradient-text">PrintChat</span>
          </Link>
          <div className="flex items-center gap-3">
            {user ? (
              <Button size="sm" onClick={() => navigate("/chat")}>Open chat</Button>
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

      <section className="pt-40 pb-20 px-6">
        <div className="container mx-auto max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-card/50 text-xs text-muted-foreground mb-6">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            Live chat for everyone
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6">
            Chat in <span className="gradient-text glow-text">real time</span>.
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
            A modern, minimal messenger. Sign up, jump in, and start talking.
            No setup, no rooms — just one shared conversation.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" onClick={() => navigate(user ? "/chat" : "/auth")} className="glow-box">
              {user ? "Open chat" : "Start chatting"}
            </Button>
          </div>
        </div>
      </section>

      <section className="py-16 px-6">
        <div className="container mx-auto max-w-5xl grid md:grid-cols-3 gap-6">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-xl border border-border/60 bg-card/50 p-6 hover:border-primary/40 transition-colors"
            >
              <f.icon className="h-6 w-6 text-primary mb-4" />
              <h3 className="font-semibold mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border/50 py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} PrintChat
      </footer>
    </div>
  );
};

export default Index;
