import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";

// CSV parse/serialize with formula-injection protection (CSV injection).
// Pure functions; no I/O. Unit tested in tests/csv.test.ts.

/** Strip NUL and disallowed control chars; bound length. */
export function sanitizeText(input: unknown, maxLength = 2000): string {
  if (input === null || input === undefined) return "";
  let s = String(input);
  s = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
  if (s.length > maxLength) s = s.slice(0, maxLength);
  return s;
}

/**
 * Neutralize a value before writing to CSV so spreadsheet apps treat it as
 * text. Prefixes a single quote when a formula character leads the cell.
 */
export function sanitizeForCsv(input: unknown, maxLength = 2000): string {
  let s = sanitizeText(input, maxLength);
  const trimmedStart = s.replace(/^\s+/, "");
  const lead = trimmedStart[0];
  if (lead && ["=", "+", "-", "@"].includes(lead)) {
    s = "'" + s;
  }
  return s;
}

export class CsvError extends Error {
  constructor(
    message: string,
    public readonly row?: number,
  ) {
    super(message);
    this.name = "CsvError";
  }
}

export interface ParsedCsv {
  headers: string[];
  rows: Record<string, string>[];
  skippedRows: number;
}

/** Parse CSV text safely with bounded fields and prototype-safe row objects. */
export function parseCsv(
  text: string,
  options: { maxRows?: number; maxFieldLength?: number } = {},
): ParsedCsv {
  const maxRows = options.maxRows ?? 100_000;
  const maxFieldLength = options.maxFieldLength ?? 4096;

  let records: string[][];
  try {
    records = parse(text, {
      bom: true,
      relax_column_count: true,
      skip_empty_lines: false,
      trim: false,
    }) as string[][];
  } catch (err) {
    throw new CsvError(
      `Malformed CSV: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  if (records.length === 0) return { headers: [], rows: [], skippedRows: 0 };

  const headers = records[0].map((h) => sanitizeText(h, 128).trim());
  if (headers.some((h) => h.length === 0)) {
    throw new CsvError("CSV header contains an empty column name");
  }
  if (new Set(headers).size !== headers.length) {
    throw new CsvError("CSV has duplicate column headers");
  }
  if (headers.length === 0) throw new CsvError("CSV has no header row");

  const rows: Record<string, string>[] = [];
  let skippedRows = 0;
  for (let i = 1; i < records.length; i++) {
    const rec = records[i];
    if (rec.length === 0 || (rec.length === 1 && rec[0].trim() === "")) {
      skippedRows++;
      continue;
    }
    if (rows.length >= maxRows) {
      throw new CsvError(`CSV exceeds maximum of ${maxRows} rows`);
    }
    const row: Record<string, string> = Object.create(null);
    for (let c = 0; c < headers.length; c++) {
      const raw = c < rec.length ? rec[c] : "";
      row[headers[c]] = sanitizeText(raw, maxFieldLength);
    }
    rows.push(row);
  }
  return { headers, rows, skippedRows };
}

export interface CsvColumn {
  key: string;
  header: string;
}

/** Serialize rows to CSV, sanitizing each cell against formula injection. */
export function toCsv(
  columns: CsvColumn[],
  rows: Record<string, unknown>[],
): string {
  const headers = columns.map((c) => c.header);
  const records = rows.map((row) =>
    columns.map((c) => sanitizeForCsv(row[c.key] ?? "")),
  );
  return stringify([headers, ...records], {
    quoted: true,
    eof: true,
    record_delimiter: "\n",
  });
}
