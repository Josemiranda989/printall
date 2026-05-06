#!/usr/bin/env node
// Carga productos en PocketBase desde un JSON.
//
// Credenciales — orden de prioridad:
//   1. Variables de entorno manuales: PB_EMAIL=... PB_PASSWORD=... node ...
//   2. Archivo .env.local en este directorio (NO se commitea, cubierto por .gitignore .env.*)
//   3. macOS Keychain (corré ./scripts/setup-pb-creds.sh una vez para guardarlas)
//
// Crear .env.local (Mac/Linux):
//   cat > frontend/scripts/.env.local <<EOF
//   PB_EMAIL=tu-email@example.com
//   PB_PASSWORD=tu-password
//   EOF
//
// Crear .env.local (Windows CMD):
//   notepad frontend\scripts\.env.local
//   (escribir dos líneas: PB_EMAIL=... y PB_PASSWORD=..., guardar)
//
// Uso:
//   node scripts/seed-products.mjs --file=/tmp/productos.json
//   node scripts/seed-products.mjs --file=/tmp/productos.json --dry-run
//
// Schema de cada item del JSON:
// {
//   "name": "Mate Imperial",
//   "category": "mates",                  // slug de la categoría — required
//   "description": "<p>...</p>",          // HTML rich text — opcional (default "")
//   "price": 35000,                       // number — opcional (default 0)
//   "price_label": "",                    // texto opcional ("Consultar", "x kg", etc)
//   "stock_status": "in_stock",           // in_stock|low_stock|out_of_stock|made_to_order
//   "featured": false,                    // bool
//   "published": false,                   // bool — default false (queda en draft)
//   "slug": "mate-imperial",              // opcional — autogenera del name si no se pasa
//   "attributes": [                       // opcional — filas key/value
//     { "key": "Material", "value": "Calabaza forrada en cuero" },
//     { "key": "Virola",   "value": "Alpaca" }
//   ]
// }

import PocketBase from "pocketbase";
import { readFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const KEYCHAIN_SERVICE = "printall-pb-admin";
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));

function loadEnvFile() {
  // Busca .env.local junto al script y un nivel arriba (en frontend/)
  const candidates = [
    join(SCRIPT_DIR, ".env.local"),
    join(SCRIPT_DIR, "..", ".env.local"),
  ];
  for (const path of candidates) {
    if (!existsSync(path)) continue;
    const content = readFileSync(path, "utf-8");
    for (const rawLine of content.split("\n")) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const eqIdx = line.indexOf("=");
      if (eqIdx === -1) continue;
      const key = line.slice(0, eqIdx).trim();
      const value = line
        .slice(eqIdx + 1)
        .trim()
        .replace(/^["']|["']$/g, "");
      // env vars ya seteadas tienen prioridad — no las pisamos
      if (!(key in process.env)) process.env[key] = value;
    }
    return path;
  }
  return null;
}

function readKeychainCreds() {
  if (process.platform !== "darwin") return null;
  try {
    const password = execSync(
      `security find-generic-password -s "${KEYCHAIN_SERVICE}" -w`,
      { stdio: ["ignore", "pipe", "ignore"] },
    )
      .toString()
      .trim();

    const meta = execSync(
      `security find-generic-password -s "${KEYCHAIN_SERVICE}"`,
      { stdio: ["ignore", "pipe", "ignore"] },
    ).toString();
    const acctMatch = meta.match(/"acct"<blob>="([^"]+)"/);
    const email = acctMatch?.[1];

    if (!email || !password) return null;
    return { email, password };
  } catch {
    return null;
  }
}

const { values } = parseArgs({
  options: {
    file: { type: "string" },
    "dry-run": { type: "boolean", default: false },
    pb: { type: "string", default: "https://printall-api.jmlabs.app" },
  },
  allowPositionals: false,
});

if (!values.file) {
  console.error(
    "Usage: node scripts/seed-products.mjs --file=/path/to/products.json [--dry-run]",
  );
  console.error("\nCredenciales: setup única con './scripts/setup-pb-creds.sh'");
  console.error(
    "             o pasarlas inline con PB_EMAIL=... PB_PASSWORD=... node ...",
  );
  process.exit(1);
}

const dryRun = values["dry-run"];

// Orden de prioridad: env vars manuales > .env.local > macOS Keychain
const envFileLoaded = loadEnvFile();

let email = process.env.PB_EMAIL;
let password = process.env.PB_PASSWORD;
let credSource = email && password ? (envFileLoaded ? "env-file" : "env") : null;

if (!dryRun && (!email || !password)) {
  const kc = readKeychainCreds();
  if (kc) {
    email = kc.email;
    password = kc.password;
    credSource = "keychain";
  }
}

if (!dryRun && (!email || !password)) {
  console.error("✗ No se encontraron credenciales. Opciones:");
  console.error("  1. macOS Keychain (Mac):   ./scripts/setup-pb-creds.sh");
  console.error(
    "  2. Archivo .env.local:    cp scripts/.env.local.example scripts/.env.local && editalo",
  );
  console.error(
    "  3. Variables de entorno:  PB_EMAIL=... PB_PASSWORD=... node scripts/seed-products.mjs ...",
  );
  process.exit(1);
}

const raw = await readFile(values.file, "utf-8");
const products = JSON.parse(raw);
if (!Array.isArray(products)) {
  console.error("✗ El JSON debe ser un array de productos.");
  process.exit(1);
}

console.log(`📦 ${products.length} producto(s) en ${values.file}\n`);

const pb = new PocketBase(values.pb);

let categoriesMap = new Map();

if (!dryRun) {
  try {
    await pb.collection("_superusers").authWithPassword(email, password);
    console.log(`✓ autenticado contra ${values.pb} (creds: ${credSource})\n`);
  } catch (err) {
    console.error(`✗ Auth falló: ${err.message ?? err}`);
    process.exit(1);
  }

  const cats = await pb.collection("categories").getFullList();
  for (const c of cats) categoriesMap.set(c.slug, c.id);
  console.log(
    `✓ ${categoriesMap.size} categorías cacheadas: ${[...categoriesMap.keys()].join(", ")}\n`,
  );
}

function slugify(str) {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 80);
}

const VALID_STOCK = ["in_stock", "low_stock", "out_of_stock", "made_to_order"];

let created = 0;
let skipped = 0;
let failed = 0;

for (const p of products) {
  const name = (p.name ?? "").trim();
  if (!name) {
    console.error(`✗ producto sin name: ${JSON.stringify(p)}`);
    failed++;
    continue;
  }

  const slug = p.slug || slugify(name);

  if (!p.category) {
    console.error(`✗ ${name}: falta "category" (slug)`);
    failed++;
    continue;
  }

  const stock = p.stock_status ?? "in_stock";
  if (!VALID_STOCK.includes(stock)) {
    console.error(
      `✗ ${name}: stock_status inválido "${stock}". Válidos: ${VALID_STOCK.join(", ")}`,
    );
    failed++;
    continue;
  }

  if (dryRun) {
    console.log(`[DRY] ${name}`);
    console.log(`        slug: ${slug}`);
    console.log(`        category: ${p.category}`);
    console.log(`        price: ${p.price ?? 0}${p.price_label ? ` (${p.price_label})` : ""}`);
    console.log(`        stock: ${stock}, featured: ${!!p.featured}, published: ${!!p.published}`);
    if (p.description) {
      const preview = p.description.replace(/<[^>]*>/g, "").slice(0, 80);
      console.log(`        desc: ${preview}${p.description.length > 80 ? "..." : ""}`);
    }
    if (Array.isArray(p.attributes) && p.attributes.length > 0) {
      for (const a of p.attributes) console.log(`        attr: ${a.key} = ${a.value}`);
    }
    console.log("");
    continue;
  }

  const categoryId = categoriesMap.get(p.category);
  if (!categoryId) {
    console.error(
      `✗ ${name}: categoría "${p.category}" no existe. Disponibles: ${[...categoriesMap.keys()].join(", ")}`,
    );
    failed++;
    continue;
  }

  try {
    const existing = await pb
      .collection("products")
      .getFirstListItem(`slug = "${slug}"`);
    console.log(`- ${name} ya existe (id: ${existing.id}) → skip`);
    skipped++;
    continue;
  } catch {
    // no existe, seguir
  }

  let record;
  try {
    record = await pb.collection("products").create({
      name,
      slug,
      category: categoryId,
      description: p.description ?? "",
      price: typeof p.price === "number" ? p.price : 0,
      price_label: p.price_label ?? "",
      stock_status: stock,
      featured: p.featured === true,
      published: p.published === true,
    });
  } catch (err) {
    const msg = err?.response?.data
      ? JSON.stringify(err.response.data)
      : err.message;
    console.error(`✗ ${name}: ${msg}`);
    failed++;
    continue;
  }

  let attrCount = 0;
  if (Array.isArray(p.attributes)) {
    for (let i = 0; i < p.attributes.length; i++) {
      const a = p.attributes[i];
      if (!a.key || a.value == null) continue;
      try {
        await pb.collection("product_attributes").create({
          product: record.id,
          key: String(a.key),
          value: String(a.value),
          order: i,
        });
        attrCount++;
      } catch (err) {
        console.error(`  ✗ attr "${a.key}": ${err.message}`);
      }
    }
  }

  console.log(
    `✓ ${name} → id ${record.id} (slug: ${slug}, attrs: ${attrCount})`,
  );
  created++;
}

console.log(`\nResumen: ${created} creados, ${skipped} skipped, ${failed} fallaron.`);
if (created > 0) {
  console.log(`\n📷 Cargá las imágenes en:`);
  console.log(`   https://printall.jmlabs.app/admin/productos`);
  console.log(`   (o local: http://localhost:4321/admin/productos)`);
}
