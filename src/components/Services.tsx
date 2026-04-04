import { Layers, Gem, Wrench, Box } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const services = [
  { icon: Layers, title: "FDM Printing", desc: "Affordable, durable parts in PLA, ABS, PETG and more. Ideal for prototypes and functional components.", price: "From $5" },
  { icon: Gem, title: "SLA/Resin Printing", desc: "Ultra-fine detail with smooth surface finish. Perfect for miniatures, jewelry, and dental models.", price: "From $15" },
  { icon: Wrench, title: "Custom Engineering", desc: "End-use parts with engineering-grade materials like Nylon, TPU, and carbon fiber composites.", price: "From $25" },
  { icon: Box, title: "Batch Production", desc: "Small to medium batch runs with consistent quality. Volume discounts available.", price: "Custom quote" },
];

const Services = () => (
  <section id="services" className="py-24">
    <div className="container mx-auto px-6">
      <div className="mb-16 text-center">
        <h2 className="text-3xl font-bold md:text-4xl">Our <span className="gradient-text">Services</span></h2>
        <p className="mx-auto mt-4 max-w-xl text-muted-foreground">Professional 3D printing solutions for every need, from one-off prototypes to production runs.</p>
      </div>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {services.map((s) => (
          <Card key={s.title} className="group border-border/50 bg-card transition-all hover:border-primary/40 hover:glow-box">
            <CardContent className="p-6 space-y-4">
              <div className="inline-flex rounded-lg bg-primary/10 p-3">
                <s.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">{s.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
              <div className="text-sm font-semibold text-primary">{s.price}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  </section>
);

export default Services;
