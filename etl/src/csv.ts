import fs from 'node:fs';

export type Row = Record<string, string>;

function quote(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function writeCsv(file: string, columns: string[], rows: Row[]): void {
  const lines = [columns.join(',')];
  for (const row of rows) {
    lines.push(columns.map((c) => quote(row[c] ?? '')).join(','));
  }
  fs.writeFileSync(file, lines.join('\n') + '\n', 'utf8');
}

// Lector CSV mínimo (RFC 4180): comillas dobles, comas y saltos de línea dentro de comillas
export function readCsv(file: string): Row[] {
  const text = fs.readFileSync(file, 'utf8');
  const records: string[][] = [];
  let field = '';
  let record: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      record.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      record.push(field);
      records.push(record);
      record = [];
      field = '';
    } else {
      field += ch;
    }
  }
  if (field !== '' || record.length > 0) {
    record.push(field);
    records.push(record);
  }

  const [header, ...body] = records;
  return body.map((values) => Object.fromEntries(header.map((h, i) => [h, values[i] ?? ''])));
}
