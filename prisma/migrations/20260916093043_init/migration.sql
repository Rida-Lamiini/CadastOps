-- CreateTable
CREATE TABLE "lots" (
    "id" TEXT NOT NULL,
    "titre_foncier" TEXT NOT NULL,
    "propriete_dite" TEXT NOT NULL,
    "lot_number" TEXT,
    "affaire_ref" TEXT,
    "geometre" TEXT,
    "date_leve" TIMESTAMP(3),
    "service_cadastre" TEXT,
    "surface_document_m2" DECIMAL(12,2) NOT NULL,
    "surface_calculee_m2" DECIMAL(12,2) NOT NULL,
    "correction_lambert_m2" DECIMAL(12,2) NOT NULL,
    "polygon" geometry(Polygon, 4326),
    "centroid" geometry(Point, 4326),
    "source_pdf_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bornes" (
    "id" TEXT NOT NULL,
    "lot_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "x_lambert" DECIMAL(12,3) NOT NULL,
    "y_lambert" DECIMAL(12,3) NOT NULL,
    "lat" DECIMAL(10,7) NOT NULL,
    "lng" DECIMAL(10,7) NOT NULL,

    CONSTRAINT "bornes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "distance_checks" (
    "id" TEXT NOT NULL,
    "lot_id" TEXT NOT NULL,
    "segment_label" TEXT NOT NULL,
    "croquis_m" DECIMAL(10,3) NOT NULL,
    "calcule_m" DECIMAL(10,3) NOT NULL,
    "ecart_m" DECIMAL(10,3) NOT NULL,

    CONSTRAINT "distance_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reference_points" (
    "id" TEXT NOT NULL,
    "lot_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "lat" DECIMAL(10,7) NOT NULL,
    "lng" DECIMAL(10,7) NOT NULL,
    "distance_m" DECIMAL(10,3) NOT NULL,
    "bearing_deg" DECIMAL(6,2) NOT NULL,

    CONSTRAINT "reference_points_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "lots_titre_foncier_key" ON "lots"("titre_foncier");

-- CreateIndex
CREATE INDEX "bornes_lot_id_idx" ON "bornes"("lot_id");

-- CreateIndex
CREATE UNIQUE INDEX "bornes_lot_id_sequence_key" ON "bornes"("lot_id", "sequence");

-- CreateIndex
CREATE INDEX "distance_checks_lot_id_idx" ON "distance_checks"("lot_id");

-- CreateIndex
CREATE INDEX "reference_points_lot_id_idx" ON "reference_points"("lot_id");

-- AddForeignKey
ALTER TABLE "bornes" ADD CONSTRAINT "bornes_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "lots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "distance_checks" ADD CONSTRAINT "distance_checks_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "lots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reference_points" ADD CONSTRAINT "reference_points_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "lots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
