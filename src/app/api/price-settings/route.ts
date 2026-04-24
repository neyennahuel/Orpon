import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPriceSettings } from "@/lib/settings";
import { settingsSchema } from "@/lib/validation";

export async function GET() {
  return NextResponse.json(await getPriceSettings());
}

export async function PUT(request: NextRequest) {
  const parsed = settingsSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  return NextResponse.json(
    await prisma.priceSetting.upsert({
      where: { id: 1 },
      update: parsed.data,
      create: { id: 1, ...parsed.data },
    }),
  );
}
