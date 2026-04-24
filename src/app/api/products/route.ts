import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPriceSettings } from "@/lib/settings";
import { productSchema } from "@/lib/validation";
import { withPrices } from "@/lib/pricing";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const q = params.get("q")?.trim();
  const category = params.get("category")?.trim();
  const provider = params.get("provider")?.trim();
  const active = params.get("active");
  const settings = await getPriceSettings();
  const products = await prisma.product.findMany({
    where: {
      AND: [
        q
          ? {
              OR: [
                { code: { contains: q, mode: "insensitive" } },
                { description: { contains: q, mode: "insensitive" } },
              ],
            }
          : {},
        category ? { category: { name: category } } : {},
        provider ? { provider: { name: provider } } : {},
        active === "true" ? { active: true } : active === "false" ? { active: false } : {},
      ],
    },
    include: { category: true, provider: true, stock: true },
    orderBy: { code: "asc" },
  });
  return NextResponse.json(products.map((product) => withPrices(product, settings)));
}

export async function POST(request: NextRequest) {
  const parsed = productSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const data = parsed.data;
  const category = await prisma.category.upsert({
    where: { name: data.categoryName },
    update: {},
    create: { name: data.categoryName },
  });
  const provider = await prisma.provider.upsert({
    where: { name: data.providerName },
    update: {},
    create: { name: data.providerName },
  });
  const product = await prisma.product.upsert({
    where: { code: data.code },
    update: {
      description: data.description,
      costPrice: data.costPrice,
      unitMeasure: data.unitMeasure || null,
      notes: data.notes || null,
      active: data.active,
      categoryId: category.id,
      providerId: provider.id,
    },
    create: {
      code: data.code,
      description: data.description,
      costPrice: data.costPrice,
      unitMeasure: data.unitMeasure || null,
      notes: data.notes || null,
      active: data.active,
      categoryId: category.id,
      providerId: provider.id,
      stock: { create: { currentQuantity: 0 } },
    },
  });
  return NextResponse.json(product);
}
