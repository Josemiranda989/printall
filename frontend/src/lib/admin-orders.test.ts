import { describe, expect, it } from "vitest";
import {
  validatePaidPatch,
  validatePriorityPatch,
  validateProgressPatch,
  validateStatusPatch,
} from "./admin-orders";

// ─── validateStatusPatch ──────────────────────────────────────────────
describe("validateStatusPatch", () => {
  it.each(["pending", "in_progress", "completed", "delivered", "cancelled"])(
    'acepta status válido "%s"',
    (status) => {
      const result = validateStatusPatch({ status });
      expect(result).toEqual({ ok: true, status });
    },
  );

  it("falla si body no es object", () => {
    expect(validateStatusPatch(null)).toEqual({ ok: false, error: "Body inválido." });
    expect(validateStatusPatch(undefined)).toEqual({ ok: false, error: "Body inválido." });
    expect(validateStatusPatch("string")).toEqual({ ok: false, error: "Body inválido." });
    expect(validateStatusPatch(42)).toEqual({ ok: false, error: "Body inválido." });
  });

  it("falla si status no es string", () => {
    expect(validateStatusPatch({ status: 1 })).toMatchObject({ ok: false });
    expect(validateStatusPatch({ status: null })).toMatchObject({ ok: false });
    expect(validateStatusPatch({ status: true })).toMatchObject({ ok: false });
  });

  it("falla si status no está en el set de válidos", () => {
    expect(validateStatusPatch({ status: "foo" })).toEqual({
      ok: false,
      error: "Estado inválido.",
    });
  });

  it("falla con casing distinto — el set es case-sensitive", () => {
    // Razón: PocketBase guarda el enum en lowercase. Cualquier otra forma rompe el contrato.
    expect(validateStatusPatch({ status: "Pending" })).toMatchObject({ ok: false });
    expect(validateStatusPatch({ status: "PENDING" })).toMatchObject({ ok: false });
  });

  it("falla si falta el campo status", () => {
    expect(validateStatusPatch({})).toMatchObject({ ok: false });
  });
});

// ─── validatePriorityPatch ────────────────────────────────────────────
describe("validatePriorityPatch", () => {
  it.each(["high", "medium", "low"])('acepta priority válida "%s"', (priority) => {
    const result = validatePriorityPatch({ priority });
    expect(result).toEqual({ ok: true, priority });
  });

  it("falla si body no es object", () => {
    expect(validatePriorityPatch(null)).toEqual({ ok: false, error: "Body inválido." });
    expect(validatePriorityPatch(undefined)).toEqual({ ok: false, error: "Body inválido." });
  });

  it("falla si priority no es string", () => {
    expect(validatePriorityPatch({ priority: 1 })).toMatchObject({ ok: false });
    expect(validatePriorityPatch({ priority: null })).toMatchObject({ ok: false });
  });

  it("falla si priority no está en el set de válidos", () => {
    expect(validatePriorityPatch({ priority: "urgent" })).toEqual({
      ok: false,
      error: "Prioridad inválida.",
    });
  });

  it("falla si falta el campo priority", () => {
    expect(validatePriorityPatch({})).toMatchObject({ ok: false });
  });
});

// ─── validatePaidPatch ────────────────────────────────────────────────
// Foco principal de los tests: este validator fue modificado para aceptar
// dos formatos (toggle is_paid o monto custom paid_amount).
describe("validatePaidPatch", () => {
  describe("formato { is_paid: boolean }", () => {
    it("acepta is_paid: true", () => {
      expect(validatePaidPatch({ is_paid: true })).toEqual({ ok: true, is_paid: true });
    });

    it("acepta is_paid: false", () => {
      expect(validatePaidPatch({ is_paid: false })).toEqual({ ok: true, is_paid: false });
    });

    it("falla si is_paid no es boolean (string)", () => {
      expect(validatePaidPatch({ is_paid: "true" })).toMatchObject({ ok: false });
    });

    it("falla si is_paid no es boolean (number)", () => {
      expect(validatePaidPatch({ is_paid: 1 })).toMatchObject({ ok: false });
    });

    it("falla si is_paid no es boolean (null)", () => {
      expect(validatePaidPatch({ is_paid: null })).toMatchObject({ ok: false });
    });
  });

  describe("formato { paid_amount: number }", () => {
    it("acepta paid_amount positivo", () => {
      expect(validatePaidPatch({ paid_amount: 1000 })).toEqual({
        ok: true,
        paid_amount: 1000,
      });
    });

    it("acepta paid_amount = 0", () => {
      // Razón: explícitamente válido para limpiar una seña previa sin desmarcar el toggle.
      // El endpoint clampea y deriva is_paid correctamente.
      expect(validatePaidPatch({ paid_amount: 0 })).toEqual({ ok: true, paid_amount: 0 });
    });

    it("acepta paid_amount con decimales (precio en ARS con centavos)", () => {
      expect(validatePaidPatch({ paid_amount: 999.99 })).toEqual({
        ok: true,
        paid_amount: 999.99,
      });
    });

    it("falla si paid_amount es negativo", () => {
      expect(validatePaidPatch({ paid_amount: -100 })).toEqual({
        ok: false,
        error: "paid_amount debe ser un número >= 0.",
      });
    });

    it("falla si paid_amount es Infinity", () => {
      expect(validatePaidPatch({ paid_amount: Infinity })).toMatchObject({ ok: false });
    });

    it("falla si paid_amount es -Infinity", () => {
      expect(validatePaidPatch({ paid_amount: -Infinity })).toMatchObject({ ok: false });
    });

    it("falla si paid_amount es NaN", () => {
      expect(validatePaidPatch({ paid_amount: NaN })).toMatchObject({ ok: false });
    });

    it("falla si paid_amount es string (aunque parsee a número)", () => {
      // Razón: el contrato es estricto, el cliente debe enviar number.
      // Aceptar strings abriría la puerta a "abc" o "" rompiendo en el clamp del endpoint.
      expect(validatePaidPatch({ paid_amount: "1000" })).toMatchObject({ ok: false });
    });

    it("falla si paid_amount es null", () => {
      // null !== undefined, así que entra a la rama de paid_amount pero falla el typeof.
      expect(validatePaidPatch({ paid_amount: null })).toMatchObject({ ok: false });
    });
  });

  describe("precedencia cuando vienen ambos", () => {
    it("gana paid_amount si vienen ambos campos", () => {
      // Razón: documentado en el JSDoc del validator. paid_amount es más específico.
      const result = validatePaidPatch({ paid_amount: 500, is_paid: true });
      expect(result).toEqual({ ok: true, paid_amount: 500 });
    });

    it("paid_amount inválido NO cae a is_paid como fallback", () => {
      // Razón: si paid_amount está presente pero es inválido, el body es ambiguo
      // y debe fallar. No queremos silenciosamente caer al toggle.
      expect(validatePaidPatch({ paid_amount: -1, is_paid: true })).toMatchObject({
        ok: false,
      });
    });
  });

  describe("body inválido", () => {
    it("falla si body no es object", () => {
      expect(validatePaidPatch(null)).toEqual({ ok: false, error: "Body inválido." });
      expect(validatePaidPatch(undefined)).toEqual({ ok: false, error: "Body inválido." });
      expect(validatePaidPatch("string")).toEqual({ ok: false, error: "Body inválido." });
    });

    it("falla si body está vacío (sin is_paid ni paid_amount)", () => {
      expect(validatePaidPatch({})).toEqual({
        ok: false,
        error: "Falta is_paid o paid_amount.",
      });
    });

    it("falla si body tiene campos irrelevantes", () => {
      expect(validatePaidPatch({ foo: "bar" })).toMatchObject({ ok: false });
    });
  });
});

// ─── validateProgressPatch ────────────────────────────────────────────
describe("validateProgressPatch", () => {
  describe("formato { units_done: number }", () => {
    it("acepta units_done positivo", () => {
      expect(validateProgressPatch({ units_done: 5 })).toEqual({ ok: true, units_done: 5 });
    });

    it("acepta units_done = 0", () => {
      expect(validateProgressPatch({ units_done: 0 })).toEqual({ ok: true, units_done: 0 });
    });

    it("falla si units_done es negativo", () => {
      expect(validateProgressPatch({ units_done: -1 })).toEqual({
        ok: false,
        error: "units_done debe ser un entero >= 0.",
      });
    });

    it("falla si units_done no es entero (decimal)", () => {
      // Razón: cantidades de unidades fabricadas son discretas (1 mate, 2 mates...).
      // 1.5 no tiene sentido en este dominio.
      expect(validateProgressPatch({ units_done: 1.5 })).toMatchObject({ ok: false });
    });

    it("falla si units_done es string", () => {
      expect(validateProgressPatch({ units_done: "5" })).toMatchObject({ ok: false });
    });

    it("falla si units_done es NaN", () => {
      expect(validateProgressPatch({ units_done: NaN })).toMatchObject({ ok: false });
    });
  });

  describe("formato { delta: number }", () => {
    it("acepta delta positivo (+1)", () => {
      expect(validateProgressPatch({ delta: 1 })).toEqual({ ok: true, delta: 1 });
    });

    it("acepta delta negativo (-1)", () => {
      expect(validateProgressPatch({ delta: -1 })).toEqual({ ok: true, delta: -1 });
    });

    it("acepta delta = 0 (no-op pero válido contractualmente)", () => {
      // Razón: el endpoint hace clamp, así que un delta 0 es seguro. El validator
      // no asume el uso; solo verifica el tipo.
      expect(validateProgressPatch({ delta: 0 })).toEqual({ ok: true, delta: 0 });
    });

    it("falla si delta no es entero", () => {
      expect(validateProgressPatch({ delta: 0.5 })).toEqual({
        ok: false,
        error: "delta debe ser un entero.",
      });
    });

    it("falla si delta es string", () => {
      expect(validateProgressPatch({ delta: "1" })).toMatchObject({ ok: false });
    });

    it("falla si delta es NaN", () => {
      expect(validateProgressPatch({ delta: NaN })).toMatchObject({ ok: false });
    });
  });

  describe("precedencia cuando vienen ambos", () => {
    it("gana delta si vienen ambos campos", () => {
      // Razón: delta primero en la rama if del código. Documentado implícitamente
      // por el orden de evaluación.
      const result = validateProgressPatch({ delta: 1, units_done: 10 });
      expect(result).toEqual({ ok: true, delta: 1 });
    });

    it("delta inválido NO cae a units_done como fallback", () => {
      expect(validateProgressPatch({ delta: 1.5, units_done: 10 })).toMatchObject({
        ok: false,
      });
    });
  });

  describe("body inválido", () => {
    it("falla si body no es object", () => {
      expect(validateProgressPatch(null)).toEqual({ ok: false, error: "Body inválido." });
      expect(validateProgressPatch(undefined)).toEqual({ ok: false, error: "Body inválido." });
    });

    it("falla si body está vacío (sin units_done ni delta)", () => {
      expect(validateProgressPatch({})).toEqual({
        ok: false,
        error: "Falta units_done o delta.",
      });
    });

    it("falla si body tiene campos irrelevantes", () => {
      expect(validateProgressPatch({ foo: "bar" })).toMatchObject({ ok: false });
    });
  });
});
