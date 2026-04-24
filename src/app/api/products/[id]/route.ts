import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPriceSettings } from "@/lib/settings";
import { productSchema } from "@/lib/validation";
import { withPrices } from "@/lib/pricing";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await prisma.product.findUnique({
    where: { id: Number(id) },
    include: { category: true, provider: true, stock: true },
  });
  if (!product) return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
  return NextResponse.json(withPrices(product, await getPriceSettings()));
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = productSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const data = parsed.data;
  const category = await prisma.category.upsert({ where: { name: data.categoryName }, update: {}, create: { name: data.categoryName } });
  const provider = await prisma.provider.upsert({ where: { name: data.providerName }, update: {}, create: { name: data.providerName } });
  const product = await prisma.product.update({
    where: { id: Number(id) },
    data: {
      code: data.code,
      description: data.description,
      costPrice: data.costPrice,
      unitMeasure: data.unitMeasure || null,
      notes: data.notes || null,
      active: data.active,
      categoryId: category.id,
      providerId: provider.id,
    },
  });
  return NextResponse.json(product);
}
