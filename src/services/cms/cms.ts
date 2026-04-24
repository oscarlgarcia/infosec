import { 
  Category, 
  Tag, 
  ContentPage, 
  Bookmark, 
  RecentAccess,
  FAQ 
} from '../../db/mongo/models';
import { createEmbeddings } from '../llm/openai';
import { addToCollection, queryCollection, deleteFromCollection } from '../../db/vector/chroma';

const CHROMA_CMS_COLLECTION = 'infosec-cms';

// Categories
export async function getAllCategories() {
  return Category.find().sort({ order: 1 }).lean();
}

export async function createCategory(data: { name: string; slug?: string; parentId?: string; description?: string }) {
  const slug = data.slug || data.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  return Category.create({ ...data, slug });
}

export async function updateCategory(id: string, data: Partial<{ name: string; description: string; order: number; parentId: string }>) {
  return Category.findByIdAndUpdate(id, data, { new: true });
}

export async function deleteCategory(id: string) {
  return Category.findByIdAndDelete(id);
}

// Tags
export async function getAllTags() {
  return Tag.find().lean();
}

export async function createTag(data: { name: string; color?: string }) {
  return Tag.create(data);
}

export async function deleteTag(id: string) {
  return Tag.findByIdAndDelete(id);
}

// Content Pages
export async function getAllContentPages(filters?: { status?: string; categoryId?: string; tags?: string[] }) {
  const query: any = {};
  if (filters?.status) query.status = filters.status;
  if (filters?.categoryId) query.categoryId = filters.categoryId;
  if (filters?.tags?.length) query.tags = { $in: filters.tags };
  
  return ContentPage.find(query)
    .populate('categoryId', 'name slug')
    .sort({ updatedAt: -1 })
    .lean();
}

export async function getContentPage(id: string) {
  return ContentPage.findById(id)
    .populate('categoryId', 'name slug')
    .populate('relatedContent', 'title slug')
    .lean();
}

export async function getContentPageBySlug(slug: string) {
  const page = await ContentPage.findOne({ slug })
    .populate('categoryId', 'name slug')
    .populate('relatedContent', 'title slug')
    .lean();
  
  if (page) {
    await ContentPage.findByIdAndUpdate(page._id, { $inc: { viewCount: 1 } });
    await trackRecentAccess(page._id.toString());
  }
  
  return page;
}

export async function createContentPage(data: {
  title: string;
  content: string;
  summary?: string;
  categoryId?: string;
  tags?: string[];
  status?: 'draft' | 'published' | 'archived';
  authorId?: string;
}) {
  const slug = data.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  const normalizedData = {
    ...data,
    categoryId: data.categoryId?.trim() ? data.categoryId.trim() : undefined,
  };
  
  const page = await ContentPage.create({
    ...normalizedData,
    slug,
    versions: [{
      version: 1,
      content: data.content,
      summary: data.summary,
      changedBy: data.authorId || 'system',
      changeNote: 'Initial version'
    }]
  });

  if (data.status === 'published' && data.content) {
    await indexContentPage(page);
  }

  return page;
}

export async function updateContentPage(id: string, data: Partial<{
  title: string;
  content: string;
  summary: string;
  categoryId: string;
  tags: string[];
  status: 'draft' | 'published' | 'archived';
  relatedContent: string[];
  isFeatured: boolean;
}>, authorId?: string) {
  const page = await ContentPage.findById(id);
  if (!page) return null;

  const updateData: any = {
    ...data,
    categoryId: typeof data.categoryId === 'string'
      ? (data.categoryId.trim() ? data.categoryId.trim() : undefined)
      : data.categoryId,
  };
  
  if (data.content && data.content !== page.content) {
    const newVersion = {
      version: (page.versions?.length || 0) + 1,
      content: data.content,
      summary: data.summary,
      changedBy: authorId || 'system',
      changeNote: 'Updated content'
    };
    updateData.versions = [...(page.versions || []), newVersion];
  }

  const updated = await ContentPage.findByIdAndUpdate(id, updateData, { new: true });

  if (data.status === 'published' && data.content) {
    await indexContentPage(updated);
  }

  return updated;
}

export async function deleteContentPage(id: string) {
  await deleteFromCollection(CHROMA_CMS_COLLECTION, [id]);
  return ContentPage.findByIdAndDelete(id);
}

export async function getContentVersions(id: string) {
  const page = await ContentPage.findById(id).select('versions').lean();
  return page?.versions || [];
}

export async function restoreVersion(pageId: string, versionNumber: number) {
  const page = await ContentPage.findById(pageId);
  if (!page) return null;

  const version = page.versions?.find(v => v.version === versionNumber);
  if (!version) return null;

  return updateContentPage(pageId, {
    content: version.content,
    summary: version.summary
  }, version.changedBy);
}

// Index content for search
async function indexContentPage(page: any) {
  try {
    const text = `${page.title} ${page.summary || ''} ${page.content}`.substring(0, 8000);
    const embedding = await createEmbeddings([text]);
    
    await addToCollection(
      CHROMA_CMS_COLLECTION,
      [page._id.toString()],
      [embedding[0]],
      [text],
      [{ 
        title: page.title, 
        slug: page.slug,
        status: page.status 
      }]
    );
  } catch (error) {
    console.error('Error indexing content:', error);
  }
}

// Search content
export async function searchContent(query: string, limit: number = 10) {
  try {
    const queryEmbedding = await createEmbeddings([query]);
    
    const results = await queryCollection(
      CHROMA_CMS_COLLECTION,
      queryEmbedding[0],
      limit,
      { status: 'published' }
    );

    const searchResults: any[] = [];
    if (results.documents && results.ids && results.metadatas) {
      for (let i = 0; i < results.documents.length; i++) {
        const doc = results.documents[i];
        const id = results.ids[i];
        const metadata = results.metadatas[i];
        
        if (doc && id && metadata) {
          searchResults.push({
            id: Array.isArray(id) ? id[0] : id,
            content: Array.isArray(doc) ? doc[0] : doc,
            title: (metadata as any)?.[0]?.title || '',
            slug: (metadata as any)?.[0]?.slug || '',
          });
        }
      }
    }

    return searchResults;
  } catch (error) {
    console.error('Error searching content:', error);
    return [];
  }
}

// Bookmarks
export async function getBookmarks(userId: string = 'default') {
  return Bookmark.find({ userId })
    .populate('contentId', 'title slug summary status')
    .sort({ createdAt: -1 })
    .lean();
}

export async function addBookmark(contentId: string, userId: string = 'default') {
  const existing = await Bookmark.findOne({ userId, contentId });
  if (existing) return existing;
  return Bookmark.create({ userId, contentId });
}

export async function removeBookmark(contentId: string, userId: string = 'default') {
  return Bookmark.findOneAndDelete({ userId, contentId });
}

export async function isBookmarked(contentId: string, userId: string = 'default') {
  const bookmark = await Bookmark.findOne({ userId, contentId });
  return !!bookmark;
}

// Recent Access
export async function trackRecentAccess(contentId: string, userId: string = 'default') {
  await RecentAccess.findOneAndDelete({ userId, contentId });
  return RecentAccess.create({ userId, contentId });
}

export async function getRecentContent(userId: string = 'default', limit: number = 10) {
  return RecentAccess.find({ userId })
    .populate('contentId', 'title slug summary status')
    .sort({ accessedAt: -1 })
    .limit(limit)
    .lean();
}

// FAQs
export async function getAllFAQs(categoryId?: string) {
  const query: any = { isPublished: true };
  if (categoryId) query.categoryId = categoryId;
  return FAQ.find(query).populate('categoryId', 'name').sort({ order: 1 }).lean();
}

export async function createFAQ(data: { question: string; answer: string; categoryId?: string; tags?: string[] }) {
  return FAQ.create(data);
}

export async function updateFAQ(id: string, data: Partial<{ question: string; answer: string; categoryId: string; tags: string[]; order: number; isPublished: boolean }>) {
  return FAQ.findByIdAndUpdate(id, data, { new: true });
}

export async function deleteFAQ(id: string) {
  return FAQ.findByIdAndDelete(id);
}

// Get featured/most viewed
export async function getFeaturedContent(limit: number = 5) {
  return ContentPage.find({ status: 'published', isFeatured: true })
    .select('title slug summary updatedAt')
    .sort({ updatedAt: -1 })
    .limit(limit)
    .lean();
}

export async function getPopularContent(limit: number = 5) {
  return ContentPage.find({ status: 'published' })
    .select('title slug summary viewCount')
    .sort({ viewCount: -1 })
    .limit(limit)
    .lean();
}
