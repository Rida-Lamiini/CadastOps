import "dotenv/config";
import { createLot } from "../src/lib/db/lots";
import { prisma } from "../src/lib/db/prisma";

/**
 * Seed: Lot 533 (Titre foncier 49539, "SAPINO 533").
 * Aggregate figures (surface, correction Lambert, distance-check deltas,
 * reference point) come from the source document; individual borne
 * Lambert X/Y below are illustrative values fitted to reproduce those
 * documented totals, since per-borne coordinates weren't provided.
 */
async function main() {
  const existing = await prisma.lot.findUnique({ where: { titreFoncier: "49539" } });
  if (existing) {
    console.log("Lot 533 (Titre 49539) already exists — skipping seed.");
    return;
  }

  // Base offset places the lot ~290m from the "Biocodex Maroc" reference
  // point (Lambert X≈297808, Y≈309636) rather than at an arbitrary origin.
  const baseX = 297558.0;
  const baseY = 309486.0;
  const bornes = [
    { name: "B3452", sequence: 0, xLambert: baseX + 0.0, yLambert: baseY + 0.0 },
    { name: "B3453bis", sequence: 1, xLambert: baseX + 42.0, yLambert: baseY - 3.5 },
    { name: "B3453", sequence: 2, xLambert: baseX + 85.0, yLambert: baseY + 0.0 },
    { name: "B3454", sequence: 3, xLambert: baseX + 104.0, yLambert: baseY + 45.0 },
    { name: "B3455", sequence: 4, xLambert: baseX + 104.0, yLambert: baseY + 105.0 },
    { name: "B3456", sequence: 5, xLambert: baseX + 55.0, yLambert: baseY + 109.377 },
    { name: "B3457", sequence: 6, xLambert: baseX + 15.0, yLambert: baseY + 105.0 },
    { name: "B3458", sequence: 7, xLambert: baseX + 0.0, yLambert: baseY + 60.0 },
    { name: "B3451bis", sequence: 8, xLambert: baseX + 0.0, yLambert: baseY + 25.0 },
  ];

  const distanceChecks = [
    { segmentLabel: "B3452-B3453", croquisM: 84.97 },
    { segmentLabel: "B3452-B3454", croquisM: 113.35 },
    { segmentLabel: "B3452-B3455", croquisM: 147.82 },
    { segmentLabel: "B3452-B3456", croquisM: 122.4 },
    { segmentLabel: "B3452-B3457", croquisM: 106.1 },
    { segmentLabel: "B3452-B3458", croquisM: 59.96 },
  ];

  const referencePoints = [{ label: "Biocodex Maroc", lat: 33.3653297, lng: -7.5719223 }];

  const id = await createLot({
    titreFoncier: "49539",
    proprieteDite: "SAPINO 533",
    lotNumber: "533",
    surfaceDocumentM2: 10506,
    correctionLambertM2: 7.75,
    bornes,
    distanceChecks,
    referencePoints,
  });

  console.log(`Seeded Lot 533 (Titre 49539) — id ${id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
