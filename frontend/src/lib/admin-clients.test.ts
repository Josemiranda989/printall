import { describe, expect, it } from "vitest";
import {
  aggregateStatsByClient,
  attachStats,
  clientHasTag,
  collectAllTags,
  extractClientFromForm,
  normalizeName,
  normalizeTags,
  normalizeWhatsapp,
  parseTags,
  type Client,
  type OrderMinimal,
  type SupplySaleMinimal,
} from "./admin-clients";

// ─── normalizeWhatsapp ───────────────────────────────────────────────
describe("normalizeWhatsapp", () => {
  it("deja solo digitos", () => {
    expect(normalizeWhatsapp("+54 9 381-456 7890")).toBe("5493814567890");
  });

  it("retorna vacio para null/undefined/empty", () => {
    expect(normalizeWhatsapp(null)).toBe("");
    expect(normalizeWhatsapp(undefined)).toBe("");
    expect(normalizeWhatsapp("")).toBe("");
  });

  it("ignora todos los caracteres no numericos", () => {
    expect(normalizeWhatsapp("abc123def456")).toBe("123456");
    expect(normalizeWhatsapp("(011) 4567-8900")).toBe("01145678900");
  });

  it("preserva ceros al inicio", () => {
    expect(normalizeWhatsapp("001-234")).toBe("001234");
  });
});

// ─── normalizeName ───────────────────────────────────────────────────
describe("normalizeName", () => {
  it("convierte a lowercase y trim", () => {
    expect(normalizeName("  Juan Perez  ")).toBe("juan perez");
  });

  it("quita tildes y diacriticos", () => {
    expect(normalizeName("José María")).toBe("jose maria");
    expect(normalizeName("Señor")).toBe("senor");
    expect(normalizeName("Núñez")).toBe("nunez");
  });

  it("colapsa espacios multiples", () => {
    expect(normalizeName("Juan   Perez")).toBe("juan perez");
    expect(normalizeName("a  b  c")).toBe("a b c");
  });

  it("retorna vacio para null/undefined/empty", () => {
    expect(normalizeName(null)).toBe("");
    expect(normalizeName(undefined)).toBe("");
    expect(normalizeName("")).toBe("");
  });

  it("dos variantes del mismo nombre normalizan al mismo string", () => {
    // Razon: este es el contrato que hace funcionar el matching del backfill
    // y del hook. Si esto se rompe, dos pedidos del mismo cliente se convierten
    // en dos clients distintos.
    expect(normalizeName("José Pérez")).toBe(normalizeName("  JOSE   PEREZ  "));
  });
});

// ─── aggregateStatsByClient ──────────────────────────────────────────
describe("aggregateStatsByClient", () => {
  const orders: OrderMinimal[] = [
    {
      id: "o1",
      client: "c1",
      unit_price: 100,
      units_ordered: 2,
      order_date: "2026-01-10T00:00:00Z",
      created: "2026-01-10T00:00:00Z",
    },
    {
      id: "o2",
      client: "c1",
      unit_price: 50,
      units_ordered: 3,
      order_date: "2026-02-10T00:00:00Z",
      delivery_date: "2026-02-15T00:00:00Z",
      created: "2026-02-10T00:00:00Z",
    },
    {
      id: "o3",
      client: "c2",
      unit_price: 200,
      units_ordered: 1,
      order_date: "2026-03-01T00:00:00Z",
      created: "2026-03-01T00:00:00Z",
    },
    {
      id: "o4",
      // sin client — debe ignorarse
      unit_price: 999,
      units_ordered: 1,
      order_date: "2026-04-01T00:00:00Z",
      created: "2026-04-01T00:00:00Z",
    },
  ];

  const sales: SupplySaleMinimal[] = [
    {
      id: "s1",
      client: "c1",
      unit_price: 30,
      quantity: 5,
      sale_date: "2026-05-01T00:00:00Z",
      created: "2026-05-01T00:00:00Z",
    },
  ];

  it("suma orders y sales por client", () => {
    const stats = aggregateStatsByClient(orders, sales);

    expect(stats.get("c1")).toEqual({
      total_orders: 2,
      total_supply_sales: 1,
      total_spent: 100 * 2 + 50 * 3 + 30 * 5, // 200 + 150 + 150 = 500
      last_seen_at: "2026-05-01T00:00:00Z",
    });

    expect(stats.get("c2")).toEqual({
      total_orders: 1,
      total_supply_sales: 0,
      total_spent: 200,
      last_seen_at: "2026-03-01T00:00:00Z",
    });
  });

  it("ignora records sin client", () => {
    const stats = aggregateStatsByClient(orders, sales);
    // c4 (del order sin client) NO debe estar
    expect(stats.has("")).toBe(false);
    // Total clients distintos: c1, c2 (no contamos el order huerfano)
    expect(stats.size).toBe(2);
  });

  it("last_seen_at usa delivery_date si esta presente y es mas reciente", () => {
    const stats = aggregateStatsByClient(
      [
        {
          id: "x",
          client: "c1",
          unit_price: 1,
          units_ordered: 1,
          order_date: "2026-01-01T00:00:00Z",
          delivery_date: "2026-06-01T00:00:00Z",
          created: "2026-01-01T00:00:00Z",
        },
      ],
      [],
    );
    expect(stats.get("c1")?.last_seen_at).toBe("2026-06-01T00:00:00Z");
  });

  it("listas vacias devuelven Map vacio", () => {
    expect(aggregateStatsByClient([], []).size).toBe(0);
  });
});

// ─── attachStats ─────────────────────────────────────────────────────
describe("attachStats", () => {
  const clients: Client[] = [
    {
      id: "c1",
      name: "Juan",
      whatsapp: "",
      whatsapp_norm: "",
      name_norm: "juan",
      notes: "",
      created: "2026-01-01",
      updated: "2026-01-01",
    },
    {
      id: "c2",
      name: "Ana",
      whatsapp: "",
      whatsapp_norm: "",
      name_norm: "ana",
      notes: "",
      created: "2026-01-01",
      updated: "2026-01-01",
    },
  ];

  it("attachea las stats al client correspondiente", () => {
    const statsMap = new Map([
      [
        "c1",
        { total_orders: 3, total_supply_sales: 1, total_spent: 500, last_seen_at: "2026-05-01" },
      ],
    ]);
    const result = attachStats(clients, statsMap);
    expect(result[0].total_orders).toBe(3);
    expect(result[0].total_spent).toBe(500);
    // c2 no esta en el map → stats en cero
    expect(result[1].total_orders).toBe(0);
    expect(result[1].total_spent).toBe(0);
    expect(result[1].last_seen_at).toBeNull();
  });

  it("preserva los campos originales del Client", () => {
    const result = attachStats(clients, new Map());
    expect(result[0].name).toBe("Juan");
    expect(result[1].name).toBe("Ana");
  });
});

// ─── extractClientFromForm ───────────────────────────────────────────
describe("extractClientFromForm", () => {
  function form(fields: Record<string, string>): FormData {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.set(k, v);
    return fd;
  }

  it("acepta datos validos", () => {
    const result = extractClientFromForm(
      form({
        name: "Juan Perez",
        whatsapp: "+54 9 381 456",
        notes: "Cliente VIP",
        tags: "vip, mayorista",
      }),
    );
    expect(result.errors).toEqual({});
    expect(result.data).toEqual({
      name: "Juan Perez",
      whatsapp: "+54 9 381 456",
      notes: "Cliente VIP",
      tags: "vip, mayorista",
    });
  });

  it("falla si falta el nombre", () => {
    const result = extractClientFromForm(form({ name: "", whatsapp: "123" }));
    expect(result.errors.name).toBeDefined();
  });

  it("trimea los campos", () => {
    const result = extractClientFromForm(form({ name: "  Juan  ", whatsapp: " 123 " }));
    expect(result.data.name).toBe("Juan");
    expect(result.data.whatsapp).toBe("123");
  });

  it("rechaza nombre demasiado largo", () => {
    const result = extractClientFromForm(form({ name: "A".repeat(121) }));
    expect(result.errors.name).toBeDefined();
  });

  it("normaliza tags al extraer", () => {
    const result = extractClientFromForm(
      form({ name: "X", tags: "VIP, mayorista,  VIP , " }),
    );
    expect(result.data.tags).toBe("vip, mayorista");
  });
});

// ─── tags helpers ──────────────────────────────────────────────────
describe("parseTags / normalizeTags / clientHasTag / collectAllTags", () => {
  it("parseTags: lowercase, trim, dedupe, omite vacíos", () => {
    expect(parseTags("VIP, mayorista, VIP,, ")).toEqual(["vip", "mayorista"]);
  });

  it("parseTags: null/undefined/empty → []", () => {
    expect(parseTags(null)).toEqual([]);
    expect(parseTags(undefined)).toEqual([]);
    expect(parseTags("")).toEqual([]);
  });

  it("normalizeTags: produce string canónico separado por ', '", () => {
    expect(normalizeTags("VIP, mayorista,VIP")).toBe("vip, mayorista");
    expect(normalizeTags("")).toBe("");
  });

  it("clientHasTag: case-insensitive, true solo si está", () => {
    const c = { tags: "vip, mayorista" };
    expect(clientHasTag(c, "VIP")).toBe(true);
    expect(clientHasTag(c, "vip")).toBe(true);
    expect(clientHasTag(c, "moroso")).toBe(false);
    expect(clientHasTag(c, "")).toBe(false);
  });

  it("collectAllTags: tags únicos de varios clientes, ordenado alfa", () => {
    const result = collectAllTags([
      { tags: "vip, mayorista" },
      { tags: "moroso, vip" },
      { tags: "" },
    ]);
    expect(result).toEqual(["mayorista", "moroso", "vip"]);
  });
});
