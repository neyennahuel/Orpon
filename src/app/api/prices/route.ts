import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPriceSettings } from "@/lib/settings";
import { withPrices } from "@/lib/pricing";

export async function GET() {
  const settings = await getPriceSettings();
  const products = await prisma.product.findMany({
    include: { category: true, provider: true, stock: true },
    orderBy: { code: "asc" },
  });
  return NextResponse.json(products.map((product) => withPrices(product, settings)));
}
