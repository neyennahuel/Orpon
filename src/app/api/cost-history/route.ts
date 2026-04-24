import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const rows = await prisma.costUpdateHistory.findMany({
    include: { product: { include: { provider: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return NextResponse.json(
    rows.map((row) => ({
      id: row.id,
      productId: row.productId,
      code: row.product.code,
      description: row.product.description,
      provider: row.product.provider.name,
      oldCostPrice: Number(row.oldCostPrice),
      newCostPrice: Number(row.newCostPrice),
      sourceFile: row.sourceFile,
      createdAt: row.createdAt,
    })),
  );
}
