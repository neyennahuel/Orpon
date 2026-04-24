import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Change = {
  productId: number;
  oldCostPrice: number;
  newCostPrice: number;
  providerId?: number;
};

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { sourceFile?: string; changes?: Change[] };
  const changes = body.changes || [];
  if (!changes.length) return NextResponse.json({ error: "No hay cambios para confirmar" }, { status: 400 });

  const result = await prisma.$transaction(async (tx) => {
    let applied = 0;
    for (const change of changes) {
      const product = await tx.product.findUnique({ where: { id: change.productId } });
      if (!product) continue;
      await tx.product.update({ where: { id: change.productId }, data: { costPrice: change.newCostPrice } });
      await tx.costUpdateHistory.create({
        data: {
          productId: change.productId,
          providerId: change.providerId,
          oldCostPrice: Number(product.costPrice),
          newCostPrice: change.newCostPrice,
          sourceFile: body.sourceFile || null,
        },
      });
      applied++;
    }
    return { applied };
  });
  return NextResponse.json(result);
}
