import { NextRequest, NextResponse } from "next/server";
import { createLot, listLots } from "@/lib/db/lots";
import { createLotSchema } from "@/lib/validation/lot";

export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams.get("q") ?? undefined;
  const lots = await listLots(search);
  return NextResponse.json({ lots });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = createLotSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  try {
    const id = await createLot({
      ...data,
      dateLeve: data.dateLeve ? new Date(data.dateLeve) : undefined,
    });
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      return NextResponse.json(
        { error: "Un lot avec ce titre foncier existe déjà." },
        { status: 409 },
      );
    }
    throw error;
  }
}
