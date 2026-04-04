import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import heroImg from "@/assets/hero-3d-printer.jpg";

const Hero = () => (
  <section className="relative min-h-screen flex items-center overflow-hidden">
    <div className="absolute inset-0">
      <img src={heroImg} alt="3D printer creating a geometric sculpture" width={1920} height={1080} className="h-full w-full object-cover opacity-40" />
      <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-background/40" />
    </div>

    <div className="container relative z-10 mx-auto px-6 pt-24">
      <div className="max-w-2xl space-y-6">
        <div className="inline-block rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-medium text-primary">
          Precision 3D Printing Services
        </div>
        <h1 className="text-5xl font-bold leading-tight tracking-tight md:text-7xl">
          Bring Your <span className="gradient-text glow-text">Ideas</span> to Life
        </h1>
        <p className="text-lg text-muted-foreground leading-relaxed md:text-xl">
          From rapid prototyping to production-grade parts, we deliver exceptional 3D prints with cutting-edge FDM and SLA technology.
        </p>
        <div className="flex flex-wrap gap-4 pt-2">
          <Button size="lg" className="gap-2">
            Start Your Project <ArrowRight className="h-4 w-4" />
          </Button>
          <Button size="lg" variant="outline" className="border-primary/30 text-primary hover:bg-primary/10">
            View Our Work
          </Button>
        </div>

        <div className="flex gap-8 pt-6 text-sm">
          {[["500+", "Projects Delivered"], ["0.05mm", "Layer Resolution"], ["48hr", "Fast Turnaround"]].map(([val, label]) => (
            <div key={label}>
              <div className="text-2xl font-bold text-primary">{val}</div>
              <div className="text-muted-foreground">{label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </section>
);

export default Hero;
