import { NextResponse } from "next/server";
import { tldRepository } from "@/lib/repository";


export async function GET() {
  const tlds = await tldRepository.list();
  return NextResponse.json({ tlds });
}
