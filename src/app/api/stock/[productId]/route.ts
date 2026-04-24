import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_: Request, { params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;
  const stock = await prisma.stock.upsert({
    where: { productId: Number(productId) },
    update: {},
    create: { productId: Number(productId), currentQuantity: 0 },
  });
  return NextResponse.json({ ...stock, currentQuantity: Number(stock.currentQuantity) });
}
