import { prisma } from "./prisma";
import { setLotGeometry } from "./geometry";
import {
  buildLotGeometry,
  type BorneInput,
  type DistanceCheckInput,
  type ReferencePointInput,
} from "../geo/build-lot";

export interface CreateLotInput {
  titreFoncier: string;
  proprieteDite: string;
  lotNumber?: string;
  affaireRef?: string;
  geometre?: string;
  dateLeve?: Date;
  serviceCadastre?: string;
  surfaceDocumentM2: number;
  correctionLambertM2: number;
  sourcePdfUrl?: string;
  bornes: BorneInput[];
  distanceChecks: DistanceCheckInput[];
  referencePoints: ReferencePointInput[];
}

export async function createLot(input: CreateLotInput): Promise<string> {
  const built = buildLotGeometry(input.bornes, input.distanceChecks, input.referencePoints);

  const lotId = await prisma.$transaction(async (tx) => {
    const lot = await tx.lot.create({
      data: {
        titreFoncier: input.titreFoncier,
        proprieteDite: input.proprieteDite,
        lotNumber: input.lotNumber,
        affaireRef: input.affaireRef,
        geometre: input.geometre,
        dateLeve: input.dateLeve,
        serviceCadastre: input.serviceCadastre,
        surfaceDocumentM2: input.surfaceDocumentM2,
        surfaceCalculeeM2: built.surfaceCalculeeM2,
        correctionLambertM2: input.correctionLambertM2,
        sourcePdfUrl: input.sourcePdfUrl,
      },
    });

    if (built.bornes.length > 0) {
      await tx.borne.createMany({
        data: built.bornes.map((b) => ({
          lotId: lot.id,
          name: b.name,
          sequence: b.sequence,
          xLambert: b.xLambert,
          yLambert: b.yLambert,
          lat: b.lat,
          lng: b.lng,
        })),
      });
    }

    if (built.distanceChecks.length > 0) {
      await tx.distanceCheck.createMany({
        data: built.distanceChecks.map((dc) => ({
          lotId: lot.id,
          segmentLabel: dc.segmentLabel,
          croquisM: dc.croquisM,
          calculeM: dc.calculeM,
          ecartM: dc.ecartM,
        })),
      });
    }

    if (built.referencePoints.length > 0) {
      await tx.referencePoint.createMany({
        data: built.referencePoints.map((rp) => ({
          lotId: lot.id,
          label: rp.label,
          lat: rp.lat,
          lng: rp.lng,
          distanceM: rp.distanceM,
          bearingDeg: rp.bearingDeg,
        })),
      });
    }

    if (built.polygonRingLatLng.length >= 3) {
      await setLotGeometry(lot.id, built.polygonRingLatLng, built.centroid, tx);
    }

    return lot.id;
  });

  return lotId;
}

export interface LotListItem {
  id: string;
  titreFoncier: string;
  proprieteDite: string;
  surfaceDocumentM2: number;
  surfaceCalculeeM2: number;
  correctionLambertM2: number;
  updatedAt: Date;
  conforme: boolean;
}

const SURFACE_CONFORMITY_TOLERANCE_M2 = 1.0;

export async function listLots(search?: string): Promise<LotListItem[]> {
  const lots = await prisma.lot.findMany({
    where: search
      ? {
          OR: [
            { titreFoncier: { contains: search, mode: "insensitive" } },
            { proprieteDite: { contains: search, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: { updatedAt: "desc" },
  });

  return lots.map((lot) => {
    const surfaceCalculeeM2 = Number(lot.surfaceCalculeeM2);
    const correctionLambertM2 = Number(lot.correctionLambertM2);
    const surfaceDocumentM2 = Number(lot.surfaceDocumentM2);
    const ecart = surfaceCalculeeM2 + correctionLambertM2 - surfaceDocumentM2;
    return {
      id: lot.id,
      titreFoncier: lot.titreFoncier,
      proprieteDite: lot.proprieteDite,
      surfaceDocumentM2,
      surfaceCalculeeM2,
      correctionLambertM2,
      updatedAt: lot.updatedAt,
      conforme: Math.abs(ecart) <= SURFACE_CONFORMITY_TOLERANCE_M2,
    };
  });
}

export async function getLotDetail(id: string) {
  const lot = await prisma.lot.findUnique({
    where: { id },
    include: {
      bornes: { orderBy: { sequence: "asc" } },
      distanceChecks: true,
      referencePoints: true,
    },
  });
  return lot;
}
