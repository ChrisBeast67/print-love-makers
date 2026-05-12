import { useState } from "react";
import { Menu, X, Printer, ChevronDown, Gamepad2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const Navbar = () => {
  const [open, setOpen] = useState(false);
  const links = ["Services", "Materials", "How It Works", "Gallery", "Contact"];

  const gameLinks = [
    { name: "Slope Game", url: "https://slopeonline.online/", icon: "⛰️" },
    { name: "Poor Bunny", url: "https://poorbunny2.io/", icon: "🐰" },
    { name: "Monkey Mart", url: "https://monkeymartgame.io/", icon: "🍌" },
    { name: "Wave Dash", url: "https://www.cokitos.com/wave-dash/", icon: "🌊" },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="container mx-auto flex items-center justify-between px-6 py-4">
        <a href="#" className="flex items-center gap-2 text-xl font-bold">
          <Printer className="h-6 w-6 text-primary" />
          <span className="gradient-text">PrintForge</span>
        </a>

        <div className="hidden items-center gap-8 md:flex">
          {links.map((l) => (
            <a key={l} href={`#${l.toLowerCase().replace(/\s/g, "-")}`} className="text-sm text-muted-foreground transition-colors hover:text-primary">
              {l}
            </a>
          ))}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 border-primary/50 hover:border-primary hover:bg-primary/10">
                <Gamepad2 className="h-4 w-4 text-primary" />
                <span>Games</span>
                <ChevronDown className="h-3 w-3 text-primary" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {gameLinks.map((g) => (
                <DropdownMenuItem key={g.name} asChild>
                  <a href={g.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 cursor-pointer">
                    <span>{g.icon}</span> {g.name}
                  </a>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm">Get a Quote</Button>
        </div>

        <button className="md:hidden text-foreground" onClick={() => setOpen(!open)}>
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-border/50 bg-background/95 backdrop-blur-xl md:hidden">
          <div className="flex flex-col gap-4 px-6 py-6">
            {links.map((l) => (
              <a key={l} href={`#${l.toLowerCase().replace(/\s/g, "-")}`} className="text-muted-foreground hover:text-primary" onClick={() => setOpen(false)}>
                {l}
              </a>
            ))}
            <div className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-muted-foreground">🎮 External Games</span>
              {gameLinks.map((g) => (
                <a key={g.name} href={g.url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary pl-2" onClick={() => setOpen(false)}>
                  {g.icon} {g.name}
                </a>
              ))}
            </div>
            <Button size="sm">Get a Quote</Button>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
