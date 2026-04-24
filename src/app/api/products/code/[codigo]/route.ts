import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPriceSettings } from "@/lib/settings";
import { withPrices } from "@/lib/pricing";

export async function GET(_: Request, { params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  const product = await prisma.product.findUnique({
    where: { code: decodeURIComponent(codigo) },
    include: { category: true, provider: true, stock: true },
  });
  if (!product) return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
  return NextResponse.json(withPrices(product, await getPriceSettings()));
}
