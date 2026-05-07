import { describe, expect, it } from "vitest";
import { mapPBErrorToFieldErrors, mapPBErrorToString } from "./admin-errors";

function pbError(data: Record<string, { code?: string; message?: string }>, message = "validation_error") {
  return { message, response: { data } };
}

describe("mapPBErrorToFieldErrors", () => {
  describe("validation_not_unique", () => {
    it("mapea slug duplicado a mensaje específico", () => {
      const err = pbError({ slug: { code: "validation_not_unique", message: "Value already exists." } });
      const errors = mapPBErrorToFieldErrors(err, "category");
      expect(errors).toEqual({ slug: "Ese slug ya existe. Elegí uno diferente." });
    });

    it("mapea name duplicado a mensaje específico", () => {
      const err = pbError({ name: { code: "validation_not_unique", message: "..." } });
      const errors = mapPBErrorToFieldErrors(err, "product");
      expect(errors).toEqual({ name: "Ese nombre ya está en uso." });
    });

    it("usa fallback _default para campos no mapeados", () => {
      const err = pbError({ custom_field: { code: "validation_not_unique", message: "..." } });
      const errors = mapPBErrorToFieldErrors(err, "product");
      expect(errors.custom_field).toBe("Ese valor ya existe — tiene que ser único.");
    });
  });

  describe("validation_required", () => {
    it("mapea campo requerido", () => {
      const err = pbError({ name: { code: "validation_required", message: "required" } });
      const errors = mapPBErrorToFieldErrors(err, "product");
      expect(errors.name).toBe("Este campo es obligatorio.");
    });
  });

  describe("validation_min_text_constraint / validation_max_text_constraint", () => {
    it("mapea texto demasiado corto", () => {
      const err = pbError({ description: { code: "validation_min_text_constraint", message: "too short" } });
      const errors = mapPBErrorToFieldErrors(err, "product");
      expect(errors.description).toBe("Demasiado corto.");
    });

    it("mapea texto demasiado largo", () => {
      const err = pbError({ name: { code: "validation_max_text_constraint", message: "too long" } });
      const errors = mapPBErrorToFieldErrors(err, "product");
      expect(errors.name).toBe("Demasiado largo.");
    });
  });

  describe("validation_min_number_constraint", () => {
    it("mapea precio negativo a mensaje específico", () => {
      const err = pbError({ price: { code: "validation_min_number_constraint", message: "..." } });
      const errors = mapPBErrorToFieldErrors(err, "product");
      expect(errors.price).toBe("El precio no puede ser negativo.");
    });

    it("usa fallback para otros campos numéricos", () => {
      const err = pbError({ order: { code: "validation_min_number_constraint", message: "..." } });
      const errors = mapPBErrorToFieldErrors(err, "category");
      expect(errors.order).toBe("Valor numérico demasiado bajo.");
    });
  });

  describe("validation_missing_rel_records", () => {
    it("mapea categoría inexistente", () => {
      const err = pbError({ category: { code: "validation_missing_rel_records", message: "..." } });
      const errors = mapPBErrorToFieldErrors(err, "product");
      expect(errors.category).toBe("La categoría seleccionada no existe.");
    });
  });

  describe("validation_invalid_value", () => {
    it("mapea valor inválido genérico", () => {
      const err = pbError({ stock_status: { code: "validation_invalid_value", message: "..." } });
      const errors = mapPBErrorToFieldErrors(err, "product");
      expect(errors.stock_status).toBe("Valor inválido.");
    });
  });

  describe("códigos desconocidos", () => {
    it("usa el message original de PB si el code no está mapeado", () => {
      const err = pbError({ weird_field: { code: "unknown_pb_code", message: "Some PB-specific text" } });
      const errors = mapPBErrorToFieldErrors(err, "product");
      expect(errors.weird_field).toBe("Some PB-specific text");
    });

    it("ignora campos sin code ni message", () => {
      const err = pbError({ ghost: {} });
      const errors = mapPBErrorToFieldErrors(err, "product");
      expect(errors).toEqual({ _global: "validation_error" });
    });
  });

  describe("errores de red (sin response.data)", () => {
    it("mapea ECONNREFUSED", () => {
      const err = { message: "fetch failed: ECONNREFUSED 127.0.0.1:8090" };
      const errors = mapPBErrorToFieldErrors(err, "product");
      expect(errors._global).toBe("No se pudo conectar al servidor. ¿Está corriendo PocketBase?");
    });

    it("mapea ENOTFOUND", () => {
      const err = { message: "getaddrinfo ENOTFOUND pocketbase" };
      const errors = mapPBErrorToFieldErrors(err, "product");
      expect(errors._global).toBe("Servidor no encontrado. Revisá la conexión.");
    });

    it("mapea timeout (case-insensitive)", () => {
      const err = { message: "The operation was aborted due to timeout" };
      const errors = mapPBErrorToFieldErrors(err, "product");
      expect(errors._global).toBe("El servidor tardó demasiado en responder. Intentá de nuevo.");
    });

    it("mapea fetch failed genérico", () => {
      const err = { message: "fetch failed" };
      const errors = mapPBErrorToFieldErrors(err, "product");
      expect(errors._global).toBe("No se pudo contactar al servidor. Revisá la conexión.");
    });
  });

  describe("fallbacks de contexto", () => {
    it("usa fallback de product cuando no hay message ni response", () => {
      const errors = mapPBErrorToFieldErrors({}, "product");
      expect(errors._global).toBe("No se pudo guardar el producto.");
    });

    it("usa fallback de category", () => {
      const errors = mapPBErrorToFieldErrors({}, "category");
      expect(errors._global).toBe("No se pudo guardar la categoría.");
    });

    it("usa fallback de attribute", () => {
      const errors = mapPBErrorToFieldErrors({}, "attribute");
      expect(errors._global).toBe("No se pudo guardar el atributo.");
    });

    it("usa fallback de image", () => {
      const errors = mapPBErrorToFieldErrors({}, "image");
      expect(errors._global).toBe("No se pudo procesar la imagen.");
    });

    it("default a generic", () => {
      const errors = mapPBErrorToFieldErrors({});
      expect(errors._global).toBe("No se pudo completar la operación.");
    });
  });

  describe("entradas no estándar", () => {
    it("tolera null", () => {
      const errors = mapPBErrorToFieldErrors(null, "product");
      expect(errors._global).toBe("No se pudo guardar el producto.");
    });

    it("tolera undefined", () => {
      const errors = mapPBErrorToFieldErrors(undefined, "product");
      expect(errors._global).toBe("No se pudo guardar el producto.");
    });

    it("acumula múltiples campos", () => {
      const err = pbError({
        name: { code: "validation_required" },
        slug: { code: "validation_not_unique" },
      });
      const errors = mapPBErrorToFieldErrors(err, "product");
      expect(errors).toEqual({
        name: "Este campo es obligatorio.",
        slug: "Ese slug ya existe. Elegí uno diferente.",
      });
    });
  });
});

describe("mapPBErrorToString", () => {
  it("toma el primer error de campo y lo mapea", () => {
    const err = pbError({ slug: { code: "validation_not_unique" } });
    expect(mapPBErrorToString(err, "fallback")).toBe("Ese slug ya existe. Elegí uno diferente.");
  });

  it("mapea errores de red sin response.data", () => {
    const err = { message: "ECONNREFUSED" };
    expect(mapPBErrorToString(err, "fallback")).toBe(
      "No se pudo conectar al servidor. ¿Está corriendo PocketBase?",
    );
  });

  it("usa el message original si no hay code mapeado y no es error de red", () => {
    const err = { message: "Some PB error" };
    expect(mapPBErrorToString(err, "fallback")).toBe("Some PB error");
  });

  it("usa el fallback si no hay message ni response", () => {
    expect(mapPBErrorToString({}, "Error al subir imágenes.")).toBe("Error al subir imágenes.");
  });

  it("tolera null y undefined", () => {
    expect(mapPBErrorToString(null, "fallback")).toBe("fallback");
    expect(mapPBErrorToString(undefined, "fallback")).toBe("fallback");
  });

  it("usa info.message si el code no está mapeado", () => {
    const err = pbError({ x: { code: "unknown_code", message: "Specific PB text" } });
    expect(mapPBErrorToString(err, "fallback")).toBe("Specific PB text");
  });
});
