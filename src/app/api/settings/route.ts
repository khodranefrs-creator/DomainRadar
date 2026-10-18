import { NextResponse } from "next/server";
import { settingsRepository } from "@/lib/repository";
import { userSettingsSchema } from "@/lib/schemas";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";


export async function GET() {
  const settings = await settingsRepository.get();
  return NextResponse.json({
    ...settings,
    defaultTlds: safeParse(settings.defaultTlds),
  });
}

export async function PUT(request: Request) {
  const limit = rateLimit(request, "settingsWrite");
  if (!limit.allowed) return tooManyRequests(limit);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = userSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 422 },
    );
  }
  const updated = await settingsRepository.update(parsed.data);
  return NextResponse.json({
    ...updated,
    defaultTlds: safeParse(updated.defaultTlds),
  });
}

function safeParse(json: string): string[] {
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}
