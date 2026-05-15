import type PocketBase from "pocketbase";

/**
 * Cliente persistido en la collection `clients` de PocketBase.
 *
 * `whatsapp_norm` y `name_norm` son campos calculados por hook/backfill
 * (no los seteamos manualmente desde el frontend — el hook lo hace al
 * guardar order/supply_sale, o se setean al editar este record).
 */
export type Client = {
  id: string;
  name: string;
  whatsapp: string;
  whatsapp_norm: string;
  name_norm: string;
  notes: string;
  tags: string;
  created: string;
  updated: string;
};

// ─── Tags helpers (puros) ─────────────────────────────────────────────

/** Parsea "vip, mayorista, moroso" → array normalizado (lowercase, trim, dedup). */
export function parseTags(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return Array.from(
    new Set(
      String(raw)
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter((t) => t.length > 0),
    ),
  );
}

/** Normaliza al guardar: lowercase, trim, dedupe, joineado con ", ". */
export function normalizeTags(raw: string | null | undefined): string {
  return parseTags(raw).join(", ");
}

/** True si el client tiene el tag (case-insensitive). */
export function clientHasTag(
  client: Pick<Client, "tags">,
  tag: string,
): boolean {
  const norm = tag.trim().toLowerCase();
  if (!norm) return false;
  return parseTags(client.tags).includes(norm);
}

/** Recolecta todos los tags únicos de una lista de clients. Ordenado alfa. */
export function collectAllTags(clients: Pick<Client, "tags">[]): string[] {
  const set = new Set<string>();
  for (const c of clients) {
    for (const t of parseTags(c.tags)) set.add(t);
  }
  return Array.from(set).sort();
}

/** Stats agregadas calculadas on-the-fly (no persistidas). */
export type ClientStats = {
  total_orders: number;
  total_supply_sales: number;
  total_spent: number; // ARS — suma de orders.total + supply_sales.total
  last_seen_at: string | null; // ISO o null si no hay actividad
};

export type ClientWithStats = Client & ClientStats;

/**
 * Forma mínima de un order para calcular stats.
 * Tomamos solo los campos que necesitamos — evita acoplar a la collection completa.
 */
export type OrderMinimal = {
  id: string;
  client?: string;
  unit_price: number;
  units_ordered: number;
  order_date: string;
  delivery_date?: string;
  created: string;
};

export type SupplySaleMinimal = {
  id: string;
  client?: string;
  unit_price: number;
  quantity: number;
  sale_date: string;
  created: string;
};

export const CLIENT_NAME_MAX = 120;
export const CLIENT_WHATSAPP_MAX = 30;
export const CLIENT_NOTES_MAX = 2000;

// ─── Normalizadores (puros, sin IO) ──────────────────────────────────────

/**
 * Devuelve solo los digitos del WhatsApp.
 * "+54 9 381-456 7890" → "5493814567890"
 */
export function normalizeWhatsapp(raw: string | null | undefined): string {
  if (!raw) return "";
  return String(raw).replace(/\D/g, "");
}

/**
 * Normaliza un nombre para matching:
 *  - lowercase
 *  - trim
 *  - sin tildes/diacriticos
 *  - colapsa espacios multiples a uno solo
 *
 * "  José  María  " → "jose maria"
 * "Señor"           → "senor"
 */
export function normalizeName(raw: string | null | undefined): string {
  if (!raw) return "";
  const diacritics = new RegExp("[\\u0300-\\u036f]", "g");
  return String(raw)
    .normalize("NFD")
    .replace(diacritics, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

// ─── Agregacion de stats (puro) ──────────────────────────────────────────

/**
 * Calcula stats de un cliente a partir de listas crudas de orders + supply_sales.
 *
 * El caller hace UNA query de orders y UNA de supply_sales (todos, sin filtrar
 * por client) y agrupa en memoria. Mucho mas eficiente que N+1 queries.
 */
export function aggregateStatsByClient(
  orders: OrderMinimal[],
  sales: SupplySaleMinimal[],
): Map<string, ClientStats> {
  const stats = new Map<string, ClientStats>();

  function get(clientId: string): ClientStats {
    const existing = stats.get(clientId);
    if (existing) return existing;
    const fresh: ClientStats = {
      total_orders: 0,
      total_supply_sales: 0,
      total_spent: 0,
      last_seen_at: null,
    };
    stats.set(clientId, fresh);
    return fresh;
  }

  function bumpLastSeen(s: ClientStats, candidate: string | undefined) {
    if (!candidate) return;
    if (!s.last_seen_at || candidate > s.last_seen_at) {
      s.last_seen_at = candidate;
    }
  }

  for (const o of orders) {
    if (!o.client) continue;
    const s = get(o.client);
    s.total_orders += 1;
    s.total_spent += (Number(o.unit_price) || 0) * (Number(o.units_ordered) || 0);
    // Usamos la fecha mas reciente entre order_date, delivery_date, created.
    bumpLastSeen(s, o.delivery_date || o.order_date || o.created);
  }

  for (const sale of sales) {
    if (!sale.client) continue;
    const s = get(sale.client);
    s.total_supply_sales += 1;
    s.total_spent += (Number(sale.unit_price) || 0) * (Number(sale.quantity) || 0);
    bumpLastSeen(s, sale.sale_date || sale.created);
  }

  return stats;
}

/** Combina la lista de clients con sus stats agregadas. Clientes sin pedidos quedan con stats en cero. */
export function attachStats(
  clients: Client[],
  statsByClient: Map<string, ClientStats>,
): ClientWithStats[] {
  return clients.map((c) => {
    const s = statsByClient.get(c.id) ?? {
      total_orders: 0,
      total_supply_sales: 0,
      total_spent: 0,
      last_seen_at: null,
    };
    return { ...c, ...s };
  });
}

// ─── Validacion de form (para POST /admin/clientes/[id]) ─────────────────

export type ClientFormData = {
  name: string;
  whatsapp: string;
  notes: string;
  tags: string;
};

export type ExtractClientResult = {
  data: ClientFormData;
  errors: Record<string, string>;
};

function str(form: FormData, key: string): string {
  const v = form.get(key);
  return typeof v === "string" ? v.trim() : "";
}

export function extractClientFromForm(form: FormData): ExtractClientResult {
  const errors: Record<string, string> = {};

  const name = str(form, "name");
  const whatsapp = str(form, "whatsapp");
  const notes = str(form, "notes");
  const tags = normalizeTags(str(form, "tags"));

  if (!name) {
    errors.name = "El nombre es obligatorio.";
  } else if (name.length > CLIENT_NAME_MAX) {
    errors.name = `Maximo ${CLIENT_NAME_MAX} caracteres.`;
  }

  if (whatsapp.length > CLIENT_WHATSAPP_MAX) {
    errors.whatsapp = `Maximo ${CLIENT_WHATSAPP_MAX} caracteres.`;
  }

  if (notes.length > CLIENT_NOTES_MAX) {
    errors.notes = `Maximo ${CLIENT_NOTES_MAX} caracteres.`;
  }

  if (tags.length > 200) {
    errors.tags = `Maximo 200 caracteres.`;
  }

  return { data: { name, whatsapp, notes, tags }, errors };
}

// ─── IO (fetches contra PB) ──────────────────────────────────────────────

/** Fetch full list de clients ordenados por nombre. */
export async function fetchAllClients(pb: PocketBase): Promise<Client[]> {
  const records = await pb.collection("clients").getFullList({
    sort: "name",
  });
  return records as unknown as Client[];
}

/**
 * Forma reducida para autocomplete: solo lo necesario para autollenar
 * customer_name + customer_whatsapp en los formularios.
 *
 * El id se incluye para que un futuro autocomplete pueda guardar la relation
 * directamente (no requerido por la version actual — el hook resuelve por
 * whatsapp_norm/name_norm).
 */
export type ClientForAutocomplete = {
  id: string;
  name: string;
  whatsapp: string;
};

export async function fetchClientsForAutocomplete(
  pb: PocketBase,
): Promise<ClientForAutocomplete[]> {
  const records = await pb.collection("clients").getFullList({
    sort: "name",
    fields: "id,name,whatsapp",
  });
  return records as unknown as ClientForAutocomplete[];
}

export async function fetchClientById(
  pb: PocketBase,
  id: string,
): Promise<Client | null> {
  try {
    const record = await pb.collection("clients").getOne(id);
    return record as unknown as Client;
  } catch {
    return null;
  }
}

/**
 * Lista de clientes con stats agregadas, lista para renderizar.
 *
 * Hace 3 fetches en paralelo y agrupa en memoria. Costo: O(N+O+S) donde
 * N = clientes, O = orders, S = supply_sales. A escala chica (cientos)
 * es instantaneo. Si crece a miles, considerar paginacion o cache.
 */
export async function fetchClientsWithStats(
  pb: PocketBase,
): Promise<ClientWithStats[]> {
  const [clients, orders, sales] = await Promise.all([
    fetchAllClients(pb),
    pb.collection("orders").getFullList({
      fields: "id,client,unit_price,units_ordered,order_date,delivery_date,created",
    }),
    pb.collection("supply_sales").getFullList({
      fields: "id,client,unit_price,quantity,sale_date,created",
    }),
  ]);
  const statsMap = aggregateStatsByClient(
    orders as unknown as OrderMinimal[],
    sales as unknown as SupplySaleMinimal[],
  );
  return attachStats(clients, statsMap);
}

/**
 * Detalle de un cliente: el record + sus orders + sus supply_sales + stats.
 *
 * Hace 3 fetches en paralelo (cliente + sus orders + sus sales).
 */
export async function fetchClientDetail(
  pb: PocketBase,
  id: string,
): Promise<{
  client: Client;
  orders: Record<string, unknown>[];
  sales: Record<string, unknown>[];
  stats: ClientStats;
} | null> {
  const safeId = id.replace(/[^a-zA-Z0-9]/g, "");
  if (!safeId) return null;

  const client = await fetchClientById(pb, safeId);
  if (!client) return null;

  const [orders, sales] = await Promise.all([
    pb.collection("orders").getFullList({
      filter: `client = "${safeId}"`,
      sort: "-created",
    }),
    pb.collection("supply_sales").getFullList({
      filter: `client = "${safeId}"`,
      sort: "-created",
    }),
  ]);

  const statsMap = aggregateStatsByClient(
    orders as unknown as OrderMinimal[],
    sales as unknown as SupplySaleMinimal[],
  );
  const stats = statsMap.get(client.id) ?? {
    total_orders: 0,
    total_supply_sales: 0,
    total_spent: 0,
    last_seen_at: null,
  };

  return {
    client,
    orders: orders as unknown as Record<string, unknown>[],
    sales: sales as unknown as Record<string, unknown>[],
    stats,
  };
}
