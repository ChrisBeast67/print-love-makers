import { Mail, MapPin, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const Contact = () => (
  <section id="contact" className="py-24">
    <div className="container mx-auto px-6">
      <div className="mb-16 text-center">
        <h2 className="text-3xl font-bold md:text-4xl">Get a <span className="gradient-text">Quote</span></h2>
        <p className="mx-auto mt-4 max-w-xl text-muted-foreground">Tell us about your project and we'll get back within 24 hours.</p>
      </div>
      <div className="mx-auto grid max-w-4xl gap-12 md:grid-cols-2">
        <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
          <Input placeholder="Your name" className="border-border/50 bg-card" />
          <Input type="email" placeholder="Email address" className="border-border/50 bg-card" />
          <Input placeholder="Project title" className="border-border/50 bg-card" />
          <Textarea placeholder="Describe your project, material preferences, quantity..." rows={5} className="border-border/50 bg-card" />
          <Button className="w-full">Send Request</Button>
        </form>

        <div className="space-y-8">
          {[
            { icon: Mail, label: "Email", value: "hello@printforge.co" },
            { icon: MapPin, label: "Studio", value: "123 Maker Lane, Tech City" },
            { icon: Clock, label: "Hours", value: "Mon–Fri 9am–6pm" },
          ].map((item) => (
            <div key={item.label} className="flex items-start gap-4">
              <div className="rounded-lg bg-primary/10 p-3">
                <item.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="font-medium text-foreground">{item.label}</div>
                <div className="text-sm text-muted-foreground">{item.value}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </section>
);

export default Contact;
