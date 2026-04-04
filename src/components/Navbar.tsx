import { useState } from "react";
import { Menu, X, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

const Navbar = () => {
  const [open, setOpen] = useState(false);
  const links = ["Services", "Materials", "How It Works", "Gallery", "Contact"];

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
            <Button size="sm">Get a Quote</Button>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
