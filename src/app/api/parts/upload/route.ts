import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

const headerMap: Record<string, string> = {
  name: "name", partname: "name", itemname: "name", item: "name",
  description: "name", partdescription: "name", productname: "name", product: "name",
  partnumber: "partNumber", partno: "partNumber", sku: "partNumber",
  code: "partNumber", partcode: "partNumber", itemcode: "partNumber",
  itemno: "partNumber", productcode: "partNumber", barcode: "partNumber",
  srno: "serial", sno: "serial", sr: "serial", serialno: "serial", serial: "serial",
  category: "category", cat: "category", type: "category", group: "category",
  purchaseprice: "purchasePrice", costprice: "purchasePrice", cost: "purchasePrice",
  buyprice: "purchasePrice", buyrate: "purchasePrice", purchaserate: "purchasePrice",
  rate: "purchasePrice", unitprice: "purchasePrice", cp: "purchasePrice",
  saleprice: "salePrice", sellingprice: "salePrice", sellprice: "salePrice",
  sellrate: "salePrice", salerate: "salePrice", mrp: "salePrice",
  price: "salePrice", sp: "salePrice", retailprice: "salePrice",
  stock: "stock", quantity: "stock", qty: "stock", totalstock: "stock",
  totalstockqty: "stock", currentstock: "stock", onhand: "stock",
  instock: "stock", balance: "stock", balanceqty: "stock",
  available: "stock", availableqty: "stock",
  minstock: "minStock", minimumstock: "minStock", reorderlevel: "minStock",
  reorderqty: "minStock", minqty: "minStock", minimum: "minStock",
};

function parseSheet(buffer: Buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
}

function autoDetectMapping(rawRows: Record<string, unknown>[]) {
  const originalHeaders = Object.keys(rawRows[0]);
  const detected: Record<string, string> = {};
  const used = new Set<string>();

  // First pass: exact header matching
  for (const header of originalHeaders) {
    const key = normalize(header);
    const field = headerMap[key];
    if (field && !used.has(field)) {
      detected[header] = field;
      used.add(field);
    }
  }

  // Second pass: partial matching for unmapped headers
  for (const header of originalHeaders) {
    if (detected[header]) continue;
    const key = normalize(header);
    // Check if key contains known substrings
    const partialMap: [string, string][] = [
      ["stock", "stock"], ["qty", "stock"], ["quantity", "stock"], ["balance", "stock"],
      ["name", "name"], ["item", "name"], ["part", "name"], ["description", "name"],
      ["rate", "purchasePrice"], ["cost", "purchasePrice"], ["purchase", "purchasePrice"],
      ["sale", "salePrice"], ["sell", "salePrice"], ["mrp", "salePrice"], ["price", "salePrice"],
      ["categor", "category"],
      ["min", "minStock"],
    ];
    for (const [substring, field] of partialMap) {
      if (key.includes(substring) && !used.has(field)) {
        detected[header] = field;
        used.add(field);
        break;
      }
    }
  }

  // Serial fallback
  if (!used.has("partNumber") && used.has("serial")) {
    for (const [h, f] of Object.entries(detected)) {
      if (f === "serial") { detected[h] = "partNumber"; used.add("partNumber"); used.delete("serial"); break; }
    }
  }

  return { originalHeaders, detected, used };
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const mode = formData.get("mode") as string | null; // "preview" | "import"
    const customMappingStr = formData.get("mapping") as string | null;

    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["csv", "xlsx", "xls"].includes(ext || "")) {
      return NextResponse.json({ error: "Unsupported file type. Use .csv or .xlsx" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const rawRows = parseSheet(buffer);
    if (rawRows.length === 0) {
      return NextResponse.json({ error: "File is empty" }, { status: 400 });
    }

    const { originalHeaders, detected } = autoDetectMapping(rawRows);

    // Use custom mapping if provided, otherwise use auto-detected
    let mapping: Record<string, string> = detected;
    if (customMappingStr) {
      try { mapping = JSON.parse(customMappingStr); } catch { /* use detected */ }
    }

    // PREVIEW MODE — return headers, sample raw data, and auto-detected mapping
    if (mode === "preview") {
      // Send raw sample data for each column so UI can show actual values
      const sampleRawRows = rawRows.slice(0, 5).map((row) => {
        const obj: Record<string, string> = {};
        for (const h of originalHeaders) {
          obj[h] = row[h] != null ? String(row[h]) : "";
        }
        return obj;
      });

      return NextResponse.json({
        preview: true,
        totalRows: rawRows.length,
        originalHeaders,
        detectedMapping: detected,
        sampleRawRows,
      });
    }

    // IMPORT MODE — apply mapping and insert/update
    const rows = rawRows.map((raw) => {
      const mapped: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(raw)) {
        const field = mapping[key];
        if (field && field !== "skip" && field !== "serial") {
          mapped[field] = value;
        }
      }
      return mapped;
    });

    let created = 0, updated = 0, skipped = 0;
    const errors: string[] = [];
    let autoIdx = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;
      const name = row.name ? String(row.name).trim() : "";
      if (!name) { skipped++; continue; }

      const nameLower = name.toLowerCase();
      if (nameLower.includes("total") || nameLower.includes("summary") || nameLower.includes("grand")) {
        skipped++; continue;
      }

      let partNumber = row.partNumber ? String(row.partNumber).trim() : "";
      if (!partNumber || !isNaN(Number(partNumber))) {
        autoIdx++;
        partNumber = "HON-" + name.replace(/[^A-Za-z0-9 ]/g, "").trim().replace(/\s+/g, "-").substring(0, 40).toUpperCase() + "-" + autoIdx;
      }

      const category = row.category ? String(row.category).trim() : "Other";
      const purchasePrice = Math.max(0, Number(row.purchasePrice) || 0);
      const salePrice = Math.max(0, Number(row.salePrice) || 0);
      const stock = Math.max(0, Math.round(Number(row.stock) || 0));
      const minStock = Math.max(0, Math.round(Number(row.minStock) || 5));

      try {
        // Resolve category name → categoryId
        const cat = await prisma.category.upsert({
          where: { name: category },
          update: {},
          create: { name: category },
        });

        const existingByName = await prisma.part.findFirst({
          where: { name: { equals: name, mode: "insensitive" } },
        });
        if (existingByName) {
          await prisma.part.update({
            where: { id: existingByName.id },
            data: { categoryId: cat.id, purchasePrice, salePrice, stock, minStock },
          });
          updated++; continue;
        }

        const existingByPN = await prisma.part.findUnique({ where: { partNumber } });
        if (existingByPN) {
          await prisma.part.update({
            where: { partNumber },
            data: { name, categoryId: cat.id, purchasePrice, salePrice, stock, minStock },
          });
          updated++; continue;
        }

        await prisma.part.create({
          data: { name, partNumber, categoryId: cat.id, purchasePrice, salePrice, stock, minStock },
        });
        created++;
      } catch (err) {
        errors.push(`Row ${rowNum}: ${err instanceof Error ? err.message : "Unknown error"}`);
        skipped++;
      }
    }

    return NextResponse.json({ success: true, totalRows: rows.length, created, updated, skipped, errors: errors.slice(0, 20) });
  } catch (error) {
    console.error("POST /api/parts/upload error:", error);
    return NextResponse.json({ error: "Failed to process file" }, { status: 500 });
  }
}
