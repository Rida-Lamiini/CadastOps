import { NextRequest, NextResponse } from "next/server";
import { chromium } from "playwright";
import { getLotDetail } from "@/lib/db/lots";

export const maxDuration = 60;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const lot = await getLotDetail(id);
  if (!lot) {
    return NextResponse.json({ error: "Lot introuvable." }, { status: 404 });
  }

  const printUrl = new URL(`/lots/${id}`, request.nextUrl.origin).toString();

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(printUrl, { waitUntil: "load" });
    await page.waitForTimeout(2000); // let MapLibre finish fetching/painting tiles

    // Chromium's print-to-PDF pipeline doesn't composite WebGL canvases, so
    // the map would render blank in page.pdf(). Screenshot it (which does
    // capture WebGL) and swap it in as a static image before printing.
    const mapHandle = await page.$("[data-map-container]");
    if (mapHandle) {
      const mapPng = await mapHandle.screenshot();
      const dataUrl = `data:image/png;base64,${mapPng.toString("base64")}`;
      await page.evaluate(
        ({ selector, src }) => {
          const el = document.querySelector(selector);
          if (!el) return;
          const img = document.createElement("img");
          img.src = src;
          img.style.width = "100%";
          img.style.display = "block";
          el.replaceWith(img);
        },
        { selector: "[data-map-container]", src: dataUrl },
      );
    }

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "12mm", bottom: "12mm", left: "10mm", right: "10mm" },
    });
    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="lot-${lot.titreFoncier}.pdf"`,
      },
    });
  } finally {
    await browser.close();
  }
}
