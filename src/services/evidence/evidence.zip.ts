import archiver from 'archiver';
import mongoose from 'mongoose';
import { EvidenceItem } from '../../db/mongo/models';
import { getObjectStream, sanitizeFilename } from '../storage/storage.service';
import { serializeEvidence } from './evidence.service';

function badRequest(message: string, details?: any) {
  return Object.assign(new Error(message), { statusCode: 400, details });
}

function csvCell(value: any) {
  if (value === null || value === undefined) return '';
  const text = String(value);
  if (/[";\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function uniqueArchiveName(used: Set<string>, filename: string) {
  const base = sanitizeFilename(filename || 'evidencia');
  const dot = base.lastIndexOf('.');
  const stem = dot > 0 ? base.slice(0, dot) : base;
  const extension = dot > 0 ? base.slice(dot) : '';
  let candidate = base;
  let index = 2;
  while (used.has(candidate.toLowerCase())) {
    candidate = `${stem} (${index})${extension}`;
    index += 1;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

function manifestRow(item: any, archiveName: string, location: string) {
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
    item.shareMode,
    item.ndaRequired ? 'Sí' : 'No',
    item.version,
    item.owner,
    item.status,
    item.origin,
    archiveName,
    location,
    item.tags.join(', '),
    item.notes,
  ];
}

/**
 * Builds a ZIP with every downloadable evidence file plus a manifest.csv that
 * lists all selected items (including local paths and KB documents, which have
 * no bytes to package).
 */
export async function buildEvidenceZip(ids: string[]) {
  const validIds = ids.filter((id) => mongoose.Types.ObjectId.isValid(id));
  if (!validIds.length) throw badRequest('No valid evidence ids were provided');

  const items = await EvidenceItem.find({ _id: { $in: validIds } }).lean();
  if (!items.length) throw badRequest('No evidence found for the selected ids');

  const archive = archiver('zip', { zlib: { level: 9 } });
  const usedNames = new Set<string>();
  const rows: string[][] = [];

  for (const raw of items) {
    const item: any = serializeEvidence(raw);
    let archiveName = '';
    let location = '';

    if (item.asset && (raw as any).asset?.storageKey) {
      try {
        const stream = await getObjectStream((raw as any).asset.storageKey);
        archiveName = uniqueArchiveName(
          usedNames,
          item.asset.originalName || item.asset.filename || `${item.title}`
        );
        archive.append(stream, { name: `evidencias/${archiveName}` });
      } catch (error) {
        location = 'No se pudo leer el archivo almacenado';
      }
    } else if (item.localPath) {
      location = item.localPath;
    } else if (item.sourceUrl) {
      location = item.sourceUrl;
    } else {
      location = 'Sin archivo ni ubicación';
    }

    rows.push(manifestRow(item, archiveName, location));
  }

  const headers = [
    'Documento',
    'Dominio',
    'Área',
    'Proceso',
    'Frameworks',
    'Controles',
    'Cubre',
    'Idioma',
    'Tipo',
    'Compartición',
    'NDA',
    'Versión',
    'Propietario',
    'Estado',
    'Origen',
    'Archivo en ZIP',
    'Ubicación',
    'Etiquetas',
    'Notas',
  ];

  const csv = [
    headers.map(csvCell).join(';'),
    ...rows.map((row) => row.map(csvCell).join(';')),
  ].join('\r\n');

  // BOM keeps accents readable when the manifest is opened in Excel.
  archive.append(`\uFEFF${csv}`, { name: 'manifest.csv' });
  archive.finalize();

  return archive;
}
