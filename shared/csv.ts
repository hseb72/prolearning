/**
 * Lecture d'un petit fichier CSV : séparateur deviné sur la première ligne (« ; » comme
 * Excel en français, « , » ou tabulation), champs entre guillemets avec guillemets doublés,
 * marque d'ordre d'octets et lignes vides ignorées. Chaque ligne garde son numéro.
 */
export interface CsvRow {
  line: number;
  cells: string[];
}

export function guessDelimiter(firstLine: string): string {
  let best = ';';
  let bestCount = 0;
  for (const delimiter of [';', ',', '\t']) {
    const count = firstLine.split(delimiter).length - 1;
    if (count > bestCount) [best, bestCount] = [delimiter, count];
  }
  return best;
}

export function parseCsv(text: string): CsvRow[] {
  const source = text.replace(/^﻿/, '');
  const delimiter = guessDelimiter(source.split(/\r?\n/, 1)[0] ?? '');
  const rows: CsvRow[] = [];
  let cells: string[] = [];
  let cell = '';
  let quoted = false;
  let line = 1;
  let rowLine = 1;
  const endRow = () => {
    cells.push(cell);
    if (cells.some((c) => c.trim() !== ''))
      rows.push({ line: rowLine, cells: cells.map((c) => c.trim()) });
    cells = [];
    cell = '';
  };
  for (let i = 0; i < source.length; i++) {
    const ch = source[i]!;
    if (quoted) {
      if (ch === '"' && source[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else {
        if (ch === '\n') line++;
        cell += ch;
      }
    } else if (ch === '"' && cell.trim() === '') {
      cell = '';
      quoted = true;
    } else if (ch === delimiter) {
      cells.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && source[i + 1] === '\n') i++;
      endRow();
      line++;
      rowLine = line;
    } else cell += ch;
  }
  endRow();
  return rows;
}

/** Écrit un champ CSV (séparateur « ; ») en le mettant entre guillemets si besoin. */
export function csvCell(value: string): string {
  return /[;"\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}
