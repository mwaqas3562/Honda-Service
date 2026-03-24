import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { n } from "@/lib/utils";
import { PurchaseStatus } from "@/generated/prisma/client";
import * as XLSX from "xlsx";

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

const round2 = (n: number) => Math.round(n * 100) / 100;

// Map common Excel header names → our fields
const headerMap: Record<string, string> = {
  // Part identifiers
  name: "partName", partname: "partName", itemname: "partName", item: "partName",
  part: "partName", product: "partName", description: "partName", productname: "partName",
  partnumber: "partNumber", partno: "partNumber", sku: "partNumber",
  code: "partNumber", partcode: "partNumber", itemcode: "partNumber", barcode: "partNumber",
  // Quantity
  quantity: "quantity", qty: "quantity", pcs: "quantity", units: "quantity",
  noofitems: "quantity", count: "quantity",
  // Price
  unitprice: "unitPrice", price: "unitPrice", rate: "unitPrice",
  purchaseprice: "unitPrice", costprice: "unitPrice", cost: "unitPrice",
  buyprice: "unitPrice", buyrate: "unitPrice", purchaserate: "unitPrice",
  amount: "unitPrice", cp: "unitPrice",
  // Vendor
  vendor: "vendor", supplier: "vendor", vendorname: "vendor", suppliername: "vendor",
  from: "vendor", source: "vendor",
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

  // Exact match
  for (const header of originalHeaders) {
    const key = normalize(header);
    const field = headerMap[key];
    if (field && !used.has(field)) {
      detected[header] = field;
      used.add(field);
    }
  }

  // Partial match fallback
  for (const header of originalHeaders) {
    if (detected[header]) continue;
    const key = normalize(header);
    const partialMap: [string, string][] = [
      ["name", "partName"], ["item", "partName"], ["part", "partName"], ["description", "partName"],
      ["qty", "quantity"], ["quantity", "quantity"], ["pcs", "quantity"],
      ["price", "unitPrice"], ["rate", "unitPrice"], ["cost", "unitPrice"], ["amount", "unitPrice"],
      ["vendor", "vendor"], ["supplier", "vendor"],
    ];
    for (const [substring, field] of partialMap) {
      if (key.includes(substring) && !used.has(field)) {
        detected[header] = field;
        used.add(field);
        break;
      }
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
    const vendorIdStr = formData.get("vendorId") as string | null;
    const statusVal = formData.get("status") as string | null;

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

    let mapping: Record<string, string> = detected;
    if (customMappingStr) {
      try { mapping = JSON.parse(customMappingStr); } catch { /* use detected */ }
    }

    // ── PREVIEW MODE ──
    if (mode === "preview") {
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

    // ── IMPORT MODE ──
    const vendorId = vendorIdStr ? parseInt(vendorIdStr, 10) : null;
    const purchaseStatus = (statusVal || "ordered") as PurchaseStatus;

    const VALID_PURCHASE_STATUSES = ["ordered", "in_transit", "received"];
    if (!VALID_PURCHASE_STATUSES.includes(purchaseStatus)) {
      return NextResponse.json({ error: `Invalid status. Must be one of: ${VALID_PURCHASE_STATUSES.join(", ")}` }, { status: 400 });
    }

    // Map raw rows
    const rows = rawRows.map((raw) => {
      const mapped: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(raw)) {
        const field = mapping[key];
        if (field && field !== "skip") {
          mapped[field] = value;
        }
      }
      return mapped;
    });

    // Group by vendor (from sheet or form)
    const vendorGroups = new Map<string, typeof rows>();

    for (const row of rows) {
      const partName = row.partName ? String(row.partName).trim() : "";
      if (!partName) continue;
      // Skip totals/summary rows
      const lower = partName.toLowerCase();
      if (lower.includes("total") || lower.includes("summary") || lower.includes("grand")) continue;

      let vendorKey = "default";
      if (row.vendor && String(row.vendor).trim()) {
        vendorKey = String(row.vendor).trim();
      }
      if (!vendorGroups.has(vendorKey)) vendorGroups.set(vendorKey, []);
      vendorGroups.get(vendorKey)!.push(row);
    }

    let purchasesCreated = 0;
    let itemsCreated = 0;
    let skipped = 0;
    const errors: string[] = [];

    // Process each vendor group as a separate purchase
    const vendorEntries = Array.from(vendorGroups.entries());
    for (const [vendorKey, groupRows] of vendorEntries) {
      let resolvedVendorId = vendorId;

      // If vendor came from the sheet, find or create
      if (!resolvedVendorId && vendorKey !== "default") {
        const existingVendor = await prisma.vendor.findFirst({
          where: { name: { equals: vendorKey, mode: "insensitive" } },
        });
        if (existingVendor) {
          resolvedVendorId = existingVendor.id;
        } else {
          const newVendor = await prisma.vendor.create({ data: { name: vendorKey } });
          resolvedVendorId = newVendor.id;
        }
      }

      if (!resolvedVendorId) {
        errors.push(`No vendor specified for ${groupRows.length} item(s). Skipped.`);
        skipped += groupRows.length;
        continue;
      }

      // Build purchase items
      const purchaseItems: { partId: number; quantity: number; unitPrice: number; total: number }[] = [];

      for (let i = 0; i < groupRows.length; i++) {
        const row = groupRows[i];
        const partName = String(row.partName).trim();
        const quantity = Math.max(1, Math.round(Number(row.quantity) || 1));
        const unitPrice = Math.max(0, Number(row.unitPrice) || 0);

        // Find part by name or part number
        let part = null;
        if (row.partNumber) {
          part = await prisma.part.findUnique({ where: { partNumber: String(row.partNumber).trim() } });
        }
        if (!part) {
          part = await prisma.part.findFirst({
            where: { name: { equals: partName, mode: "insensitive" } },
          });
        }
        if (!part) {
          // Try partial match
          part = await prisma.part.findFirst({
            where: { name: { contains: partName, mode: "insensitive" } },
          });
        }

        if (!part) {
          errors.push(`Part "${partName}" not found in inventory. Skipped.`);
          skipped++;
          continue;
        }

        purchaseItems.push({
          partId: part.id,
          quantity,
          unitPrice: unitPrice || n(part.purchasePrice),
          total: round2(quantity * (unitPrice || n(part.purchasePrice))),
        });
      }

      if (purchaseItems.length === 0) continue;

      const total = purchaseItems.reduce((s, i) => s + i.total, 0);

      // Create purchase in transaction with stock updates
      try {
        await prisma.$transaction(async (tx) => {
          const vendor = await tx.vendor.findUnique({ where: { id: resolvedVendorId! } });
          const newPurchase = await tx.purchase.create({
            data: {
              vendorId: resolvedVendorId!,
              status: purchaseStatus,
              total: round2(total),
              note: `Bulk import from Excel`,
              items: { create: purchaseItems },
            },
          });

          if (purchaseStatus === "received") {
            for (const item of purchaseItems) {
              const part = await tx.part.findUnique({ where: { id: item.partId } });
              if (!part) continue;

              const prevStock = part.stock;
              const newStock = prevStock + item.quantity;
              const newAvgPrice = round2(
                ((prevStock * n(part.purchasePrice)) + (item.quantity * item.unitPrice)) / newStock
              );

              await tx.part.update({
                where: { id: item.partId },
                data: { stock: newStock, purchasePrice: newAvgPrice },
              });

              await tx.stockLog.create({
                data: {
                  partId: item.partId,
                  type: "purchase",
                  quantity: item.quantity,
                  prevStock,
                  newStock,
                  purchasePrice: item.unitPrice,
                  prevPrice: part.purchasePrice,
                  note: `Bulk Purchase #${newPurchase.id}${vendor ? ` from ${vendor.name}` : ""}`,
                },
              });
            }
          }

          purchasesCreated++;
          itemsCreated += purchaseItems.length;
        });
      } catch (err) {
        errors.push(`Failed to create purchase for vendor "${vendorKey}": ${err instanceof Error ? err.message : "Unknown error"}`);
      }
    }

    return NextResponse.json({
      success: true,
      totalRows: rows.length,
      purchasesCreated,
      itemsCreated,
      skipped,
      errors: errors.slice(0, 20),
    });
  } catch (error) {
    console.error("POST /api/purchases/upload error:", error);
    return NextResponse.json({ error: "Failed to process upload" }, { status: 500 });
  }
}
