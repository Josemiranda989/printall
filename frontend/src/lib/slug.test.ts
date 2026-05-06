import { describe, expect, it } from "vitest";
import { slugify } from "./slug";

describe("slugify", () => {
  it("convierte texto plano a slug en lowercase con guiones", () => {
    expect(slugify("Mate con Pico")).toBe("mate-con-pico");
  });

  it("elimina acentos (ñ se convierte a n) y diacríticos", () => {
    expect(slugify("Filamento Rápido Ñoño")).toBe("filamento-rapido-nono");
  });

  it("trata múltiples espacios y símbolos como un solo guión", () => {
    expect(slugify("Mate / Pico   (Negro)")).toBe("mate-pico-negro");
  });

  it("recorta guiones al inicio y al final", () => {
    expect(slugify(" - Mate - ")).toBe("mate");
  });

  it("limita el slug a 120 caracteres", () => {
    const long = "a".repeat(200);
    expect(slugify(long).length).toBeLessThanOrEqual(120);
  });

  it("devuelve string vacío para input vacío", () => {
    expect(slugify("")).toBe("");
  });

  it("devuelve string vacío para puro símbolo", () => {
    expect(slugify("@@@!!!")).toBe("");
  });
});
