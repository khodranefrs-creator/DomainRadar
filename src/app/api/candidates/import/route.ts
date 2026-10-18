import { NextResponse } from "next/server";
import { candidateRepository } from "@/lib/candidate-repository";
import { CsvError } from "@/lib/csv";


const MAX_BYTES = 5 * 1024 * 1024; // 5 MB import cap

export async function POST(request: Request) {
  let text: string;
  let filename: string | undefined;
  const contentType = request.headers.get("content-type") ?? "";

  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "No file provided" }, { status: 400 });
      }
      if (file.size > MAX_BYTES) {
        return NextResponse.json(
          { error: "File exceeds 5 MB limit" },
          { status: 413 },
        );
      }
      filename = file.name;
      text = await file.text();
    } else {
      text = await request.text();
      if (text.length > MAX_BYTES) {
        return NextResponse.json(
          { error: "Payload exceeds 5 MB limit" },
          { status: 413 },
        );
      }
    }
    if (!text.trim()) {
      return NextResponse.json({ error: "Empty CSV" }, { status: 400 });
    }

    const result = await candidateRepository.importCsv(text, filename);
    return NextResponse.json({ result });
  } catch (err) {
    if (err instanceof CsvError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Import failed" },
      { status: 500 },
    );
  }
}
