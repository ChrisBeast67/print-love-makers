const materials = [
  { name: "PLA", props: "Biodegradable, easy to print", color: "174 72% 50%" },
  { name: "ABS", props: "Heat resistant, strong", color: "220 60% 55%" },
  { name: "PETG", props: "Chemical resistant, flexible", color: "150 60% 45%" },
  { name: "TPU", props: "Rubber-like, elastic", color: "30 80% 55%" },
  { name: "Nylon", props: "Durable, wear resistant", color: "280 50% 55%" },
  { name: "Resin", props: "Ultra detail, smooth", color: "350 65% 55%" },
];

const Materials = () => (
  <section id="materials" className="py-24 bg-card/50">
    <div className="container mx-auto px-6">
      <div className="mb-16 text-center">
        <h2 className="text-3xl font-bold md:text-4xl">Premium <span className="gradient-text">Materials</span></h2>
        <p className="mx-auto mt-4 max-w-xl text-muted-foreground">We stock a wide range of filaments and resins to match your project requirements.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {materials.map((m) => (
          <div key={m.name} className="flex items-center gap-4 rounded-xl border border-border/50 bg-card p-5 transition-all hover:border-primary/30">
            <div className="h-12 w-12 shrink-0 rounded-lg" style={{ background: `hsl(${m.color})` }} />
            <div>
              <div className="font-semibold text-foreground">{m.name}</div>
              <div className="text-sm text-muted-foreground">{m.props}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default Materials;
