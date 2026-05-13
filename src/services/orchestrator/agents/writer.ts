import * as path from 'path';
import * as fs from 'fs';
import * as XLSX from 'xlsx';

const OUTPUT_DIR = path.join(process.cwd(), 'uploads', 'orchestrator');

export interface WriterInput {
  jobId: string;
  rows: Array<{
    question: string;
    answer: string;
    domain?: string;
    subdomain?: string;
    confidence?: number;
    requiresLegalReview?: boolean;
    contradictionFlag?: boolean;
    evidenceCount?: number;
    notes?: string;
  }>;
}

export interface WriterOutput {
  outputFile: string;
}

export async function writeExcelOutput(input: WriterInput): Promise<WriterOutput> {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const data = input.rows.map((row, idx) => ({
    '#': idx + 1,
    Question: row.question,
    Answer: row.answer,
    Domain: row.domain || '',
    Subdomain: row.subdomain || '',
    Confidence: row.confidence ?? '',
    'Requires Legal Review': row.requiresLegalReview ? 'Yes' : 'No',
    'Contradiction Flag': row.contradictionFlag ? 'Yes' : 'No',
    'Evidence Count': row.evidenceCount ?? '',
    Notes: row.notes || '',
  }));

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(data);

  // Set column widths
  worksheet['!cols'] = [
    { wch: 5 },   // #
    { wch: 50 },  // Question
    { wch: 60 },  // Answer
    { wch: 15 },  // Domain
    { wch: 15 },  // Subdomain
    { wch: 12 },  // Confidence
    { wch: 20 },  // Requires Legal Review
    { wch: 20 },  // Contradiction Flag
    { wch: 15 },  // Evidence Count
    { wch: 30 },  // Notes
  ];

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Answers');
  const outputFilename = `answer-builder-${input.jobId}.xlsx`;
  const outputPath = path.join(OUTPUT_DIR, outputFilename);
  XLSX.writeFile(workbook, outputPath);

  return { outputFile: `/uploads/orchestrator/${outputFilename}` };
}
