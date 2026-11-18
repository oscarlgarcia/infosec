import * as XLSX from 'xlsx';
import { EvidenceItem } from '../../db/mongo/models';
import { evidenceCreateSchema } from '../../schemas/evidence';
import {
  buildEvidenceQuery,
  createEvidence,
  EvidenceActor,
  EvidenceListFilters,
  serializeEvidence,
} from './evidence.service';
import { createMapping, exportMappings, normalizeForMatch } from './evidence.matcher';

function splitList(value: any): string[] {
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) return value.map((entry) => String(entry).trim()).filter(Boolean);
  return String(value)
    .split(/[,;|]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function normalizeHeader(value: string) {
  return normalizeForMatch(value).replace(/\s+/g, '');
}

function normalizeRow(row: Record<string, any>) {
  const map = new Map<string, any>();
  for (const [key, value] of Object.entries(row || {})) {
    map.set(normalizeHeader(key), value);
  }
  return (...aliases: string[]) => {
    for (const alias of aliases) {
      const key = normalizeHeader(alias);
      if (map.has(key)) return map.get(key);
    }
    return undefined;
  };
}

const DOCUMENT_TYPE_MAP: Record<string, string> = {
  policy: 'policy', politica: 'policy',
  procedure: 'procedure', procedimiento: 'procedure',
  standard: 'standard', estandar: 'standard',
  guideline: 'guideline', guia: 'guideline',
  certificate: 'certificate', certificado: 'certificate',
  report: 'report', informe: 'report',
  register: 'register', registro: 'register',
  plan: 'plan',
  record: 'record', evidencia: 'record', registro2: 'record',
  other: 'other', otro: 'other',
};

const CLASSIFICATION_MAP: Record<string, string> = {
  public: 'public', publica: 'public',
  internal: 'internal', interna: 'internal',
  confidential: 'confidential', confidencial: 'confidential',
  restricted: 'restricted', restringida: 'restricted',
};

const SHARE_MODE_MAP: Record<string, string> = {
  full: 'full', completo: 'full', completodocumento: 'full', documentocompleto: 'full',
  index: 'index', indice: 'index', soloindice: 'index',
  internal: 'internal', interno: 'internal',
};

const LANGUAGE_MAP: Record<string, string> = {
  es: 'es', espanol: 'es', spanish: 'es',
  en: 'en', ingles: 'en', english: 'en',
  it: 'it', italiano: 'it', italian: 'it',
  other: 'other', otro: 'other', otra: 'other',
};

const ORIGIN_MAP: Record<string, string> = {
  upload: 'upload', subido: 'upload', archivo: 'upload',
  localpath: 'local_path', local: 'local_path', rutalocal: 'local_path',
  kbdocument: 'kb_document', kb: 'kb_document', documentodelkb: 'kb_document',
};

function mapEnum(value: any, map: Record<string, string>, fallback?: string) {
  if (value === null || value === undefined || value === '') return fallback;
  const key = normalizeHeader(String(value));
  return map[key] || fallback;
}

function parseBoolean(value: any): boolean {
  if (typeof value === 'boolean') return value;
  const text = normalizeHeader(String(value ?? ''));
  return ['true', '1', 'yes', 'si', 'sí', 'x', 'required', 'requerido'].includes(text);
}

function parseDateValue(value: any): string | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      const month = String(parsed.m).padStart(2, '0');
      const day = String(parsed.d).padStart(2, '0');
      return `${parsed.y}-${month}-${day}`;
    }
  }
  const text = String(value).trim();
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dmy = text.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/);
  if (dmy) {
    const year = dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3];
    return `${year}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  }
  const date = new Date(text);
  if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10);
  return text;
}

function rowToEvidence(row: Record<string, any>) {
  const get = normalizeRow(row);
  const localPath = String(get('Ruta local', 'Local path', 'localPath') || '').trim();
  const explicitOrigin = mapEnum(get('Origen', 'Origin'), ORIGIN_MAP);
  const origin = explicitOrigin || (localPath ? 'local_path' : 'upload');

  return {
    title: String(get('Título', 'Titulo', 'Title') || '').trim(),
    domain: String(get('Dominio', 'Domain') || '').trim(),
    area: String(get('Área', 'Area') || '').trim(),
    process: String(get('Proceso', 'Process') || '').trim() || undefined,
    frameworks: splitList(get('Frameworks', 'Marco', 'Marcos')),
    controls: splitList(get('Controles', 'Controls', 'Control')),
    covers: String(get('Cubre', 'Covers', 'Requisito', 'Requirement') || '').trim() || undefined,
    language: mapEnum(get('Idioma', 'Language'), LANGUAGE_MAP, 'other'),
    documentType: mapEnum(get('Tipo', 'Type', 'Tipo de documento'), DOCUMENT_TYPE_MAP, 'other'),
    classification: mapEnum(get('Clasificación', 'Clasificacion', 'Classification'), CLASSIFICATION_MAP, 'internal'),
    shareMode: mapEnum(get('Compartición', 'Comparticion', 'Sharing'), SHARE_MODE_MAP, 'full'),
    ndaRequired: parseBoolean(get('NDA', 'Requiere NDA', 'Requires NDA')),
    version: String(get('Versión', 'Version') || '').trim() || undefined,
    owner: String(get('Propietario', 'Owner') || '').trim() || undefined,
    tags: splitList(get('Etiquetas', 'Tags', 'Keywords')),
    description: String(get('Descripción', 'Descripcion', 'Description') || '').trim() || undefined,
    notes: String(get('Notas', 'Notes') || '').trim() || undefined,
    validFrom: parseDateValue(get('Válido desde', 'Valido desde', 'Valid from')),
    validUntil: parseDateValue(get('Válido hasta', 'Valido hasta', 'Valid until')),
    origin,
    localPath: origin === 'local_path' ? localPath : undefined,
    kbDocumentId: origin === 'kb_document'
      ? String(get('Documento KB', 'KB document', 'kbDocumentId') || '').trim() || undefined
      : undefined,
  };
}

function errorMessage(error: any) {
  if (Array.isArray(error?.issues)) {
    return error.issues
      .map((issue: any) => `${(issue.path || []).join('.') || 'row'}: ${issue.message}`)
      .join('; ');
  }
  return error?.message || 'Unexpected error';
}

export async function buildEvidenceWorkbook(filters: EvidenceListFilters = {}) {
  const query = buildEvidenceQuery(filters);
  const items = await EvidenceItem.find(query)
    .sort({ domain: 1, area: 1, title: 1 })
    .limit(10000)
    .lean();

  const headers = [
    'Título',
    'Dominio',
    'Área',
    'Proceso',
    'Frameworks',
    'Controles',
    'Cubre',
    'Idioma',
    'Tipo',
    'Clasificación',
    'Compartición',
    'NDA',
    'Versión',
    'Propietario',
    'Origen',
    'Archivo',
    'Ruta local',
    'Etiquetas',
    'Descripción',
    'Notas',
    'Válido desde',
    'Válido hasta',
    'Última revisión',
    'Estado',
  ];

  const rows = items.map((raw: any) => {
    const item: any = serializeEvidence(raw);
    return [
      item.title,
      item.domain,
      item.area,
      item.process,
      item.frameworks.join(', '),
      item.controls.join(', '),
      item.covers,
      item.language,
      item.documentType,
      item.classification,
      item.shareMode,
      item.ndaRequired ? 'Sí' : 'No',
      item.version,
      item.owner,
      item.origin,
      item.asset?.originalName || '',
      item.localPath,
      item.tags.join(', '),
      item.description,
      item.notes,
      item.validFrom ? new Date(item.validFrom).toISOString().slice(0, 10) : '',
      item.validUntil ? new Date(item.validUntil).toISOString().slice(0, 10) : '',
      item.lastReviewedAt ? new Date(item.lastReviewedAt).toISOString().slice(0, 10) : '',
      item.status,
    ];
  });

  const evidenceSheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  evidenceSheet['!cols'] = headers.map((header) => ({ wch: Math.max(14, header.length + 4) }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, evidenceSheet, 'Evidencias');

  const mappings = await exportMappings();
  if (mappings.length) {
    const mappingHeaders = ['Requisito', 'Evidencia', 'Idioma', 'Notas', 'Creado', 'Actualizado'];
    const mappingRows = mappings.map((mapping) => [
      mapping.requirement,
      mapping.evidenceTitle,
      mapping.language,
      mapping.notes,
      mapping.createdAt ? new Date(mapping.createdAt).toISOString().slice(0, 10) : '',
      mapping.updatedAt ? new Date(mapping.updatedAt).toISOString().slice(0, 10) : '',
    ]);
    const mappingSheet = XLSX.utils.aoa_to_sheet([mappingHeaders, ...mappingRows]);
    mappingSheet['!cols'] = mappingHeaders.map((header) => ({ wch: Math.max(18, header.length + 6) }));
    XLSX.utils.book_append_sheet(workbook, mappingSheet, 'Mapeos');
  }

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

export async function importEvidenceWorkbook(buffer: Buffer, actor?: EvidenceActor) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames.find((name) => name.toLowerCase().includes('evidenc'))
    || workbook.SheetNames[0];
  if (!sheetName) return { created: 0, total: 0, errors: [{ row: 0, message: 'Workbook has no sheets' }] };

  const rows = XLSX.utils.sheet_to_json<Record<string, any>>(workbook.Sheets[sheetName], {
    defval: '',
    raw: true,
  });

  let created = 0;
  const errors: Array<{ row: number; message: string }> = [];

  for (let index = 0; index < rows.length; index += 1) {
    const rowNumber = index + 2;
    try {
      const payload = rowToEvidence(rows[index]);
      if (!payload.title && !payload.domain && !payload.area) continue;
      const input = evidenceCreateSchema.parse(payload);
      await createEvidence(input, actor);
      created += 1;
    } catch (error) {
      errors.push({ row: rowNumber, message: errorMessage(error) });
    }
  }

  return { created, total: rows.length, errors };
}

export async function importMappingWorkbook(buffer: Buffer, actor?: EvidenceActor) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames.find((name) => name.toLowerCase().includes('mape'))
    || workbook.SheetNames[0];
  if (!sheetName) return { created: 0, total: 0, errors: [{ row: 0, message: 'Workbook has no sheets' }] };

  const rows = XLSX.utils.sheet_to_json<Record<string, any>>(workbook.Sheets[sheetName], {
    defval: '',
    raw: true,
  });

  let created = 0;
  const errors: Array<{ row: number; message: string }> = [];

  for (let index = 0; index < rows.length; index += 1) {
    const rowNumber = index + 2;
    try {
      const get = normalizeRow(rows[index]);
      const requirement = String(get('Requisito', 'Requirement') || '').trim();
      const evidenceTitle = String(get('Evidencia', 'Evidence', 'Documento') || '').trim();
      if (!requirement && !evidenceTitle) continue;
      if (!requirement) throw new Error('El requisito es obligatorio');
      if (!evidenceTitle) throw new Error('La evidencia es obligatoria');

      const evidence = await EvidenceItem.findOne({
        title: new RegExp(`^${evidenceTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
        archived: { $ne: true },
      }).lean();
      if (!evidence) throw new Error(`No se encontró la evidencia "${evidenceTitle}"`);

      await createMapping(
        {
          requirement,
          evidenceId: String(evidence._id),
          language: (mapEnum(get('Idioma', 'Language'), LANGUAGE_MAP, 'other') || 'other') as any,
          notes: String(get('Notas', 'Notes') || '').trim() || undefined,
        },
        actor
      );
      created += 1;
    } catch (error) {
      errors.push({ row: rowNumber, message: errorMessage(error) });
    }
  }

  return { created, total: rows.length, errors };
}
