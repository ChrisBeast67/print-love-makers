import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import printchatLogo from "@/../../printchat-logo.png";

const Hero = () => (
  <section className="relative min-h-screen flex items-center overflow-hidden">
    <div className="absolute inset-0">
      <div className="absolute inset-0 bg-gradient-to-r from-blue-900 via-purple-900 to-indigo-900" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(0,212,255,0.1),transparent_50%)]" />
    </div>

    <div className="container relative z-10 mx-auto px-6 pt-24">
      <div className="max-w-2xl space-y-6">
        <div className="flex items-center gap-4">
          <img src={printchatLogo} alt="PrintChat Logo" className="w-24 h-24 object-contain" />
          <div>
            <h1 className="text-5xl font-bold tracking-tight md:text-7xl">
              <span className="gradient-text glow-text">PrintChat</span>
            </h1>
            <p className="text-xl text-blue-400">Hi-tech 3D Printing Messaging</p>
          </div>
        </div>
        <p className="text-lg text-muted-foreground leading-relaxed md:text-xl">
          Direct messages, group chats, friend requests, credits, and a profile-pack shop. Chat in real-time with other 3D printing enthusiasts.
        </p>
        <div className="flex flex-wrap gap-4 pt-2">
          <Button size="lg" className="gap-2 bg-gradient-to-r from-blue-500 to-cyan-400 hover:from-blue-600 hover:to-cyan-500">
            Get started <ArrowRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex gap-8 pt-6 text-sm">
          {[["Real-time", "Messages"], ["Secure", "Auth"], ["Friends", "+ Groups"]].map(([val, label]) => (
            <div key={label}>
              <div className="text-2xl font-bold text-blue-400">{val}</div>
              <div className="text-muted-foreground">{label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </section>
);

export default Hero;