import { slugify } from "./slug";

// Constraints — must match pocketbase/pb_migrations/1745784000_create_categories.js
export const CATEGORY_NAME_MAX = 80;
export const CATEGORY_SLUG_MAX = 80;
export const CATEGORY_ICON_MAX = 8;
export const CATEGORY_DESCRIPTION_MAX = 240;
export const CATEGORY_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type CategoryFormData = {
  name: string;
  slug: string;
  icon: string;
  description: string;
  order: number;
  active: boolean;
};

export type CategoryExtractResult = {
  data: CategoryFormData;
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

export function extractCategoryFromForm(form: FormData): CategoryExtractResult {
  const errors: Record<string, string> = {};

  const name = str(form, "name");
  const rawSlug = str(form, "slug");
  const icon = str(form, "icon");
  const description = str(form, "description");
  const orderRaw = str(form, "order");
  const active = checkbox(form, "active");

  // name
  if (!name) {
    errors.name = "El nombre es obligatorio.";
  } else if (name.length > CATEGORY_NAME_MAX) {
    errors.name = `El nombre no puede superar ${CATEGORY_NAME_MAX} caracteres.`;
  }

  // slug: autogenerate if empty, then validate
  const slug = rawSlug || slugify(name);
  if (slug.length > CATEGORY_SLUG_MAX) {
    errors.slug = `El slug no puede superar ${CATEGORY_SLUG_MAX} caracteres.`;
  } else if (slug && !CATEGORY_SLUG_PATTERN.test(slug)) {
    errors.slug =
      "El slug solo puede tener letras minúsculas, números y guiones (ej: mis-mates).";
  }

  // icon (optional)
  if (icon.length > CATEGORY_ICON_MAX) {
    errors.icon = `El icono no puede superar ${CATEGORY_ICON_MAX} caracteres.`;
  }

  // description (optional)
  if (description.length > CATEGORY_DESCRIPTION_MAX) {
    errors.description = `La descripción no puede superar ${CATEGORY_DESCRIPTION_MAX} caracteres.`;
  }

  // order: non-numeric → default 0 (no error; it's a secondary sorting field, not critical)
  const parsedOrder = Number(orderRaw);
  const order = orderRaw === "" || !Number.isFinite(parsedOrder) ? 0 : parsedOrder;

  return {
    data: { name, slug, icon, description, order, active },
    errors,
  };
}
