import mongoose from 'mongoose';
import { Client, CveAdvisory, CveImpact, CveRecord } from '../../db/mongo/models';

export interface CatalogFilters {
  q?: string;
  severity?: string;
  kev?: boolean | string;
  ransomware?: boolean | string;
  vendor?: string;
  product?: string;
  hasAdvisory?: boolean | string;
  matchedClientId?: string;
  publishedFrom?: string;
  publishedTo?: string;
  page?: number | string;
  limit?: number | string;
  sort?: string;
}

function escapeRegex(value: string): string {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function asBoolean(value: boolean | string | undefined): boolean | undefined {
  if (value === undefined || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  return value === 'true' || value === '1';
}

export async function listCatalog(filters: CatalogFilters = {}) {
  const query: Record<string, any> = {};

  if (filters.severity) query.severity = filters.severity;
  if (asBoolean(filters.kev)) query['kev.listed'] = true;
  if (asBoolean(filters.ransomware)) query['kev.knownRansomwareCampaignUse'] = /known/i;
  if (filters.vendor) query.vendors = new RegExp(escapeRegex(filters.vendor), 'i');
  if (filters.product) query.products = new RegExp(escapeRegex(filters.product), 'i');
  if (filters.hasAdvisory !== undefined && filters.hasAdvisory !== '') {
    query.advisoryId = asBoolean(filters.hasAdvisory) ? { $exists: true, $ne: null } : { $exists: false };
  }
  if (filters.matchedClientId && mongoose.Types.ObjectId.isValid(filters.matchedClientId)) {
    query['matches.clientId'] = new mongoose.Types.ObjectId(filters.matchedClientId);
  }
  if (filters.publishedFrom || filters.publishedTo) {
    query.publishedAt = {};
    if (filters.publishedFrom) query.publishedAt.$gte = new Date(filters.publishedFrom);
    if (filters.publishedTo) query.publishedAt.$lte = new Date(filters.publishedTo);
  }
  if (filters.q) {
    const pattern = new RegExp(escapeRegex(filters.q), 'i');
    query.$or = [
      { cveId: pattern },
      { title: pattern },
      { products: pattern },
      { vendors: pattern },
      { cwe: pattern },
    ];
  }

  const page = Math.max(1, Number(filters.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(filters.limit) || 25));
  const sort: Record<string, 1 | -1> =
    filters.sort === 'cvss'
      ? { cvssScore: -1, publishedAt: -1 }
      : filters.sort === 'severity'
        ? { cvssScore: -1, publishedAt: -1 }
        : filters.sort === 'kev'
          ? { 'kev.listed': -1, publishedAt: -1 }
          : { publishedAt: -1, createdAt: -1 };

  const [items, total] = await Promise.all([
    CveRecord.find(query)
      .select('-cpes -references')
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    CveRecord.countDocuments(query),
  ]);

  return { items, total, page, limit, hasMore: page * limit < total };
}

export async function getCatalogRecord(key: string) {
  const conditions: any[] = [{ cveId: String(key).toUpperCase() }];
  if (mongoose.Types.ObjectId.isValid(key)) conditions.push({ _id: key });
  const record: any = await CveRecord.findOne({ $or: conditions })
    .populate('matches.clientId', 'name clientType country customerStatus')
    .lean();
  if (!record) throw Object.assign(new Error('CVE record not found'), { statusCode: 404 });

  const advisory: any = record.advisoryId
    ? await CveAdvisory.findById(record.advisoryId).lean()
    : await CveAdvisory.findOne({ cveId: record.cveId }).lean();

  const impacts = advisory
    ? await CveImpact.find({ advisoryId: (advisory as any)._id })
        .populate('clientId', 'name clientType country customerStatus')
        .sort({ affected: -1, createdAt: -1 })
        .lean()
    : await CveImpact.find({ cveId: record.cveId })
        .populate('clientId', 'name clientType country customerStatus')
        .sort({ affected: -1, createdAt: -1 })
        .lean();

  return { ...record, advisory, impacts };
}

export async function getTechnologyInventory(clientId: string) {
  const client: any = await Client.findById(clientId).select('name technologyInventory').lean();
  if (!client) throw Object.assign(new Error('Client not found'), { statusCode: 404 });
  return {
    clientId,
    name: client.name,
    items: (client.technologyInventory || []).map((item: any) => ({
      _id: item._id ? String(item._id) : undefined,
      vendor: item.vendor,
      product: item.product,
      version: item.version,
      cpe: item.cpe,
      criticality: item.criticality || 'medium',
      notes: item.notes,
    })),
  };
}

export interface TechnologyInventoryItemInput {
  vendor: string;
  product: string;
  version?: string;
  cpe?: string;
  criticality?: string;
  notes?: string;
}

export async function updateTechnologyInventory(clientId: string, items: TechnologyInventoryItemInput[]) {
  const client = await Client.findById(clientId);
  if (!client) throw Object.assign(new Error('Client not found'), { statusCode: 404 });
  (client as any).technologyInventory = items.map((item) => ({
    vendor: item.vendor,
    product: item.product,
    version: item.version,
    cpe: item.cpe,
    criticality: item.criticality || 'medium',
    notes: item.notes,
  }));
  await client.save();
  return getTechnologyInventory(clientId);
}
