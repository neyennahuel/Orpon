import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE() {
  const result = await prisma.$transaction(async (tx) => {
    const stockMovements = await tx.stockMovement.deleteMany();
    const stock = await tx.stock.deleteMany();
    const costHistory = await tx.costUpdateHistory.deleteMany();
    const products = await tx.product.deleteMany();

    return {
      products: products.count,
      stock: stock.count,
      stockMovements: stockMovements.count,
      costHistory: costHistory.count,
    };
  });

  return NextResponse.json(result);
}
