import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeHeader, readWorkbook, sheetRows } from "@/lib/excel";

const required = ["codigo_producto", "descripcion", "categoria"];
const defaultProviderName = "Sin proveedor";

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Archivo obligatorio" }, { status: 400 });

  const workbook = readWorkbook(await file.arrayBuffer());
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = sheetRows(firstSheet);
  const summary = { created: 0, updated: 0, ignored: 0, errors: [] as string[] };
  if (!rows.length) return NextResponse.json({ ...summary, errors: ["El Excel no tiene filas"] }, { status: 400 });

  const headerMap = Object.keys(rows[0]).reduce<Record<string, string>>((acc, key) => {
    acc[normalizeHeader(key)] = key;
    return acc;
  }, {});
  const missing = required.filter((column) => !headerMap[column]);
  if (missing.length) {
    return NextResponse.json({ ...summary, errors: [`Faltan columnas: ${missing.join(", ")}`] }, { status: 400 });
  }

  for (const [index, row] of rows.entries()) {
    const line = index + 2;
    const code = String(row[headerMap.codigo_producto] || "").trim();
    const description = String(row[headerMap.descripcion] || "").trim();
    const categoryName = String(row[headerMap.categoria] || "").trim();
    if (!code || !description || !categoryName) {
      summary.ignored++;
      summary.errors.push(`Fila ${line}: datos obligatorios invalidos`);
      continue;
    }
    const category = await prisma.category.upsert({ where: { name: categoryName }, update: {}, create: { name: categoryName } });
    const existing = await prisma.product.findUnique({ where: { code } });
    const provider = await prisma.provider.upsert({ where: { name: defaultProviderName }, update: {}, create: { name: defaultProviderName } });
    await prisma.product.upsert({
      where: { code },
      update: {
        description,
        categoryId: category.id,
      },
      create: {
        code,
        description,
        categoryId: category.id,
        providerId: provider.id,
        costPrice: 0,
        active: true,
        stock: { create: { currentQuantity: 0 } },
      },
    });
    if (existing) summary.updated++;
    else summary.created++;
  }
  return NextResponse.json(summary);
}
