import galleryImg from "@/assets/gallery-prints.jpg";

const Gallery = () => (
  <section id="gallery" className="py-24 bg-card/50">
    <div className="container mx-auto px-6">
      <div className="mb-16 text-center">
        <h2 className="text-3xl font-bold md:text-4xl">Our <span className="gradient-text">Work</span></h2>
        <p className="mx-auto mt-4 max-w-xl text-muted-foreground">A showcase of prints we've crafted for clients across industries.</p>
      </div>
      <div className="overflow-hidden rounded-2xl border border-border/50 glow-box">
        <img src={galleryImg} alt="Collection of colorful 3D printed objects" loading="lazy" width={1200} height={800} className="w-full object-cover" />
      </div>
    </div>
  </section>
);

export default Gallery;
