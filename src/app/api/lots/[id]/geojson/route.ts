import { NextResponse } from "next/server";
import { getLotFeatureCollection } from "@/lib/db/lot-features";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const collection = await getLotFeatureCollection(id);
  if (!collection) {
    return NextResponse.json({ error: "Lot introuvable." }, { status: 404 });
  }
  return NextResponse.json(collection);
}
