import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { stockMovementSchema } from "@/lib/validation";

export async function GET() {
  const rows = await prisma.stockMovement.findMany({
    include: { product: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return NextResponse.json(
    rows.map((row) => ({
      ...row,
      quantity: Number(row.quantity),
      previousQuantity: Number(row.previousQuantity),
      newQuantity: Number(row.newQuantity),
      productCode: row.product.code,
      productDescription: row.product.description,
    })),
  );
}

export async function POST(request: NextRequest) {
  const parsed = stockMovementSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const data = parsed.data;
  const result = await prisma.$transaction(async (tx) => {
    const stock = await tx.stock.upsert({
      where: { productId: data.productId },
      update: {},
      create: { productId: data.productId, currentQuantity: 0 },
    });
    const previous = Number(stock.currentQuantity);
    const next =
      data.movementType === "entrada"
        ? previous + data.quantity
        : data.movementType === "salida"
          ? previous - data.quantity
          : data.quantity;
    if (next < 0) throw new Error("El stock no puede quedar negativo");
    const updated = await tx.stock.update({
      where: { productId: data.productId },
      data: { currentQuantity: next },
    });
    const movement = await tx.stockMovement.create({
      data: {
        productId: data.productId,
        movementType: data.movementType,
        quantity: data.quantity,
        previousQuantity: previous,
        newQuantity: next,
        reason: data.reason,
        notes: data.notes || null,
      },
    });
    return { stock: updated, movement };
  });
  return NextResponse.json(result);
}
