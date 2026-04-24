import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPriceSettings } from "@/lib/settings";
import { publicProduct } from "@/lib/pricing";

export async function GET() {
  const settings = await getPriceSettings();
  const products = await prisma.product.findMany({
    where: { active: true },
    include: { category: true, provider: true, stock: true },
    orderBy: { code: "asc" },
  });
  return NextResponse.json(products.map((product) => publicProduct(product, settings)));
}
