/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const categories = app.findCollectionByNameOrId("categories");

  const seed = [
    { name: "Filamentos",     slug: "filamentos",      icon: "🧵", order: 10, description: "PLA 3Nmax, PETG y otros para tu impresora 3D." },
    { name: "Mates",          slug: "mates",           icon: "🧉", order: 20, description: "Mates con bombilla en polímero, listos para cebar." },
    { name: "Vasos",          slug: "vasos",           icon: "🥛", order: 30, description: "Vasos de aluminio para chops 3D y vasos para milkshake de niños." },
    { name: "Chops 3D",       slug: "chops-3d",        icon: "🍺", order: 40, description: "Chops impresos en 3D con vasos de aluminio." },
    { name: "Llaveros",       slug: "llaveros",        icon: "🔑", order: 50, description: "Llaveros personalizados y diseños listos." },
    { name: "Porta celulares", slug: "porta-celulares", icon: "📱", order: 60, description: "Soportes y porta celulares para escritorio o auto." },
    { name: "Organizadores",  slug: "organizadores",   icon: "🗂️", order: 70, description: "Organizadores y soluciones de almacenamiento." },
    { name: "Insumos",        slug: "insumos",         icon: "🧴", order: 80, description: "Pegamento rápido, repuestos y accesorios." },
  ];

  for (const cat of seed) {
    const record = new Record(categories);
    record.set("name", cat.name);
    record.set("slug", cat.slug);
    record.set("icon", cat.icon);
    record.set("order", cat.order);
    record.set("description", cat.description);
    record.set("active", true);
    app.save(record);
  }
}, (app) => {
  const slugs = [
    "filamentos", "mates", "vasos", "chops-3d",
    "llaveros", "porta-celulares", "organizadores", "insumos",
  ];
  for (const slug of slugs) {
    try {
      const record = app.findFirstRecordByFilter("categories", "slug = {:slug}", { slug });
      app.delete(record);
    } catch (_) {
      // ya borrado
    }
  }
});
