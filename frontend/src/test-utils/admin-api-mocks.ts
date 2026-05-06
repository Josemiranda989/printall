/**
 * Helpers reutilizables para testear los API endpoints del admin custom.
 *
 * Patrón:
 *   const pb = createMockPB();
 *   pb._getCollection("products").getOne.mockResolvedValue({ ... });
 *   const ctx = createApiContext({ params: { id: "abc" }, request: jsonRequest(...), locals: { adminPB: pb } });
 *   const res = await POST(ctx);
 */
import { vi } from "vitest";

// ─── Collection mock ────────────────────────────────────────────────────────

export type MockCollection = {
  getOne: ReturnType<typeof vi.fn>;
  getFullList: ReturnType<typeof vi.fn>;
  getList: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

function makeMockCollection(): MockCollection {
  return {
    getOne: vi.fn(),
    getFullList: vi.fn(),
    getList: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
}

// ─── PocketBase mock ─────────────────────────────────────────────────────────

export type MockPB = {
  /** Llamar con un nombre de collection retorna siempre la misma instancia mockeada. */
  collection: ReturnType<typeof vi.fn>;
  /**
   * Obtener la MockCollection por nombre para hacer setup o asserts.
   * Si no se usó todavía, la crea y cachea (para que coincida con la que usará `collection`).
   */
  _getCollection: (name: string) => MockCollection;
};

/**
 * Crea un mock de PocketBase que cachea collections por nombre.
 * Cada llamada a `pb.collection('xxx')` retorna la misma instancia mockeada,
 * de modo que los `vi.fn()` mantienen estado a través del test.
 */
export function createMockPB(): MockPB {
  const _collections = new Map<string, MockCollection>();

  function getOrCreate(name: string): MockCollection {
    if (!_collections.has(name)) {
      _collections.set(name, makeMockCollection());
    }
    return _collections.get(name)!;
  }

  const pb: MockPB = {
    collection: vi.fn((name: string) => getOrCreate(name)),
    _getCollection: (name: string) => getOrCreate(name),
  };

  return pb;
}

// ─── APIContext mock ──────────────────────────────────────────────────────────

/**
 * Crea un context tipo APIContext de Astro.
 * Defaults: locals.adminPB = createMockPB() si no se pasa.
 */
export function createApiContext(opts: {
  params?: Record<string, string>;
  request: Request;
  locals?: { adminPB?: MockPB | null; admin?: unknown };
}): any {
  return {
    params: opts.params ?? {},
    request: opts.request,
    locals: {
      adminPB: createMockPB(),
      ...opts.locals,
    },
  };
}

// ─── Request builders ─────────────────────────────────────────────────────────

/**
 * Construye un Request con JSON body y Content-Type application/json.
 */
export function jsonRequest(url: string, method: string, body: unknown): Request {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/**
 * Construye un Request con FormData body.
 * Acepta {key: string | File | File[]} pairs.
 * El Content-Type multipart/form-data se setea automáticamente por el runtime.
 */
export function formDataRequest(
  url: string,
  method: string,
  fields: Record<string, string | File | File[]>,
): Request {
  const fd = new FormData();
  for (const [key, val] of Object.entries(fields)) {
    if (Array.isArray(val)) {
      for (const f of val) fd.append(key, f);
    } else {
      fd.append(key, val);
    }
  }
  return new Request(url, { method, body: fd });
}
