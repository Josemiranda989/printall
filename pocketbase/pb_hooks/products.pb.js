/// <reference path="../pb_data/types.d.ts" />

/**
 * Convierte un string a slug URL-safe.
 * Ej: "Mate con Pico (Negro)" -> "mate-con-pico-negro"
 */
function slugify(text) {
  return String(text)
    .toLowerCase()
    .normalize("NFD")                       // descompone acentos
    .replace(/[\u0300-\u036f]/g, "")        // los elimina
    .replace(/[^a-z0-9]+/g, "-")            // todo no alfa-num -> guion
    .replace(/^-+|-+$/g, "")                // sin guiones al borde
    .substring(0, 120);
}

// === CREATE: auto-slug + safe defaults ===
// El admin custom (Astro) manda `published` explícito, así que no lo seteamos
// acá para no pisar `false` con `true` (bug latente del operador `!`).
onRecordCreateRequest((e) => {
  const name = e.record.get("name");
  const currentSlug = e.record.get("slug");
  if (name && (!currentSlug || String(currentSlug).trim() === "")) {
    e.record.set("slug", slugify(name));
  }

  if (!e.record.get("stock_status")) {
    e.record.set("stock_status", "in_stock");
  }

  e.next();
}, "products");

// === UPDATE: re-slug si quedó vacío ===
onRecordUpdateRequest((e) => {
  const name = e.record.get("name");
  const currentSlug = e.record.get("slug");
  if (name && (!currentSlug || String(currentSlug).trim() === "")) {
    e.record.set("slug", slugify(name));
  }
  e.next();
}, "products");
