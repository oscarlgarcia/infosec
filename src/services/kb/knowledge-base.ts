import * as fs from 'fs/promises';
import * as path from 'path';
import {
  ContentPage,
  DocumentModel,
  FAQ,
  KnowledgeBookmark,
  KnowledgeRecentAccess,
  QAEntry,
} from '../../db/mongo/models';
import type {
  Department,
  Document,
  KnowledgeCitation,
  KnowledgeItem,
  KnowledgeProvider,
  KnowledgeSearchResponse,
  KnowledgeSearchResult,
  KnowledgeSourceType,
  KnowledgeSummaryResponse,
} from '../../types';
import { uploadDocument } from './knowledge';

const KNOWLEDGE_SOURCE_TYPES: KnowledgeSourceType[] = ['cms', 'faq', 'qa', 'document'];
const KNOWLEDGE_UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'knowledge');

type SearchableKnowledgeItem = KnowledgeItem & {
  searchableText: string;
};

type CmsPageLean = {
  _id: { toString(): string };
  title: string;
  summary?: string;
  content: string;
  tags?: string[];
  updatedAt?: Date;
  createdAt?: Date;
  categoryId?: { name?: string } | null;
};

type FaqLean = {
  _id: { toString(): string };
  question: string;
  answer: string;
  tags?: string[];
  updatedAt?: Date;
  createdAt?: Date;
  categoryId?: { name?: string } | null;
};

type QaLean = {
  _id: { toString(): string };
  question: string;
  answer: string;
  source?: string;
  department?: Department;
  updatedAt?: Date;
  createdAt?: Date;
};

function normalizeSourceTypes(sourceTypes?: KnowledgeSourceType[]) {
  if (!sourceTypes || sourceTypes.length === 0) return KNOWLEDGE_SOURCE_TYPES;
  return KNOWLEDGE_SOURCE_TYPES.filter((sourceType) => sourceTypes.includes(sourceType));
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function buildSnippet(content: string, query: string) {
  const normalizedContent = normalizeWhitespace(content);
  if (!normalizedContent) return '';

  const lowerContent = normalizedContent.toLowerCase();
  const lowerQuery = query.toLowerCase().trim();
  const matchIndex = lowerQuery ? lowerContent.indexOf(lowerQuery) : -1;

  if (matchIndex === -1) {
    return normalizedContent.slice(0, 220);
  }

  const start = Math.max(0, matchIndex - 80);
  const end = Math.min(normalizedContent.length, matchIndex + lowerQuery.length + 140);
  return normalizedContent.slice(start, end);
}

function scoreKnowledgeItem(item: SearchableKnowledgeItem, query: string) {
  const normalizedQuery = query.toLowerCase().trim();
  if (!normalizedQuery) return 0;

  const tokens = normalizedQuery.split(/\s+/).filter((token) => token.length > 1);
  const haystack = item.searchableText;
  const title = item.title.toLowerCase();
  let score = 0;

  for (const token of tokens) {
    if (title.includes(token)) score += 8;
    const occurrences = haystack.split(token).length - 1;
    score += Math.min(occurrences, 4) * 2;
  }

  if (title.includes(normalizedQuery)) score += 10;
  if (haystack.includes(normalizedQuery)) score += 6;

  return score;
}

function buildOpenTarget(sourceType: KnowledgeSourceType, id: string) {
  return `/knowledge-base?sourceType=${sourceType}&itemId=${id}`;
}

function toPublicSearchResult(item: SearchableKnowledgeItem): KnowledgeSearchResult {
  const { searchableText, summary, ...publicItem } = item;
  return publicItem;
}

function summarizeItems(query: string, items: KnowledgeSearchResult[]): KnowledgeSummaryResponse {
  if (items.length === 0) {
    return {
      query,
      summary: 'No relevant knowledge items were found for this query.',
      resultIds: [],
      citations: [],
    };
  }

  const topItems = items.slice(0, 3);
  const summary = topItems
    .map((item, index) => {
      const label = item.metadata.sourceLabel;
      return `${index + 1}. ${item.title} (${label}): ${item.snippet}`;
    })
    .join('\n');

  const citations: KnowledgeCitation[] = topItems.map((item) => ({
    sourceType: item.sourceType,
    itemId: item.id,
    title: item.title,
    openTarget: item.openTarget,
  }));

  return {
    query,
    summary,
    resultIds: topItems.map((item) => item.id),
    citations,
  };
}

async function getCmsItems(): Promise<SearchableKnowledgeItem[]> {
  const pages = await ContentPage.find({ status: 'published' })
    .populate('categoryId', 'name')
    .sort({ updatedAt: -1 })
    .lean();

  return (pages as unknown as CmsPageLean[]).map((page) => {
    const id = page._id.toString();
    const title = page.title;
    const summary = page.summary || '';
    const content = normalizeWhitespace(page.content || '');
    return {
      id,
      sourceType: 'cms',
      title,
      summary,
      snippet: '',
      content,
      score: 0,
      openTarget: buildOpenTarget('cms', id),
      metadata: {
        sourceLabel: 'CMS',
        category: page.categoryId?.name,
        tags: page.tags || [],
        updatedAt: page.updatedAt,
        createdAt: page.createdAt,
      },
      searchableText: `${title} ${summary} ${content}`.toLowerCase(),
    };
  });
}

async function getFaqItems(): Promise<SearchableKnowledgeItem[]> {
  const faqs = await FAQ.find({ isPublished: true })
    .populate('categoryId', 'name')
    .sort({ updatedAt: -1 })
    .lean();

  return (faqs as unknown as FaqLean[]).map((faq) => {
    const id = faq._id.toString();
    const title = faq.question;
    const summary = faq.answer;
    const content = normalizeWhitespace(faq.answer || '');
    return {
      id,
      sourceType: 'faq',
      title,
      summary,
      snippet: '',
      content,
      score: 0,
      openTarget: buildOpenTarget('faq', id),
      metadata: {
        sourceLabel: 'FAQ',
        category: faq.categoryId?.name,
        tags: faq.tags || [],
        updatedAt: faq.updatedAt,
        createdAt: faq.createdAt,
      },
      searchableText: `${title} ${summary} ${content}`.toLowerCase(),
    };
  });
}

async function getQaItems(): Promise<SearchableKnowledgeItem[]> {
  const entries = await QAEntry.find().sort({ updatedAt: -1 }).lean();

  return (entries as unknown as QaLean[]).map((entry) => {
    const id = entry._id.toString();
    const title = entry.question;
    const summary = entry.answer;
    const content = normalizeWhitespace(entry.answer || '');
    return {
      id,
      sourceType: 'qa',
      title,
      summary,
      snippet: '',
      content,
      score: 0,
      openTarget: buildOpenTarget('qa', id),
      metadata: {
        sourceLabel: 'Q&A',
        department: entry.department,
        updatedAt: entry.updatedAt,
        createdAt: entry.createdAt,
      },
      searchableText: `${title} ${summary} ${content} ${entry.source || ''}`.toLowerCase(),
    };
  });
}

async function getDocumentItems(): Promise<SearchableKnowledgeItem[]> {
  const documents = await DocumentModel.find().sort({ updatedAt: -1 }).lean();

  return documents.map((document: any) => {
    const id = document._id.toString();
    const title = document.originalName;
    const content = normalizeWhitespace(document.content || '');
    return {
      id,
      sourceType: 'document',
      title,
      summary: document.originalName,
      snippet: '',
      content,
      score: 0,
      openTarget: buildOpenTarget('document', id),
      metadata: {
        sourceLabel: 'Document',
        department: document.department,
        updatedAt: document.updatedAt,
        createdAt: document.createdAt,
      },
      searchableText: `${title} ${content}`.toLowerCase(),
    };
  });
}

async function getLocalKnowledgeItems(sourceTypes?: KnowledgeSourceType[]) {
  const normalizedSources = normalizeSourceTypes(sourceTypes);
  const items: SearchableKnowledgeItem[] = [];

  if (normalizedSources.includes('cms')) items.push(...await getCmsItems());
  if (normalizedSources.includes('faq')) items.push(...await getFaqItems());
  if (normalizedSources.includes('qa')) items.push(...await getQaItems());
  if (normalizedSources.includes('document')) items.push(...await getDocumentItems());

  return items;
}

class LocalKnowledgeProvider implements KnowledgeProvider {
  async search(args: {
    query: string;
    sourceTypes?: KnowledgeSourceType[];
    limit?: number;
  }): Promise<KnowledgeSearchResponse> {
    const { query, sourceTypes, limit = 20 } = args;
    const items = await getLocalKnowledgeItems(sourceTypes);

    const results = items
      .map((item) => {
        const score = scoreKnowledgeItem(item, query);
        return {
          ...item,
          score,
          snippet: buildSnippet(item.content || item.summary || item.title, query),
        };
      })
      .filter((item) => item.score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, limit)
      .map(toPublicSearchResult);

    return {
      query,
      results,
      availableSourceTypes: normalizeSourceTypes(sourceTypes),
    };
  }

  async getItem(sourceType: KnowledgeSourceType, id: string): Promise<KnowledgeItem | null> {
    const items = await getLocalKnowledgeItems([sourceType]);
    const item = items.find((entry) => entry.id === id);
    if (!item) return null;

    return {
      ...toPublicSearchResult(item),
      summary: item.summary || item.snippet,
    };
  }

  async summarize(args: {
    query: string;
    sourceTypes?: KnowledgeSourceType[];
    limit?: number;
  }): Promise<KnowledgeSummaryResponse> {
    const searchResponse = await this.search(args);
    return summarizeItems(args.query, searchResponse.results);
  }
}

const knowledgeProvider: KnowledgeProvider = new LocalKnowledgeProvider();

export function getKnowledgeProvider(): KnowledgeProvider {
  return knowledgeProvider;
}

export async function searchUnifiedKnowledgeBase(args: {
  query: string;
  sourceTypes?: KnowledgeSourceType[];
  limit?: number;
}) {
  return knowledgeProvider.search(args);
}

export async function getKnowledgeItemBySource(sourceType: KnowledgeSourceType, id: string) {
  return knowledgeProvider.getItem(sourceType, id);
}

export async function summarizeUnifiedKnowledge(args: {
  query: string;
  sourceTypes?: KnowledgeSourceType[];
  limit?: number;
}) {
  return knowledgeProvider.summarize(args);
}

export async function addKnowledgeBookmark(userId: string, sourceType: KnowledgeSourceType, itemId: string) {
  const existing = await KnowledgeBookmark.findOne({ userId, sourceType, itemId });
  if (existing) return existing;
  return KnowledgeBookmark.create({ userId, sourceType, itemId });
}

export async function removeKnowledgeBookmark(userId: string, sourceType: KnowledgeSourceType, itemId: string) {
  return KnowledgeBookmark.findOneAndDelete({ userId, sourceType, itemId });
}

export async function getKnowledgeBookmarks(userId: string) {
  const bookmarks = await KnowledgeBookmark.find({ userId }).sort({ createdAt: -1 }).lean();
  const resolved = await Promise.all(
    bookmarks.map((bookmark: any) => getKnowledgeItemBySource(bookmark.sourceType, bookmark.itemId))
  );
  return resolved.filter((item): item is KnowledgeItem => !!item);
}

export async function isKnowledgeBookmarked(userId: string, sourceType: KnowledgeSourceType, itemId: string) {
  const bookmark = await KnowledgeBookmark.findOne({ userId, sourceType, itemId });
  return !!bookmark;
}

export async function trackKnowledgeRecent(userId: string, sourceType: KnowledgeSourceType, itemId: string) {
  await KnowledgeRecentAccess.findOneAndDelete({ userId, sourceType, itemId });
  return KnowledgeRecentAccess.create({ userId, sourceType, itemId, accessedAt: new Date() });
}

export async function getKnowledgeRecent(userId: string, limit: number = 10) {
  const recentItems = await KnowledgeRecentAccess.find({ userId })
    .sort({ accessedAt: -1 })
    .limit(limit)
    .lean();

  const resolved = await Promise.all(
    recentItems.map((recent: any) => getKnowledgeItemBySource(recent.sourceType, recent.itemId))
  );

  return resolved.filter((item): item is KnowledgeItem => !!item);
}

export async function uploadKnowledgeDocumentFromBuffer(args: {
  filename: string;
  buffer: Buffer;
  department: Department;
}): Promise<Document> {
  await fs.mkdir(KNOWLEDGE_UPLOAD_DIR, { recursive: true });

  const storedFilename = `${Date.now()}-${args.filename}`;
  const filePath = path.join(KNOWLEDGE_UPLOAD_DIR, storedFilename);
  await fs.writeFile(filePath, args.buffer);

  try {
    return await uploadDocument(filePath, args.filename, args.department);
  } catch (err) {
    await fs.unlink(filePath).catch(() => undefined);
    throw err;
  }
}
