import { z } from "zod";

export const productSchema = z.object({
  code: z.string().trim().min(1, "El codigo es obligatorio"),
  description: z.string().trim().min(1, "La descripcion es obligatoria"),
  categoryName: z.string().trim().min(1, "La categoria es obligatoria"),
  providerName: z.string().trim().min(1, "El proveedor es obligatorio"),
  costPrice: z.coerce.number().min(0, "El costo no puede ser negativo"),
  unitMeasure: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
  active: z.coerce.boolean().default(true),
});

export const settingsSchema = z.object({
  wholesalePercentage: z.coerce.number().min(0).max(999),
  retailPercentage: z.coerce.number().min(0).max(999),
  promo1Percentage: z.coerce.number().min(0).max(999),
  promo2Percentage: z.coerce.number().min(0).max(999),
});

export const stockMovementSchema = z.object({
  productId: z.coerce.number().int().positive(),
  movementType: z.enum(["entrada", "salida", "ajuste"]),
  quantity: z.coerce.number().positive("La cantidad debe ser mayor a cero"),
  reason: z.string().trim().min(1, "El motivo es obligatorio"),
  notes: z.string().trim().optional().nullable(),
});
