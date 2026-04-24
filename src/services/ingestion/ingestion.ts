import { DocumentModel, QAEntry } from '../../db/mongo/models';
import type { Department } from '../../types';
import { uploadKnowledgeDocumentFromBuffer } from '../kb/knowledge-base';
import { uploadFileToVectorStores } from '../llm/openai';

export async function ingestDocument(args: {
  filename: string;
  buffer: Buffer;
  department: Department;
  metadata?: {
    domain?: string;
    owner?: string;
    reviewDate?: string;
    expiryDate?: string;
    version?: string;
    criticality?: string;
  };
}) {
  const document = await uploadKnowledgeDocumentFromBuffer({
    filename: args.filename,
    buffer: args.buffer,
    department: args.department,
  });

  const vectorIngestion = await uploadFileToVectorStores({
    filename: args.filename,
    buffer: args.buffer,
    mimeType: document.metadata?.mimeType,
  });

  const mergedMetadata = {
    ...document.metadata,
    ...args.metadata,
    ...(vectorIngestion ? {
      openaiFileId: vectorIngestion.fileId,
      vectorStoreIds: vectorIngestion.vectorStoreIds,
    } : {}),
  };

  await DocumentModel.findByIdAndUpdate(document.id, {
    metadata: mergedMetadata,
  });

  return {
    ...document,
    metadata: mergedMetadata,
  };
}

function parseQaRows(content: string): Array<{ question: string; answer: string; department?: Department; source?: string }> {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const rows: Array<{ question: string; answer: string; department?: Department; source?: string }> = [];

  for (const line of lines) {
    if (line.includes('|')) {
      const [question, answer, department, source] = line.split('|').map((value) => value.trim());
      if (question && answer) {
        rows.push({
          question,
          answer,
          department: department as Department | undefined,
          source,
        });
      }
      continue;
    }

    if (line.includes('=>')) {
      const [question, answer] = line.split('=>').map((value) => value.trim());
      if (question && answer) {
        rows.push({ question, answer });
      }
    }
  }

  return rows;
}

export async function ingestQaFile(contentBuffer: Buffer) {
  const content = contentBuffer.toString('utf-8');
  const rows = parseQaRows(content);
  if (rows.length === 0) {
    return { inserted: 0 };
  }

  await QAEntry.insertMany(rows.map((row) => ({
    question: row.question,
    answer: row.answer,
    department: row.department,
    source: row.source || 'qa_file',
  })));

  return { inserted: rows.length };
}

export async function ingestRulesFile(contentBuffer: Buffer) {
  const content = contentBuffer.toString('utf-8');
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return lines.map((line, index) => ({
    name: `rule-${index + 1}`,
    content: line,
  }));
}
