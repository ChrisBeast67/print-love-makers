import { Upload, Settings, Printer, Package } from "lucide-react";

const steps = [
  { icon: Upload, title: "Upload Your Design", desc: "Send us your STL, OBJ, or 3MF file — or describe your idea and we'll design it." },
  { icon: Settings, title: "Configure & Quote", desc: "Choose material, resolution, and finish. Get an instant quote or custom estimate." },
  { icon: Printer, title: "We Print It", desc: "Your part is printed with precision on our calibrated industrial-grade machines." },
  { icon: Package, title: "Ship or Pickup", desc: "Quality-checked and shipped fast, or pick up from our studio." },
];

const HowItWorks = () => (
  <section id="how-it-works" className="py-24">
    <div className="container mx-auto px-6">
      <div className="mb-16 text-center">
        <h2 className="text-3xl font-bold md:text-4xl">How It <span className="gradient-text">Works</span></h2>
        <p className="mx-auto mt-4 max-w-xl text-muted-foreground">From file to finished part in four simple steps.</p>
      </div>
      <div className="relative grid gap-8 md:grid-cols-4">
        <div className="absolute top-10 left-[12%] right-[12%] hidden h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent md:block" />
        {steps.map((s, i) => (
          <div key={s.title} className="relative text-center space-y-4">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 glow-box">
              <s.icon className="h-8 w-8 text-primary" />
            </div>
            <div className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-primary px-2.5 py-0.5 text-xs font-bold text-primary-foreground">
              {i + 1}
            </div>
            <h3 className="font-semibold text-foreground">{s.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default HowItWorks;
