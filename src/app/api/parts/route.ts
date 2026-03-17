import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const search = searchParams.get("search");

    if (search) {
      // Use raw SQL so we can search inside the aliases text[] with ILIKE
      const searchPattern = `%${search}%`;
      const parts = await prisma.$queryRawUnsafe(
        `SELECT id, name, part_number AS "partNumber", category,
                category_id AS "categoryId", subcategory_id AS "subcategoryId",
                purchase_price AS "purchasePrice", sale_price AS "salePrice",
                stock, min_stock AS "minStock", aliases,
                usage_count AS "usageCount",
                created_at AS "createdAt", updated_at AS "updatedAt"
         FROM parts
         WHERE (
           name ILIKE $1
           OR part_number ILIKE $1
           OR EXISTS (SELECT 1 FROM unnest(aliases) AS a WHERE a ILIKE $1)
         )
         ${category ? "AND category = $2" : ""}
         ORDER BY created_at DESC`,
        searchPattern,
        ...(category ? [category] : [])
      );
      return NextResponse.json(parts);
    }

    const where: Record<string, unknown> = {};
    if (category) where.category = category;

    const parts = await prisma.part.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(parts);
  } catch (error) {
    console.error("GET /api/parts error:", error);
    return NextResponse.json(
      { error: "Failed to fetch parts" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const { name, partNumber, category, purchasePrice, salePrice, stock, minStock, aliases } = body;

    // Validation
    const errors: string[] = [];
    if (!name || typeof name !== "string") errors.push("Name is required");
    if (!partNumber || typeof partNumber !== "string") errors.push("Part number is required");
    if (!category || typeof category !== "string") errors.push("Category is required");
    if (purchasePrice == null || typeof purchasePrice !== "number" || purchasePrice < 0)
      errors.push("Valid purchase price is required");
    if (salePrice == null || typeof salePrice !== "number" || salePrice < 0)
      errors.push("Valid sale price is required");
    if (stock != null && (typeof stock !== "number" || stock < 0))
      errors.push("Stock must be a non-negative number");
    if (minStock != null && (typeof minStock !== "number" || minStock < 0))
      errors.push("Min stock must be a non-negative number");

    if (errors.length > 0) {
      return NextResponse.json({ errors }, { status: 400 });
    }

    // Check for duplicate part number
    const existing = await prisma.part.findUnique({
      where: { partNumber },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Part number already exists" },
        { status: 409 }
      );
    }

    const part = await prisma.part.create({
      data: {
        name,
        partNumber,
        category,
        purchasePrice,
        salePrice,
        stock: stock ?? 0,
        minStock: minStock ?? 5,
        aliases: Array.isArray(aliases) ? aliases.map((a: string) => String(a).trim().toLowerCase()).filter(Boolean) : [],
      },
    });

    return NextResponse.json(part, { status: 201 });
  } catch (error) {
    console.error("POST /api/parts error:", error);
    return NextResponse.json(
      { error: "Failed to create part" },
      { status: 500 }
    );
  }
}
