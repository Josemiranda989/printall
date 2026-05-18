import { MATERIAL_KIND_VALUES, type MaterialKind } from "./types";

export const MATERIAL_NAME_MAX = 60;

const VALID_KIND = new Set<string>(MATERIAL_KIND_VALUES);

export type MaterialFormData = {
  name: string;
  kind: MaterialKind;
  cost_price: number;
  sell_price: number;
  colors?: string;
  active: boolean;
};

export type ExtractMaterialResult = {
  data: MaterialFormData;
  errors: Record<string, string>;
};

function str(form: FormData, key: string): string {
  const v = form.get(key);
  return typeof v === "string" ? v.trim() : "";
}

function checkbox(form: FormData, key: string): boolean {
  const v = form.get(key);
  return v === "on" || v === "true" || v === "1";
}

function parsePrice(raw: string): { value: number; error: string | null } {
  if (!raw) return { value: 0, error: "obligatorio" };
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return { value: 0, error: "debe ser un número" };
  if (parsed < 0) return { value: 0, error: "no puede ser negativo" };
  return { value: parsed, error: null };
}

/** Normaliza un CSV de colores: trim + lowercase + dedupe, devuelve "" si vacío. */
function normalizeColors(raw: string): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(",")) {
    const c = part.trim().toLowerCase();
    if (!c || seen.has(c)) continue;
    seen.add(c);
    out.push(c);
  }
  return out.join(", ");
}

export function extractMaterialFromForm(form: FormData): ExtractMaterialResult {
  const errors: Record<string, string> = {};

  const name = str(form, "name");
  const kindRaw = str(form, "kind");
  const costRaw = str(form, "cost_price");
  const sellRaw = str(form, "sell_price");
  const colors = normalizeColors(str(form, "colors"));
  const active = checkbox(form, "active");

  if (!name) {
    errors.name = "El nombre es obligatorio.";
  } else if (name.length > MATERIAL_NAME_MAX) {
    errors.name = `Máximo ${MATERIAL_NAME_MAX} caracteres.`;
  }

  let kind: MaterialKind = "filament";
  if (!kindRaw) {
    errors.kind = "Elegí un tipo de material.";
  } else if (!VALID_KIND.has(kindRaw)) {
    errors.kind = "Tipo inválido.";
  } else {
    kind = kindRaw as MaterialKind;
  }

  const costParsed = parsePrice(costRaw);
  if (costParsed.error) {
    errors.cost_price = `El precio costo ${costParsed.error}.`;
  }

  const sellParsed = parsePrice(sellRaw);
  if (sellParsed.error) {
    errors.sell_price = `El precio venta ${sellParsed.error}.`;
  }

  return {
    data: {
      name,
      kind,
      cost_price: costParsed.value,
      sell_price: sellParsed.value,
      colors,
      active,
    },
    errors,
  };
}
