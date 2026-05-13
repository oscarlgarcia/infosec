import * as XLSX from 'xlsx';

export interface ReaderOutput {
  questions: string[];
  filename?: string;
}

export async function readExcelQuestions(fileBuffer: Buffer, filename?: string): Promise<ReaderOutput> {
  const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error('Excel file has no sheets');
  }
  const sheet = workbook.Sheets[sheetName];
  const rows: any[] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  const questions: string[] = [];
  for (const row of rows) {
    const cell = row?.[0];
    if (cell && typeof cell === 'string' && cell.trim()) {
      const trimmed = cell.trim();
      if (trimmed.length > 5 && !trimmed.toLowerCase().startsWith('question')) {
        questions.push(trimmed);
      }
    }
  }

  if (questions.length === 0) {
    throw new Error('No valid questions found in Excel file');
  }

  return { questions, filename };
}
