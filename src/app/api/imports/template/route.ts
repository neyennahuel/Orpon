import { NextResponse } from "next/server";
import { createBaseTemplate } from "@/lib/excel";

export async function GET() {
  const file = createBaseTemplate();
  return new NextResponse(new Uint8Array(file), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="plantilla-productos-orpon.xlsx"',
    },
  });
}
