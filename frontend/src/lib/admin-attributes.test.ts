import { describe, expect, it } from "vitest";
import { validateAttribute, ATTR_KEY_MAX, ATTR_VALUE_MAX } from "./admin-attributes";

describe("validateAttribute", () => {
  it("key + value normales → ok: true con data saneada", () => {
    const result = validateAttribute({ key: "color", value: "negro" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.key).toBe("color");
      expect(result.data.value).toBe("negro");
    }
  });

  it("trims whitespace en key y value", () => {
    const result = validateAttribute({ key: "  color  ", value: "  negro  " });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.key).toBe("color");
      expect(result.data.value).toBe("negro");
    }
  });

  it("key vacío después de trim → ok: false con error", () => {
    const result = validateAttribute({ key: "   ", value: "negro" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((e) => /key|nombre|clave/i.test(e))).toBe(true);
    }
  });

  it("value vacío después de trim → ok: false con error", () => {
    const result = validateAttribute({ key: "color", value: "   " });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((e) => /value|valor/i.test(e))).toBe(true);
    }
  });

  it("key string vacío → ok: false", () => {
    const result = validateAttribute({ key: "", value: "negro" });
    expect(result.ok).toBe(false);
  });

  it("value string vacío → ok: false", () => {
    const result = validateAttribute({ key: "color", value: "" });
    expect(result.ok).toBe(false);
  });

  it("key > 80 chars → ok: false con error de longitud", () => {
    const longKey = "a".repeat(ATTR_KEY_MAX + 1);
    const result = validateAttribute({ key: longKey, value: "negro" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => /80|key|nombre|clave/i.test(e))).toBe(true);
    }
  });

  it("value > 500 chars → ok: false con error de longitud", () => {
    const longValue = "a".repeat(ATTR_VALUE_MAX + 1);
    const result = validateAttribute({ key: "color", value: longValue });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => /500|value|valor/i.test(e))).toBe(true);
    }
  });

  it("key exactamente 80 chars → ok: true (límite inclusive)", () => {
    const key = "a".repeat(ATTR_KEY_MAX);
    const result = validateAttribute({ key, value: "negro" });
    expect(result.ok).toBe(true);
  });

  it("value exactamente 500 chars → ok: true (límite inclusive)", () => {
    const value = "a".repeat(ATTR_VALUE_MAX);
    const result = validateAttribute({ key: "color", value });
    expect(result.ok).toBe(true);
  });

  it("key es number (no string) → ok: false", () => {
    const result = validateAttribute({ key: 42, value: "negro" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.length).toBeGreaterThan(0);
    }
  });

  it("key es null → ok: false", () => {
    const result = validateAttribute({ key: null, value: "negro" });
    expect(result.ok).toBe(false);
  });

  it("key es undefined → ok: false", () => {
    const result = validateAttribute({ key: undefined, value: "negro" });
    expect(result.ok).toBe(false);
  });

  it("value es number (no string) → ok: false", () => {
    const result = validateAttribute({ key: "color", value: 42 });
    expect(result.ok).toBe(false);
  });

  it("value es null → ok: false", () => {
    const result = validateAttribute({ key: "color", value: null });
    expect(result.ok).toBe(false);
  });

  it("key y value en límites exactos → ok: true con data correcta", () => {
    const key = "b".repeat(ATTR_KEY_MAX);
    const value = "c".repeat(ATTR_VALUE_MAX);
    const result = validateAttribute({ key, value });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.key).toBe(key);
      expect(result.data.value).toBe(value);
    }
  });

  it("acumula múltiples errores (key no string + value no string)", () => {
    const result = validateAttribute({ key: null, value: null });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
    }
  });
});
