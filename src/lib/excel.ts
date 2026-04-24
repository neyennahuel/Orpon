import * as XLSX from "xlsx";

export type BaseImportRow = Record<string, unknown>;

export function readWorkbook(buffer: ArrayBuffer) {
  return XLSX.read(buffer, { type: "array", cellDates: true });
}

export function sheetRows(sheet: XLSX.WorkSheet) {
  return XLSX.utils.sheet_to_json<BaseImportRow>(sheet, { defval: "", raw: false });
}

export function normalizeHeader(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_");
}

export function normalizeCode(value: unknown) {
  return String(value ?? "").trim();
}

export function parsePrice(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const raw = String(value)
    .replace(/\s/g, "")
    .replace(/\$/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(raw)) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function createBaseTemplate() {
  const rows = [
    {
      codigo_producto: "COD-001",
      descripcion: "Vaso plastico 180cc",
      categoria: "Vasos",
      proveedor: "Proveedor ejemplo",
      precio_costo: 100,
      unidad_medida: "unidad",
      observaciones: "",
      activo: true,
    },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "productos");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
