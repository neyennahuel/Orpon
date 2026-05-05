import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const name = String((await request.json()).name || "").trim();
  if (!name) return NextResponse.json({ error: "Nombre obligatorio" }, { status: 400 });

  const existing = await prisma.category.findFirst({
    where: { name, NOT: { id: Number(id) } },
  });
  if (existing) return NextResponse.json({ error: "Ya existe una categoria con ese nombre" }, { status: 409 });

  const category = await prisma.category.update({
    where: { id: Number(id) },
    data: { name },
  });
  return NextResponse.json(category);
}
