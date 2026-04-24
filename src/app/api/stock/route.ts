import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const rows = await prisma.stock.findMany({
    include: { product: { include: { category: true, provider: true } } },
    orderBy: { product: { code: "asc" } },
  });
  return NextResponse.json(
    rows.map((row) => ({
      productId: row.productId,
      code: row.product.code,
      description: row.product.description,
      category: row.product.category.name,
      provider: row.product.provider.name,
      currentQuantity: Number(row.currentQuantity),
      updatedAt: row.updatedAt,
    })),
  );
}
