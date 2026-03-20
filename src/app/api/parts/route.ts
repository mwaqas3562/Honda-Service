import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

/** Resolve a category name string to a categoryId, creating the Category if needed. */
async function resolveCategoryId(name: string): Promise<number> {
  const cat = await prisma.category.upsert({
    where: { name: name.trim() },
    update: {},
    create: { name: name.trim() },
  });
  return cat.id;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const search = searchParams.get("search");

    if (search) {
      // Split search into individual words for multi-keyword matching.
      // Each word must match name, part_number, or any alias independently.
      // Results are ranked by relevance: exact match > starts-with > contains, shorter names preferred.
      const words = search.trim().split(/\s+/).filter(Boolean);
      if (words.length === 0) {
        return NextResponse.json([]);
      }

      const searchableText = `LOWER(p.name || ' ' || COALESCE(p.part_number, '') || ' ' || COALESCE(array_to_string(p.aliases, ' '), ''))`;
      const nameText = `LOWER(p.name)`;

      const conditions: string[] = [];
      const params: unknown[] = [];
      let paramIdx = 1;

      // Per-word matching conditions (AND — all words must appear)
      for (const w of words) {
        conditions.push(`${searchableText} LIKE $${paramIdx}`);
        params.push(`%${w.toLowerCase()}%`);
        paramIdx++;
      }

      // Relevance scoring params
      const fullQuery = words.join(" ").toLowerCase();
      const exactParam = paramIdx; // exact name match
      params.push(fullQuery);
      paramIdx++;
      const startsParam = paramIdx; // name starts with query
      params.push(`${fullQuery}%`);
      paramIdx++;
      const containsParam = paramIdx; // name contains full query
      params.push(`%${fullQuery}%`);
      paramIdx++;

      // Per-word name-only match scoring
      const wordNameScores: string[] = [];
      for (const w of words) {
        wordNameScores.push(`CASE WHEN ${nameText} LIKE $${paramIdx} THEN 10 ELSE 0 END`);
        params.push(`%${w.toLowerCase()}%`);
        paramIdx++;
      }

      let categoryClause = "";
      if (category) {
        categoryClause = `AND c.name = $${paramIdx}`;
        params.push(category);
      }

      const relevanceExpr = `(
        CASE WHEN ${nameText} = $${exactParam} THEN 1000 ELSE 0 END
        + CASE WHEN ${nameText} LIKE $${startsParam} THEN 500 ELSE 0 END
        + CASE WHEN ${nameText} LIKE $${containsParam} THEN 200 ELSE 0 END
        + ${wordNameScores.join(" + ")}
        - LENGTH(p.name)
      )`;

      const sql = `
        SELECT p.id, p.name, p.part_number AS "partNumber",
               c.name AS "category",
               p.category_id AS "categoryId", p.subcategory_id AS "subcategoryId",
               p.purchase_price AS "purchasePrice", p.sale_price AS "salePrice",
               p.stock, p.min_stock AS "minStock", p.aliases,
               p.usage_count AS "usageCount",
               p.created_at AS "createdAt", p.updated_at AS "updatedAt"
        FROM parts p
        LEFT JOIN categories c ON c.id = p.category_id
        WHERE ${conditions.join(" AND ")}
        ${categoryClause}
        ORDER BY ${relevanceExpr} DESC, p.usage_count DESC, p.name ASC
        LIMIT 50`;

      const parts = await prisma.$queryRawUnsafe(sql, ...params);
      return NextResponse.json(parts);
    }

    const page = Math.max(parseInt(searchParams.get("page") || "1") || 1, 1);
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "200") || 200, 1), 500);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (category) where.category = { name: category };

    const [parts, total] = await Promise.all([
      prisma.part.findMany({
        where,
        include: { category: true },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.part.count({ where }),
    ]);

    // Flatten category relation to a string name for frontend compatibility
    const data = parts.map(({ category: cat, ...rest }) => ({
      ...rest,
      category: cat?.name || "Uncategorized",
    }));

    return NextResponse.json({ data, total, page, limit });
  } catch (error) {
    console.error("GET /api/parts error:", error);
    return NextResponse.json(
      { error: "Failed to fetch parts", detail: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const { name, partNumber, category, categoryId, purchasePrice, salePrice, stock, minStock, aliases } = body;

    // Validation
    const errors: string[] = [];
    if (!name || typeof name !== "string") errors.push("Name is required");
    if (!partNumber || typeof partNumber !== "string") errors.push("Part number is required");
    if (!category && !categoryId) errors.push("Category is required");
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

    // Resolve category name → categoryId
    const resolvedCategoryId = categoryId ?? (category ? await resolveCategoryId(category) : null);

    const part = await prisma.part.create({
      data: {
        name,
        partNumber,
        categoryId: resolvedCategoryId,
        purchasePrice: Math.round(purchasePrice),
        salePrice: Math.round(salePrice),
        stock: Math.round(stock ?? 0),
        minStock: Math.round(minStock ?? 5),
        aliases: Array.isArray(aliases) ? aliases.map((a: string) => String(a).trim().toLowerCase()).filter(Boolean) : [],
      },
      include: { category: true },
    });

    const { category: cat, ...rest } = part;
    return NextResponse.json({ ...rest, category: cat?.name || "Uncategorized" }, { status: 201 });
  } catch (error) {
    console.error("POST /api/parts error:", error);
    return NextResponse.json(
      { error: "Failed to create part" },
      { status: 500 }
    );
  }
}
