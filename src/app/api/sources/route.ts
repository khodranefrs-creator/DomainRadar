import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";


export async function GET() {
  const [sources, tldCounts] = await Promise.all([
    prisma.source.findMany({ orderBy: { name: "asc" } }),
    prisma.tldRegistry.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  return NextResponse.json({ sources, tldCounts });
}
