import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const rows = await prisma.stock.findMany({
    where: { product: { active: true } },
    include: { product: true },
    orderBy: { product: { code: "asc" } },
  });
  return NextResponse.json(
    rows.map((row) => ({
      productId: row.productId,
      code: row.product.code,
      description: row.product.description,
      stockQuantity: Number(row.currentQuantity),
    })),
  );
}
