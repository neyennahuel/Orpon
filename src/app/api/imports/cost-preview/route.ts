import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { normalizeCode, parsePrice, readWorkbook } from "@/lib/excel";

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Archivo obligatorio" }, { status: 400 });

  const products = await prisma.product.findMany({ include: { provider: true } });
  const productByCode = new Map(products.map((product) => [product.code, product]));
  const workbook = readWorkbook(await file.arrayBuffer());
  const result = {
    sourceFile: file.name,
    found: 0,
    updated: 0,
    unchanged: 0,
    notFound: [] as Array<{ sheet: string; row: number; code: string }>,
    conflicts: [] as Array<{ sheet: string; row: number; code: string; prices: number[] }>,
    changes: [] as Array<{ productId: number; code: string; description: string; oldCostPrice: number; newCostPrice: number; providerId: number; provider: string }>,
    errors: [] as string[],
  };

  for (const sheetName of workbook.SheetNames) {
    const rows = XLSXRows(workbook.Sheets[sheetName]);
    rows.forEach((cells, rowIndex) => {
      const matchedCodes = cells.map(normalizeCode).filter((cell) => productByCode.has(cell));
      if (!matchedCodes.length) {
        const maybeCode = cells.find((cell) => typeof cell === "string" && String(cell).trim().length >= 3);
        if (maybeCode) result.notFound.push({ sheet: sheetName, row: rowIndex + 1, code: normalizeCode(maybeCode) });
        return;
      }
      const code = matchedCodes[0];
      const product = productByCode.get(code)!;
      result.found++;
      const candidates = [...new Set(cells.map(parsePrice).filter((price): price is number => price !== null && price !== Number(product.costPrice)))];
      if (candidates.length === 0) {
        result.unchanged++;
        return;
      }
      if (candidates.length > 1) {
        result.conflicts.push({ sheet: sheetName, row: rowIndex + 1, code, prices: candidates });
        return;
      }
      result.updated++;
      result.changes.push({
        productId: product.id,
        code,
        description: product.description,
        oldCostPrice: Number(product.costPrice),
        newCostPrice: candidates[0],
        providerId: product.providerId,
        provider: product.provider.name,
      });
    });
  }
  return NextResponse.json(result);
}

function XLSXRows(sheet: import("xlsx").WorkSheet) {
  const range = importRange(sheet);
  const rows: unknown[][] = [];
  for (let row = range.s.r; row <= range.e.r; row++) {
    const cells: unknown[] = [];
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cell = sheet[encodeCell(row, col)];
      if (cell?.v !== undefined && cell.v !== null && cell.v !== "") cells.push(cell.v);
    }
    if (cells.length) rows.push(cells);
  }
  return rows;
}

function importRange(sheet: import("xlsx").WorkSheet) {
  return XLSX.utils.decode_range(sheet["!ref"] || "A1:A1");
}

function encodeCell(row: number, col: number) {
  return XLSX.utils.encode_cell({ r: row, c: col });
}
