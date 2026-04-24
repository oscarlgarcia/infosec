import { chat, createEmbedding } from '../llm/openai';
import { QAEntry } from '../../db/mongo/models';
import type { Department, AgentResponse } from '../../types';

const SIMILARITY_THRESHOLD_HIGH = 0.97;
const SIMILARITY_THRESHOLD_MEDIUM = 0.85;

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\sáéíóúñü]/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function cosineSimilarity(a: number[], b: number[]): number {
  const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dotProduct / (magA * magB);
}

interface QAMatch {
  q: string;
  a: string;
  similarity: number;
  department?: string;
}

async function findQAMatches(question: string): Promise<{
  exact: QAMatch[];
  similar: QAMatch[];
}> {
  const qaEntries = await QAEntry.find().lean();
  
  if (qaEntries.length === 0) {
    return { exact: [], similar: [] };
  }

  let questionEmbedding: number[] = [];
  try {
    questionEmbedding = await createEmbedding(question);
  } catch (error) {
    console.warn('⚠️ Could not create embedding:', error);
    return { exact: [], similar: [] };
  }
  
  if (questionEmbedding.length === 0) {
    return { exact: [], similar: [] };
  }
  
  const results: QAMatch[] = await Promise.all(
    qaEntries.map(async (entry: any) => {
      let entryEmbedding: number[] = [];
      try {
        entryEmbedding = await createEmbedding(entry.question);
      } catch {
        return { q: entry.question, a: entry.answer, similarity: 0, department: entry.department };
      }
      const similarity = entryEmbedding.length > 0 ? cosineSimilarity(questionEmbedding, entryEmbedding) : 0;
      return {
        q: entry.question,
        a: entry.answer,
        similarity,
        department: entry.department,
      };
    })
  );

  const exact = results
    .filter(r => r.similarity >= SIMILARITY_THRESHOLD_HIGH)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 1);

  const similar = results
    .filter(r => r.similarity >= SIMILARITY_THRESHOLD_MEDIUM && r.similarity < SIMILARITY_THRESHOLD_HIGH)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 3);

  return { exact, similar };
}

function detectKeywordRoles(content: string): Department[] {
  const keywords: Record<string, string[]> = {
    Cloud: ['cloud', 'iaas', 'paas', 'saas', 'contenedores', 'kubernetes', 'aws', 'azure', 'gcp'],
    IT: ['vpn', 'redes', 'firewall', 'accesos', 'dispositivos', 'helpdesk', 'servidor'],
    Development: ['código', 'api', 'ci/cd', 'repositorio', 'despliegue', 'github', 'gitlab'],
    Compliance: ['normativa', 'auditoría', 'controles', 'iso', 'gdpr', 'política'],
    Legal: ['contrato', 'cláusula', 'término', 'responsabilidad', 'licencia'],
  };

  const contentLower = content.toLowerCase();
  const foundRoles: Department[] = [];

  for (const [role, words] of Object.entries(keywords)) {
    if (words.some(word => contentLower.includes(word))) {
      foundRoles.push(role as Department);
    }
  }

  return foundRoles.length > 0 ? foundRoles : ['Cloud'];
}

export async function processQuestion(question: string, agent: string = 'InfoSec'): Promise<AgentResponse> {
  if (agent === 'Standard') {
    const systemPrompt = `Eres un asistente útil y profesional. Responde de manera clara y concisa en español.`;

    const answer = await chat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: question },
      ],
    });

    return {
      content: answer || 'No he podido generar una respuesta.',
      roles: ['Standard'],
      docGapReport: undefined,
    };
  }

  const normalizedQuestion = normalizeText(question);
  const { exact, similar } = await findQAMatches(normalizedQuestion);

  let responseContent = '';
  let roles: Department[] = [];
  let docGapReport: AgentResponse['docGapReport'] | undefined;

  if (exact.length > 0) {
    responseContent = `**PREGUNTA:** ${exact[0].q}\n\n**RESPUESTA:** ${exact[0].a}`;
    const qaEntry = await QAEntry.findOne({ question: exact[0].q }).lean();
    if (qaEntry && (qaEntry as any).department) {
      roles = [(qaEntry as any).department];
    }
  } else {
    if (similar.length > 0) {
      responseContent += '**Coincidencias similares encontradas:**\n\n';
      responseContent += '| Pregunta | Respuesta | Similitud |\n';
      responseContent += '|----------|-----------|----------|\n';
      for (const s of similar) {
        responseContent += `| ${s.q.substring(0, 50)}... | ${s.a.substring(0, 50)}... | ${(s.similarity * 100).toFixed(1)}% |\n`;
      }
      responseContent += '\n';
    }

    const systemPrompt = `Eres un asistente de ciberseguridad útil. Responde de manera clara y profesional en español.

FORMAT:
- Español con inglés técnico
- Separados por ---
- Línea final: "Rol que ha respondido: [roles]"`;

    const answer = await chat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: question },
      ],
    });

    responseContent += answer || 'No he podido generar una respuesta.';
    roles = detectKeywordRoles(question);
    docGapReport = {
      question,
      coverage: 'Nula',
      description: 'No se encontró información en Q&A',
      recommendedSection: roles[0] || 'Indeterminado',
    };
  }

  return {
    content: responseContent,
    roles,
    docGapReport,
  };
}
