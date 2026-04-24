import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeHeader, readWorkbook, sheetRows, parsePrice } from "@/lib/excel";

const required = ["codigo_producto", "descripcion", "categoria", "proveedor", "precio_costo"];

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
    const providerName = String(row[headerMap.proveedor] || "").trim();
    const costPrice = parsePrice(row[headerMap.precio_costo]);
    if (!code || !description || !categoryName || !providerName || costPrice === null) {
      summary.ignored++;
      summary.errors.push(`Fila ${line}: datos obligatorios invalidos`);
      continue;
    }
    const category = await prisma.category.upsert({ where: { name: categoryName }, update: {}, create: { name: categoryName } });
    const provider = await prisma.provider.upsert({ where: { name: providerName }, update: {}, create: { name: providerName } });
    const existing = await prisma.product.findUnique({ where: { code } });
    await prisma.product.upsert({
      where: { code },
      update: {
        description,
        categoryId: category.id,
        providerId: provider.id,
        costPrice,
        unitMeasure: headerMap.unidad_medida ? String(row[headerMap.unidad_medida] || "").trim() || null : null,
        notes: headerMap.observaciones ? String(row[headerMap.observaciones] || "").trim() || null : null,
        active: headerMap.activo ? !["false", "0", "no", "inactivo"].includes(String(row[headerMap.activo]).toLowerCase()) : true,
      },
      create: {
        code,
        description,
        categoryId: category.id,
        providerId: provider.id,
        costPrice,
        unitMeasure: headerMap.unidad_medida ? String(row[headerMap.unidad_medida] || "").trim() || null : null,
        notes: headerMap.observaciones ? String(row[headerMap.observaciones] || "").trim() || null : null,
        active: headerMap.activo ? !["false", "0", "no", "inactivo"].includes(String(row[headerMap.activo]).toLowerCase()) : true,
        stock: { create: { currentQuantity: 0 } },
      },
    });
    if (existing) summary.updated++;
    else summary.created++;
  }
  return NextResponse.json(summary);
}
