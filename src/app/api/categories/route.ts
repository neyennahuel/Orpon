import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  return NextResponse.json(await prisma.category.findMany({ orderBy: { name: "asc" } }));
}

export async function POST(request: NextRequest) {
  const name = String((await request.json()).name || "").trim();
  if (!name) return NextResponse.json({ error: "Nombre obligatorio" }, { status: 400 });
  return NextResponse.json(await prisma.category.upsert({ where: { name }, update: {}, create: { name } }));
}
