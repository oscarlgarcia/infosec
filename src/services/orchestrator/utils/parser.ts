import * as xlsx from 'xlsx';
import mammoth from 'mammoth';

function normalizeQuestion(value: string): string {
  return value
    .replace(/\s+/g, ' ')
    .trim();
}

function dedupeQuestions(questions: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of questions) {
    const question = normalizeQuestion(raw);
    if (!question || question.length < 4) continue;
    const key = question.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(question);
  }
  return result;
}

function parseCsv(content: string): string[] {
  const lines = content.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  return lines.flatMap((line) => {
    if (line.includes(',')) {
      return line.split(',').map((cell) => cell.trim());
    }
    return [line];
  });
}

async function parseDocx(buffer: Buffer): Promise<string[]> {
  const text = (await mammoth.extractRawText({ buffer })).value || '';
  return text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function parseSpreadsheet(buffer: Buffer): string[] {
  const workbook = xlsx.read(buffer, { type: 'buffer' });
  const rows: string[] = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const matrix = xlsx.utils.sheet_to_json<string[]>(sheet, { header: 1, blankrows: false });
    for (const row of matrix) {
      for (const cell of row || []) {
        if (typeof cell === 'string' && cell.trim()) {
          rows.push(cell.trim());
        }
      }
    }
  }
  return rows;
}

export async function parseQuestionnaireFile(args: {
  filename: string;
  buffer: Buffer;
}): Promise<string[]> {
  const lower = args.filename.toLowerCase();
  let questions: string[] = [];

  if (lower.endsWith('.csv')) {
    questions = parseCsv(args.buffer.toString('utf-8'));
  } else if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
    questions = parseSpreadsheet(args.buffer);
  } else if (lower.endsWith('.docx')) {
    questions = await parseDocx(args.buffer);
  } else {
    questions = args.buffer.toString('utf-8').split(/\r?\n/);
  }

  return dedupeQuestions(questions.filter((line) => line.includes('?') || line.length > 10));
}
