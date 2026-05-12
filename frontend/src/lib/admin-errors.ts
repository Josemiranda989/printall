/**
 * admin-errors — mapper de errores de PocketBase a mensajes amigables (es-AR).
 *
 * Cubre tres familias:
 *  1. Errores de validación de PB (`validation_*`) con códigos por campo.
 *  2. Errores de red (ECONNREFUSED, timeout, ENOTFOUND, fetch failed).
 *  3. Fallback al `e.message` original si nada matchea (para no perder info en bugs).
 *
 * Hay dos APIs:
 *  - `mapPBErrorToFieldErrors(err, context)` → `Record<string, string>` para forms (página Astro).
 *  - `mapPBErrorToString(err, fallback)` → `string` para endpoints API (JSON con un solo error).
 */

export type FieldErrors = Record<string, string>;

export type ErrorContext =
  | "product"
  | "category"
  | "attribute"
  | "image"
  | "order"
  | "generic";

type PBValidationInfo = { code?: string; message?: string };
type PBError = {
  message?: string;
  response?: { data?: Record<string, PBValidationInfo> };
};

const CONTEXT_FALLBACK: Record<ErrorContext, string> = {
  product: "No se pudo guardar el producto.",
  category: "No se pudo guardar la categoría.",
  attribute: "No se pudo guardar el atributo.",
  image: "No se pudo procesar la imagen.",
  order: "No se pudo guardar el pedido.",
  generic: "No se pudo completar la operación.",
};

/**
 * Diccionario PB code → mensaje. Cada code puede tener mensajes específicos
 * por nombre de campo y un `_default` como fallback dentro del code.
 */
const FIELD_ERROR_MESSAGES: Record<string, Record<string, string>> = {
  validation_not_unique: {
    slug: "Ese slug ya existe. Elegí uno diferente.",
    name: "Ese nombre ya está en uso.",
    order_number: "Ese número de pedido ya existe. Reintentá.",
    _default: "Ese valor ya existe — tiene que ser único.",
  },
  validation_required: {
    _default: "Este campo es obligatorio.",
  },
  validation_min_text_constraint: {
    _default: "Demasiado corto.",
  },
  validation_max_text_constraint: {
    _default: "Demasiado largo.",
  },
  validation_min_number_constraint: {
    price: "El precio no puede ser negativo.",
    _default: "Valor numérico demasiado bajo.",
  },
  validation_max_number_constraint: {
    _default: "Valor numérico demasiado alto.",
  },
  validation_missing_rel_records: {
    category: "La categoría seleccionada no existe.",
    product: "El producto referenciado no existe.",
    _default: "El valor referenciado no existe.",
  },
  validation_invalid_value: {
    _default: "Valor inválido.",
  },
  validation_invalid_format: {
    _default: "El formato del valor es inválido.",
  },
};

const NETWORK_PATTERNS: { match: string; msg: string }[] = [
  { match: "ECONNREFUSED", msg: "No se pudo conectar al servidor. ¿Está corriendo PocketBase?" },
  { match: "ENOTFOUND", msg: "Servidor no encontrado. Revisá la conexión." },
  { match: "ETIMEDOUT", msg: "El servidor tardó demasiado en responder. Intentá de nuevo." },
  { match: "timeout", msg: "El servidor tardó demasiado en responder. Intentá de nuevo." },
  { match: "fetch failed", msg: "No se pudo contactar al servidor. Revisá la conexión." },
];

function lookupFieldMessage(field: string, info: PBValidationInfo): string | null {
  const code = info?.code ?? "";
  const dictionary = FIELD_ERROR_MESSAGES[code];
  if (dictionary) {
    return dictionary[field] ?? dictionary._default ?? info.message ?? null;
  }
  return info?.message ?? null;
}

function lookupNetworkMessage(rawMessage: string): string | null {
  if (!rawMessage) return null;
  const lower = rawMessage.toLowerCase();
  for (const { match, msg } of NETWORK_PATTERNS) {
    if (rawMessage.includes(match) || lower.includes(match.toLowerCase())) {
      return msg;
    }
  }
  return null;
}

/**
 * Mapea un error de PB (o cualquier `unknown`) a un objeto `{ campo: mensaje }`.
 * Si no hay errores por campo, devuelve `{ _global: <mensaje> }`.
 *
 * Pensado para usar en páginas Astro con formulario.
 */
export function mapPBErrorToFieldErrors(
  err: unknown,
  context: ErrorContext = "generic",
): FieldErrors {
  const errors: FieldErrors = {};
  const e = err as PBError;
  const fieldErrors = e?.response?.data ?? {};

  for (const [field, info] of Object.entries(fieldErrors)) {
    const msg = lookupFieldMessage(field, info ?? {});
    if (msg) errors[field] = msg;
  }

  if (Object.keys(errors).length === 0) {
    const raw = e?.message ?? "";
    const networkMsg = lookupNetworkMessage(raw);
    errors._global = networkMsg ?? raw ?? CONTEXT_FALLBACK[context];
    if (!errors._global) errors._global = CONTEXT_FALLBACK[context];
  }

  return errors;
}

/**
 * Mapea un error de PB (o cualquier `unknown`) a un único mensaje string.
 *
 * Estrategia: si hay errores por campo, toma el primero y lo mapea. Si no,
 * intenta detectar errores de red. Si tampoco matchea, devuelve `fallback`
 * o `e.message` (lo que tenga más info).
 *
 * Pensado para endpoints API que devuelven JSON con un solo `error`.
 */
export function mapPBErrorToString(err: unknown, fallback: string): string {
  const e = err as PBError;
  const fieldErrors = e?.response?.data ?? {};
  const firstEntry = Object.entries(fieldErrors)[0];
  if (firstEntry) {
    const [field, info] = firstEntry;
    const msg = lookupFieldMessage(field, info ?? {});
    if (msg) return msg;
  }

  const raw = e?.message ?? "";
  const networkMsg = lookupNetworkMessage(raw);
  if (networkMsg) return networkMsg;

  return raw || fallback;
}
