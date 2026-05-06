// Attribute constraints — must match pocketbase/pb_migrations/1778074417_create_product_attributes.js
export const ATTR_KEY_MAX = 80;
export const ATTR_VALUE_MAX = 500;

export type AttributeInput = { key: string; value: string };

export type AttributeValidationResult =
  | { ok: true; data: AttributeInput }
  | { ok: false; errors: string[] };

/**
 * Valida y sanitiza un par key/value de atributo de producto.
 * - key y value deben ser strings
 * - Se trimea whitespace
 * - key: requerido, máx 80 chars
 * - value: requerido, máx 500 chars
 * - Acumula todos los errores antes de retornar
 */
export function validateAttribute(input: {
  key: unknown;
  value: unknown;
}): AttributeValidationResult {
  const errors: string[] = [];

  // Validar tipos
  if (typeof input.key !== "string") {
    errors.push("El key debe ser un texto.");
  }
  if (typeof input.value !== "string") {
    errors.push("El value debe ser un texto.");
  }

  // Si alguno no es string, no podemos continuar con el resto
  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const key = (input.key as string).trim();
  const value = (input.value as string).trim();

  if (!key) {
    errors.push("El nombre (key) es obligatorio.");
  } else if (key.length > ATTR_KEY_MAX) {
    errors.push(`El nombre (key) no puede superar ${ATTR_KEY_MAX} caracteres.`);
  }

  if (!value) {
    errors.push("El valor (value) es obligatorio.");
  } else if (value.length > ATTR_VALUE_MAX) {
    errors.push(`El valor no puede superar ${ATTR_VALUE_MAX} caracteres.`);
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, data: { key, value } };
}
