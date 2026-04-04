import { Printer } from "lucide-react";

const Footer = () => (
  <footer className="border-t border-border/50 bg-card/50 py-10">
    <div className="container mx-auto flex flex-col items-center gap-4 px-6 text-center text-sm text-muted-foreground md:flex-row md:justify-between md:text-left">
      <div className="flex items-center gap-2 font-semibold text-foreground">
        <Printer className="h-5 w-5 text-primary" />
        <span className="gradient-text">PrintForge</span>
      </div>
      <p>© 2026 PrintForge. All rights reserved.</p>
    </div>
  </footer>
);

export default Footer;
