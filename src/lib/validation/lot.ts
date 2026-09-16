import { z } from "zod";

export const borneSchema = z.object({
  name: z.string().min(1),
  sequence: z.number().int().nonnegative(),
  xLambert: z.number(),
  yLambert: z.number(),
});

export const distanceCheckSchema = z.object({
  segmentLabel: z.string().min(1),
  croquisM: z.number().nonnegative(),
});

export const referencePointSchema = z.object({
  label: z.string().min(1),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const createLotSchema = z.object({
  titreFoncier: z.string().min(1),
  proprieteDite: z.string().min(1),
  lotNumber: z.string().optional(),
  affaireRef: z.string().optional(),
  geometre: z.string().optional(),
  dateLeve: z.string().optional(),
  serviceCadastre: z.string().optional(),
  surfaceDocumentM2: z.number().nonnegative(),
  correctionLambertM2: z.number(),
  sourcePdfUrl: z.string().optional(),
  bornes: z.array(borneSchema).min(3, "Un polygone nécessite au moins 3 bornes."),
  distanceChecks: z.array(distanceCheckSchema).default([]),
  referencePoints: z.array(referencePointSchema).default([]),
});

export type CreateLotPayload = z.infer<typeof createLotSchema>;
