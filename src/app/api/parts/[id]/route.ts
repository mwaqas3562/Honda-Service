import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const { id: rawId } = await params;
    const id = parseInt(rawId, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid part ID" }, { status: 400 });
    }

    const part = await prisma.part.findUnique({ where: { id }, include: { category: true } });
    if (!part) {
      return NextResponse.json({ error: "Part not found" }, { status: 404 });
    }

    const { category: cat, ...rest } = part;
    return NextResponse.json({ ...rest, category: cat?.name || null });
  } catch (error) {
    console.error("GET /api/parts/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch part" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  try {
    const { id: rawId } = await params;
    const id = parseInt(rawId, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid part ID" }, { status: 400 });
    }

    const existing = await prisma.part.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Part not found" }, { status: 404 });
    }

    const body = await req.json();
    const { name, partNumber, category, categoryId, purchasePrice, salePrice, stock, minStock, aliases } = body;

    // Validation
    const errors: string[] = [];
    if (name !== undefined && (typeof name !== "string" || !name))
      errors.push("Name must be a non-empty string");
    if (partNumber !== undefined && (typeof partNumber !== "string" || !partNumber))
      errors.push("Part number must be a non-empty string");
    if (category !== undefined && categoryId === undefined && (typeof category !== "string" || !category))
      errors.push("Category must be a non-empty string");
    if (purchasePrice !== undefined && (typeof purchasePrice !== "number" || purchasePrice < 0))
      errors.push("Purchase price must be a non-negative number");
    if (salePrice !== undefined && (typeof salePrice !== "number" || salePrice < 0))
      errors.push("Sale price must be a non-negative number");
    if (stock !== undefined && (typeof stock !== "number" || stock < 0))
      errors.push("Stock must be a non-negative number");
    if (minStock !== undefined && (typeof minStock !== "number" || minStock < 0))
      errors.push("Min stock must be a non-negative number");

    if (errors.length > 0) {
      return NextResponse.json({ errors }, { status: 400 });
    }

    // Check duplicate part number if changing it
    if (partNumber && partNumber !== existing.partNumber) {
      const duplicate = await prisma.part.findUnique({
        where: { partNumber },
      });
      if (duplicate) {
        return NextResponse.json(
          { error: "Part number already exists" },
          { status: 409 }
        );
      }
    }

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (partNumber !== undefined) data.partNumber = partNumber;
    if (category !== undefined || categoryId !== undefined) {
      if (categoryId) {
        data.categoryId = categoryId;
      } else if (category) {
        const cat = await prisma.category.upsert({
          where: { name: category.trim() },
          update: {},
          create: { name: category.trim() },
        });
        data.categoryId = cat.id;
      }
    }
    if (purchasePrice !== undefined) data.purchasePrice = purchasePrice;
    if (salePrice !== undefined) data.salePrice = salePrice;
    if (stock !== undefined) data.stock = stock;
    if (minStock !== undefined) data.minStock = minStock;
    if (aliases !== undefined) data.aliases = Array.isArray(aliases) ? aliases.map((a: string) => String(a).trim()).filter(Boolean) : [];

    const part = await prisma.part.update({
      where: { id },
      data,
      include: { category: true },
    });

    const { category: cat, ...rest } = part;
    return NextResponse.json({ ...rest, category: cat?.name || null });
  } catch (error) {
    console.error("PUT /api/parts/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to update part" },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const { id: rawId } = await params;
    const id = parseInt(rawId, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid part ID" }, { status: 400 });
    }

    const existing = await prisma.part.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Part not found" }, { status: 404 });
    }

    await prisma.part.delete({ where: { id } });

    return NextResponse.json({ message: "Part deleted successfully" });
  } catch (error) {
    console.error("DELETE /api/parts/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to delete part" },
      { status: 500 }
    );
  }
}
