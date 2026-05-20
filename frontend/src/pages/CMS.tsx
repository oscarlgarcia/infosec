import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { Layout } from '../components/Layout';
import { useApi } from '../contexts/AuthContext';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import TextAlign from '@tiptap/extension-text-align';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { Image as ImageExt } from '@tiptap/extension-image';
import { Placeholder } from '@tiptap/extension-placeholder';

interface Category {
  _id: string;
  name: string;
  slug: string;
  description?: string;
}

interface ContentPage {
  _id: string;
  title: string;
  slug: string;
  content: string;
  summary?: string;
  categoryId?: Category;
  tags: string[];
  status: 'draft' | 'published' | 'archived';
  viewCount: number;
  isFeatured: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Bookmark {
  _id: string;
  contentId: ContentPage;
  createdAt: string;
}

interface RecentAccess {
  _id: string;
  contentId: ContentPage;
  accessedAt: string;
}

interface ContentVersion {
  version: number;
  changedBy?: string;
  changeNote?: string;
  createdAt: string;
}

type Tab = 'pages' | 'categories' | 'tags';

const PAGE_SIZE = 20;

function RichTextEditor({ content, onChange }: { content: string; onChange: (c: string) => void }) {
  const [linkUrl, setLinkUrl] = useState('');
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [showImageInput, setShowImageInput] = useState(false);
  const [imageUrl, setImageUrl] = useState('');

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: { HTMLAttributes: { class: 'code-block' } } }),
      Underline,
      Link.configure({ openOnClick: false }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Subscript,
      Superscript,
      TextStyle,
      Color,
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      ImageExt,
      Placeholder.configure({ placeholder: 'Escribe aquí el contenido...' }),
    ],
    content,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  if (!editor) return <div className="cms-editor-loading"><em>Cargando editor...</em></div>;

  const setLink = () => {
    if (linkUrl) editor.chain().focus().extendMarkRange('link').setLink({ href: linkUrl }).run();
    else editor.chain().focus().unsetLink().run();
    setLinkUrl('');
    setShowLinkInput(false);
  };

  const addImage = () => {
    if (imageUrl) {
      editor.chain().focus().setImage({ src: imageUrl }).run();
      setImageUrl('');
      setShowImageInput(false);
    }
  };

  const addTable = () => {
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  };

  const ToolBtn = ({ onClick, active, title, children }: any) => (
    <button type="button" onClick={onClick} className={`cms-tb-btn${active ? ' active' : ''}`} title={title}>
      {children}
    </button>
  );

  const Sep = () => <span className="cms-tb-sep" />;

  return (
    <div className="cms-rteditor">
      <div className="cms-toolbar">
        <ToolBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold"><strong>B</strong></ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic"><em>I</em></ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Underline"><u>U</u></ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="Strikethrough"><s>S</s></ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive('code')} title="Code">{'</>'}</ToolBtn>
        <Sep />
        <ToolBtn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} title="Heading 1">H1</ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="Heading 2">H2</ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="Heading 3">H3</ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().setParagraph().run()} active={editor.isActive('paragraph')} title="Paragraph">P</ToolBtn>
        <Sep />
        <ToolBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Bullet list">≡</ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Ordered list">1.</ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().sinkListItem('listItem').run()} title="Indent">→</ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().liftListItem('listItem').run()} title="Outdent">←</ToolBtn>
        <Sep />
        <ToolBtn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Blockquote">"</ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive('codeBlock')} title="Code block">{'{ }'}</ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Horizontal rule">—</ToolBtn>
        <Sep />
        <ToolBtn onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} title="Align left">⬅</ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} title="Center">⬌</ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} title="Align right">➡</ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().setTextAlign('justify').run()} active={editor.isActive({ textAlign: 'justify' })} title="Justify">≡</ToolBtn>
        <Sep />
        <ToolBtn onClick={() => editor.chain().focus().toggleSubscript().run()} active={editor.isActive('subscript')} title="Subscript">X₂</ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleSuperscript().run()} active={editor.isActive('superscript')} title="Superscript">X²</ToolBtn>
        <Sep />
        <ToolBtn onClick={addTable} active={false} title="Insert table">⊞</ToolBtn>
        <ToolBtn onClick={() => { setShowImageInput(true); setShowLinkInput(false); }} active={false} title="Insert image">🖼</ToolBtn>
        <ToolBtn onClick={() => { setShowLinkInput(!showLinkInput); setShowImageInput(false); }} active={editor.isActive('link')} title="Link">🔗</ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().unsetAllMarks().run()} title="Clear format">⌫</ToolBtn>
        <Sep />
        <ToolBtn onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo">↶</ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo">↷</ToolBtn>
      </div>

      {showLinkInput && (
        <div className="cms-tb-inputbar">
          <input type="url" placeholder="URL del enlace..." value={linkUrl} onChange={e => setLinkUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && setLink()} />
          <button type="button" onClick={setLink}>✓</button>
          <button type="button" onClick={() => { setLinkUrl(''); setShowLinkInput(false); }}>✕</button>
        </div>
      )}
      {showImageInput && (
        <div className="cms-tb-inputbar">
          <input type="url" placeholder="URL de la imagen..." value={imageUrl} onChange={e => setImageUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && addImage()} />
          <button type="button" onClick={addImage}>✓</button>
          <button type="button" onClick={() => { setImageUrl(''); setShowImageInput(false); }}>✕</button>
        </div>
      )}

      <EditorContent editor={editor} className="cms-editor-content" />
      <div className="cms-editor-footer">
        <span>{editor.storage.characterCount?.characters?.() ?? editor.getText().length} chars</span>
        <span>{editor.storage.characterCount?.words?.() ?? editor.getText().split(/\s+/).filter(Boolean).length} words</span>
      </div>
    </div>
  );
}

export function CMS() {
  const { language } = useLanguage();
  const t = (es: string, en: string) => language === 'es' ? es : en;
  const apiFetch = useApi();

  const [activeTab, setActiveTab] = useState<Tab>('pages');
  const [pages, setPages] = useState<ContentPage[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [recent, setRecent] = useState<RecentAccess[]>([]);
  const [searchResults, setSearchResults] = useState<ContentPage[]>([]);
  const [versions, setVersions] = useState<ContentVersion[]>([]);

  const [selectedPage, setSelectedPage] = useState<ContentPage | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showNewPage, setShowNewPage] = useState(false);
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const [filter, setFilter] = useState({ status: '', categoryId: '', search: '' });
  const [sortKey, setSortKey] = useState<string>('updatedAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [pageNum, setPageNum] = useState(1);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const autoSaveTimer = useRef<any>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [newTagName, setNewTagName] = useState('');

  const [formData, setFormData] = useState({
    title: '', content: '', summary: '', categoryId: '',
    tags: [] as string[], status: 'draft' as 'draft' | 'published' | 'archived'
  });

  const [categoryForm, setCategoryForm] = useState({ name: '', description: '' });

  // ── Data fetching ──
  useEffect(() => { fetchCategories(); fetchPages(); }, [filter]);

  useEffect(() => { if (activeTab === 'tags') fetchTags(); }, [activeTab]);

  const fetchCategories = async () => {
    try { const r = await apiFetch('/cms/categories'); if (r.ok) setCategories(await r.json()); }
    catch (e) { console.error('fetchCategories', e); }
  };

  const fetchTags = async () => {
    try { const r = await apiFetch('/cms/tags'); if (r.ok) setTags(await r.json()); }
    catch (e) { console.error('fetchTags', e); }
  };

  const fetchPages = async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams();
      if (filter.status) params.set('status', filter.status);
      if (filter.categoryId) params.set('categoryId', filter.categoryId);
      const r = await apiFetch(`/cms/pages?${params}`);
      if (r.ok) { const d = await r.json(); setPages(d); setPageNum(1); }
    } catch (e) { console.error('fetchPages', e); setError(t('Error loading pages', 'Error al cargar páginas')); }
    finally { setLoading(false); }
  };

  const fetchBookmarks = async () => {
    try { const r = await apiFetch('/cms/bookmarks'); if (r.ok) setBookmarks(await r.json()); }
    catch (e) { console.error('fetchBookmarks', e); }
  };

  const fetchRecent = async () => {
    try { const r = await apiFetch('/cms/recent?limit=20'); if (r.ok) setRecent(await r.json()); }
    catch (e) { console.error('fetchRecent', e); }
  };

  const fetchVersions = async (pageId: string) => {
    try { const r = await apiFetch(`/cms/pages/${pageId}/versions`); if (r.ok) setVersions(await r.json()); }
    catch (e) { console.error('fetchVersions', e); }
  };

  // ── Stats ──
  const stats = useMemo(() => ({
    total: pages.length,
    published: pages.filter(p => p.status === 'published').length,
    draft: pages.filter(p => p.status === 'draft').length,
    archived: pages.filter(p => p.status === 'archived').length,
    views: pages.reduce((s, p) => s + (p.viewCount || 0), 0),
  }), [pages]);

  // ── Sort & Filter ──
  const pageCountByCategory = useMemo(() => {
    const m: Record<string, number> = {};
    pages.forEach(p => { const k = p.categoryId?._id || ''; m[k] = (m[k] || 0) + 1; });
    return m;
  }, [pages]);

  const filteredPages = useMemo(() => {
    let list = [...pages];
    if (filter.search) {
      const q = filter.search.toLowerCase();
      list = list.filter(p => p.title.toLowerCase().includes(q) || p.summary?.toLowerCase().includes(q));
    }
    list.sort((a, b) => {
      const ak = (a as any)[sortKey]; const bk = (b as any)[sortKey];
      if (sortKey === 'viewCount') return sortDir === 'desc' ? (bk || 0) - (ak || 0) : (ak || 0) - (bk || 0);
      if (sortKey === 'categoryId') return sortDir === 'desc' ? (b.categoryId?.name || '').localeCompare(a.categoryId?.name || '') : (a.categoryId?.name || '').localeCompare(b.categoryId?.name || '');
      const cmp = String(ak || '').localeCompare(String(bk || ''));
      return sortDir === 'desc' ? -cmp : cmp;
    });
    return list;
  }, [pages, filter, sortKey, sortDir]);

  const totalPages = Math.ceil(filteredPages.length / PAGE_SIZE);
  const displayedPages = filteredPages.length > 30 ? filteredPages.slice((pageNum - 1) * PAGE_SIZE, pageNum * PAGE_SIZE) : filteredPages;

  // ── Auto-save ──
  useEffect(() => {
    if (!isEditing || !selectedPage) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(async () => {
      setAutoSaveStatus('saving');
      try {
        await apiFetch(`/cms/pages/${selectedPage._id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
        setAutoSaveStatus('saved');
        setTimeout(() => setAutoSaveStatus('idle'), 2000);
      } catch { setAutoSaveStatus('idle'); }
    }, 30000);
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  }, [formData, isEditing, selectedPage]);

  // ── Handlers ──
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const r = await apiFetch(`/cms/search?q=${encodeURIComponent(searchQuery)}&limit=20`);
      if (r.ok) setSearchResults((await r.json()).map((x: any) => ({
        _id: x.id, title: x.title, slug: x.slug, content: x.content,
        summary: '', tags: [], status: 'published' as const, viewCount: 0, isFeatured: false, createdAt: '', updatedAt: ''
      })));
    } catch (e) { console.error('search', e); }
    finally { setIsSearching(false); }
  };

  const handleCreatePage = async () => {
    setIsSaving(true);
    try {
      await apiFetch('/cms/pages', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      setShowNewPage(false);
      setFormData({ title: '', content: '', summary: '', categoryId: '', tags: [], status: 'draft' });
      fetchPages();
    } catch (e) { console.error('createPage', e); }
    finally { setIsSaving(false); }
  };

  const handleUpdatePage = async () => {
    if (!selectedPage) return;
    setIsSaving(true);
    try {
      await apiFetch(`/cms/pages/${selectedPage._id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      setIsEditing(false);
      fetchPages();
      const r = await apiFetch(`/cms/pages/${selectedPage._id}`);
      if (r.ok) setSelectedPage(await r.json());
    } catch (e) { console.error('updatePage', e); }
    finally { setIsSaving(false); }
  };

  const handleDeletePage = async (id: string) => {
    if (!confirm(t('Delete page?', '¿Eliminar página?'))) return;
    try {
      await apiFetch(`/cms/pages/${id}`, { method: 'DELETE' });
      setSelectedPage(null); fetchPages();
    } catch (e) { console.error('deletePage', e); }
  };

  const handleDuplicatePage = async (page: ContentPage) => {
    try {
      await apiFetch('/cms/pages', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: `${page.title} (${t('copy', 'copia')})`, content: page.content, summary: page.summary, categoryId: page.categoryId?._id || '', tags: page.tags, status: 'draft' }),
      });
      fetchPages();
    } catch (e) { console.error('duplicate', e); }
  };

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await apiFetch(`/cms/pages/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      fetchPages();
      if (selectedPage?._id === id) {
        const r = await apiFetch(`/cms/pages/${id}`);
        if (r.ok) setSelectedPage(await r.json());
      }
    } catch (e) { console.error('statusChange', e); }
  };

  const handleToggleBookmark = async (pageId: string) => {
    try {
      const isBm = bookmarks.some(b => b.contentId?._id === pageId);
      if (isBm) await apiFetch(`/cms/bookmarks/${pageId}`, { method: 'DELETE' });
      else await apiFetch('/cms/bookmarks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contentId: pageId }) });
      fetchBookmarks();
    } catch (e) { console.error('bookmark', e); }
  };

  const handleCreateCategory = async () => {
    try {
      await apiFetch('/cms/categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(categoryForm) });
      setShowNewCategory(false); setCategoryForm({ name: '', description: '' }); fetchCategories();
    } catch (e) { console.error('createCategory', e); }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm(t('Delete category?', '¿Eliminar categoría?'))) return;
    try { await apiFetch(`/cms/categories/${id}`, { method: 'DELETE' }); fetchCategories(); }
    catch (e) { console.error('deleteCategory', e); }
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;
    try {
      await apiFetch('/cms/tags', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newTagName }) });
      setNewTagName(''); fetchTags();
    } catch (e) { console.error('createTag', e); }
  };

  const handleDeleteTag = async (id: string) => {
    if (!confirm(t('Delete tag?', '¿Eliminar etiqueta?'))) return;
    try { await apiFetch(`/cms/tags/${id}`, { method: 'DELETE' }); fetchTags(); }
    catch (e) { console.error('deleteTag', e); }
  };

  const openEdit = (page: ContentPage) => {
    setFormData({ title: page.title, content: page.content, summary: page.summary || '', categoryId: page.categoryId?._id || '', tags: page.tags, status: page.status });
    setIsEditing(true); setShowPreview(false); setShowVersions(false);
  };

  const viewPage = (page: ContentPage) => {
    setSelectedPage(page); setIsEditing(false); setShowNewPage(false); setShowPreview(false); setShowVersions(false);
    fetchBookmarks(); fetchRecent();
  };

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const SortIcon = ({ k }: { k: string }) => sortKey === k ? <span className="cms-sort-icon">{sortDir === 'desc' ? '▼' : '▲'}</span> : null;

  const statusColor = (s: string) => {
    switch (s) {
      case 'published': return '#22C55E';
      case 'draft': return '#F59E0B';
      case 'archived': return '#6B7280';
      default: return '#6B7280';
    }
  };

  const statusLabel = (s: string) => {
    switch (s) {
      case 'published': return t('Published', 'Publicado');
      case 'draft': return t('Draft', 'Borrador');
      case 'archived': return t('Archived', 'Archivado');
      default: return s;
    }
  };

  // ── Render Dashboard ──
  const renderDashboard = () => (
    <div className="cms-dashboard">
      <div className="cms-stat-card"><span className="cms-stat-value">{stats.total}</span><span className="cms-stat-label">{t('Total Pages', 'Total Páginas')}</span></div>
      <div className="cms-stat-card" style={{ borderTopColor: '#22C55E' }}><span className="cms-stat-value" style={{ color: '#22C55E' }}>{stats.published}</span><span className="cms-stat-label">{t('Published', 'Publicados')}</span></div>
      <div className="cms-stat-card" style={{ borderTopColor: '#F59E0B' }}><span className="cms-stat-value" style={{ color: '#F59E0B' }}>{stats.draft}</span><span className="cms-stat-label">{t('Drafts', 'Borradores')}</span></div>
      <div className="cms-stat-card" style={{ borderTopColor: '#6B7280' }}><span className="cms-stat-value" style={{ color: '#6B7280' }}>{stats.archived}</span><span className="cms-stat-label">{t('Archived', 'Archivados')}</span></div>
      <div className="cms-stat-card" style={{ borderTopColor: '#8B5CF6' }}><span className="cms-stat-value" style={{ color: '#8B5CF6' }}>{stats.views}</span><span className="cms-stat-label">{t('Total Views', 'Vistas Totales')}</span></div>
    </div>
  );

  // ── Render Sidebar ──
  const renderSidebar = () => (
    <div className={`cms-sidebar${sidebarOpen ? '' : ' collapsed'}`}>
      <div className="cms-sb-header">
        <span className="cms-sb-title">{t('Navigate', 'Navegar')}</span>
        <button className="cms-sb-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>{sidebarOpen ? '◀' : '▶'}</button>
      </div>

      <div className="cms-sb-section">
        <div className="cms-sb-section-title">{t('Categories', 'Categorías')}</div>
        <div className={`cms-sb-item${!filter.categoryId ? ' active' : ''}`} onClick={() => setFilter({ ...filter, categoryId: '' })}>
          📁 {t('All', 'Todas')} <span className="cms-sb-count">{pages.length}</span>
        </div>
        {categories.map(cat => (
          <div key={cat._id} className={`cms-sb-item${filter.categoryId === cat._id ? ' active' : ''}`} onClick={() => setFilter({ ...filter, categoryId: cat._id })}>
            📁 {cat.name} <span className="cms-sb-count">{pageCountByCategory[cat._id] || 0}</span>
          </div>
        ))}
      </div>

      <div className="cms-sb-section">
        <div className="cms-sb-section-title">{t('Quick Access', 'Acceso Rápido')}</div>
        <div className="cms-sb-item" onClick={() => { fetchBookmarks(); setActiveTab('pages'); }}>
          ⭐ {t('Bookmarks', 'Favoritos')} <span className="cms-sb-count">{bookmarks.length}</span>
        </div>
        <div className="cms-sb-item" onClick={() => { fetchRecent(); setActiveTab('pages'); }}>
          🕐 {t('Recent', 'Recientes')}
        </div>
      </div>

      {tags.length > 0 && (
        <div className="cms-sb-section">
          <div className="cms-sb-section-title">{t('Tags', 'Etiquetas')}</div>
          {tags.map((t: any) => (
            <div key={t._id} className="cms-sb-item" style={{ fontSize: 12 }}>
              <span className="cms-tag-dot" style={{ background: t.color || '#6B7280' }} /> {t.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // ── Render Pages Tab ──
  const renderPagesTab = () => (
    <div className="cms-pages-layout">
      {renderSidebar()}

      <div className="cms-main">
        <div className="cms-main-header">
          <div className="cms-main-search">
            <input type="text" placeholder={t('Search pages...', 'Buscar páginas...')} value={filter.search} onChange={e => setFilter({ ...filter, search: e.target.value })} className="cms-search-input" />
            <select value={filter.status} onChange={e => setFilter({ ...filter, status: e.target.value })} className="cms-filter-select">
              <option value="">{t('All statuses', 'Todos')}</option>
              <option value="draft">{t('Draft', 'Borrador')}</option>
              <option value="published">{t('Published', 'Publicado')}</option>
              <option value="archived">{t('Archived', 'Archivado')}</option>
            </select>
          </div>
          <button className="btn-primary" onClick={() => { setShowNewPage(true); setSelectedPage(null); }}>
            + {t('New', 'Nuevo')}
          </button>
        </div>

        <div className="cms-vector-bar">
          <input type="text" placeholder={t('Vector search...', 'Búsqueda semántica...')} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()} className="cms-search-input" />
          <button className="btn-secondary btn-sm" onClick={handleSearch} disabled={isSearching}>
            {isSearching ? '...' : '🔍'}
          </button>
        </div>

        {searchResults.length > 0 && (
          <div className="cms-vector-results">
            <div className="cms-vector-results-header">
              <span>{t('Vector search results', 'Resultados de búsqueda')}</span>
              <button className="btn-sm" onClick={() => setSearchResults([])}>✕</button>
            </div>
            {searchResults.map(r => (
              <div key={r._id} className="cms-vector-item" onClick={() => viewPage(r)}>
                <div className="cms-item-title">{r.title}</div>
                <div className="cms-item-meta">{r.content?.substring(0, 120)}...</div>
              </div>
            ))}
          </div>
        )}

        <div className="cms-table-wrapper">
          {loading ? (
            <div className="cms-loading">{t('Loading...', 'Cargando...')}</div>
          ) : displayedPages.length === 0 ? (
            <div className="cms-empty">
              {t('No pages found', 'No se encontraron páginas')}
            </div>
          ) : (
            <table className="cms-table">
              <thead>
                <tr>
                  <th className="cms-th-sortable" onClick={() => toggleSort('title')}>
                    {t('Title', 'Título')} <SortIcon k="title" />
                  </th>
                  <th className="cms-th-sortable" onClick={() => toggleSort('status')}>
                    {t('Status', 'Estado')} <SortIcon k="status" />
                  </th>
                  <th className="cms-th-sortable" onClick={() => toggleSort('categoryId')}>
                    {t('Category', 'Categoría')} <SortIcon k="categoryId" />
                  </th>
                  <th className="cms-th-sortable" onClick={() => toggleSort('viewCount')}>
                    {t('Views', 'Vistas')} <SortIcon k="viewCount" />
                  </th>
                  <th className="cms-th-sortable" onClick={() => toggleSort('updatedAt')}>
                    {t('Updated', 'Actualizado')} <SortIcon k="updatedAt" />
                  </th>
                  <th className="cms-th-actions">{t('Actions', 'Acciones')}</th>
                </tr>
              </thead>
              <tbody>
                {displayedPages.map(page => {
                  const isBm = bookmarks.some(b => b.contentId?._id === page._id);
                  return (
                    <tr key={page._id} className={`cms-tr${selectedPage?._id === page._id ? ' active' : ''}`}>
                      <td className="cms-td-title" onClick={() => viewPage(page)}>
                        <span className="cms-page-title">{page.title}</span>
                        {page.summary && <span className="cms-page-summary">{page.summary}</span>}
                      </td>
                      <td>
                        <select className="cms-status-select" value={page.status} onChange={e => handleStatusChange(page._id, e.target.value)} style={{ borderColor: statusColor(page.status), color: statusColor(page.status) }}
                          onClick={e => e.stopPropagation()}>
                          <option value="draft">{t('Draft', 'Borrador')}</option>
                          <option value="published">{t('Published', 'Publicado')}</option>
                          <option value="archived">{t('Archived', 'Archivado')}</option>
                        </select>
                      </td>
                      <td>{page.categoryId?.name || '-'}</td>
                      <td>{page.viewCount}</td>
                      <td className="cms-td-date">{new Date(page.updatedAt).toLocaleDateString()}</td>
                      <td className="cms-td-actions" onClick={e => e.stopPropagation()}>
                        <button className="cms-action-btn" title={t('Edit', 'Editar')} onClick={() => { viewPage(page); openEdit(page); }}>✏️</button>
                        <button className="cms-action-btn" title={t('Duplicate', 'Duplicar')} onClick={() => handleDuplicatePage(page)}>📋</button>
                        <button className="cms-action-btn" title={isBm ? t('Remove bookmark', 'Quitar favorito') : t('Bookmark', 'Favorito')} onClick={() => handleToggleBookmark(page._id)}>{isBm ? '⭐' : '☆'}</button>
                        <button className="cms-action-btn" title={t('Delete', 'Eliminar')} onClick={() => handleDeletePage(page._id)}>🗑️</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {filteredPages.length > 30 && totalPages > 1 && (
          <div className="pagination">
            <button disabled={pageNum <= 1} onClick={() => setPageNum(p => p - 1)}>←</button>
            <span>{pageNum} / {totalPages}</span>
            <button disabled={pageNum >= totalPages} onClick={() => setPageNum(p => p + 1)}>→</button>
          </div>
        )}
      </div>
    </div>
  );

  // ── Render Editor / View ──
  const renderMainContent = () => {
    if (showNewPage) {
      return (
        <div className="cms-editor-panel">
          <div className="cms-editor-header">
            <h3>{t('New Page', 'Nueva Página')}</h3>
          </div>
          {renderEditorForm(false)}
        </div>
      );
    }

    if (!selectedPage) {
      return (
        <div className="cms-empty-view">
          <div className="cms-empty-icon">📄</div>
          <h3>{t('Select a page', 'Selecciona una página')}</h3>
          <p>{t('Choose a page from the list or create a new one', 'Elige una página de la lista o crea una nueva')}</p>
          <button className="btn-primary" onClick={() => { setShowNewPage(true); }}>+ {t('New Page', 'Nueva Página')}</button>
        </div>
      );
    }

    if (isEditing) {
      return (
        <div className="cms-editor-panel">
          <div className="cms-editor-header">
            <h3>{t('Edit Page', 'Editar Página')} — {selectedPage.title}</h3>
            <div className="cms-editor-header-right">
              <span className={`cms-autosave cms-autosave-${autoSaveStatus}`}>
                {autoSaveStatus === 'saving' ? t('Saving...', 'Guardando...') : autoSaveStatus === 'saved' ? t('Saved', 'Guardado') : ''}
              </span>
              <button className="btn-secondary btn-sm" onClick={() => { setShowPreview(true); setIsEditing(false); }}>
                👁 {t('Preview', 'Vista previa')}
              </button>
            </div>
          </div>
          {renderEditorForm(true)}
        </div>
      );
    }

    if (showPreview) {
      return (
        <div className="cms-view">
          <div className="cms-view-header">
            <h1>{selectedPage.title}</h1>
            <div className="cms-view-actions">
              <button className="btn-primary btn-sm" onClick={() => openEdit(selectedPage)}>✏️ {t('Edit', 'Editar')}</button>
              <button className="btn-secondary btn-sm" onClick={() => setShowPreview(false)}>← {t('View', 'Ver')}</button>
            </div>
          </div>
          <div className="cms-view-content" dangerouslySetInnerHTML={{ __html: formData.content || '<p><em>Sin contenido</em></p>' }} />
        </div>
      );
    }

    // View mode
    return (
      <div className="cms-view">
        <div className="cms-view-header">
          <div>
            <h1>{selectedPage.title}</h1>
            <div className="cms-view-meta">
              <span className="cms-status-badge" style={{ background: statusColor(selectedPage.status) }}>{statusLabel(selectedPage.status)}</span>
              {selectedPage.categoryId && <span className="cms-view-cat">{selectedPage.categoryId.name}</span>}
              <span className="cms-view-stat">👁 {selectedPage.viewCount}</span>
              <span className="cms-view-stat">{new Date(selectedPage.updatedAt).toLocaleDateString()}</span>
              <button className="cms-action-btn" onClick={() => handleToggleBookmark(selectedPage._id)}>
                {bookmarks.some(b => b.contentId?._id === selectedPage._id) ? '⭐' : '☆'}
              </button>
            </div>
          </div>
          <div className="cms-view-actions">
            {showVersions && (
              <div className="cms-versions-panel">
                <h4>{t('Version History', 'Historial de Versiones')}</h4>
                {versions.length === 0 ? <p className="cms-empty">{t('No versions', 'Sin versiones')}</p> : (
                  versions.map((v, i) => (
                    <div key={i} className="cms-version-item">
                      <strong>v{v.version}</strong>
                      {v.changeNote && <span> — {v.changeNote}</span>}
                      <span className="cms-date">{v.createdAt ? new Date(v.createdAt).toLocaleDateString() : ''}</span>
                    </div>
                  ))
                )}
                <button className="btn-sm" onClick={() => setShowVersions(false)}>{t('Close', 'Cerrar')}</button>
              </div>
            )}
            <button className="btn-primary btn-sm" onClick={() => openEdit(selectedPage)}>✏️ {t('Edit', 'Editar')}</button>
            <button className="btn-secondary btn-sm" onClick={() => { setShowVersions(!showVersions); if (!showVersions) fetchVersions(selectedPage._id); }}>
              🕐 {t('Versions', 'Versiones')}
            </button>
            <button className="btn-secondary btn-sm" onClick={() => { setShowPreview(true); setFormData({ title: selectedPage.title, content: selectedPage.content, summary: selectedPage.summary || '', categoryId: selectedPage.categoryId?._id || '', tags: selectedPage.tags, status: selectedPage.status }); }}>
              👁 {t('Preview', 'Previsualizar')}
            </button>
            <button className="btn-delete btn-sm" onClick={() => handleDeletePage(selectedPage._id)}>🗑️</button>
          </div>
        </div>

        {selectedPage.summary && (
          <div className="cms-view-summary">
            <h4>{t('Summary', 'Resumen')}</h4>
            <p>{selectedPage.summary}</p>
          </div>
        )}

        <div className="cms-view-content" dangerouslySetInnerHTML={{ __html: selectedPage.content || '<p><em>Sin contenido</em></p>' }} />

        {selectedPage.tags.length > 0 && (
          <div className="cms-view-tags">
            {selectedPage.tags.map((tag, i) => <span key={i} className="cms-tag-badge">{tag}</span>)}
          </div>
        )}
      </div>
    );
  };

  const renderEditorForm = (isEdit: boolean) => (
    <div className="cms-form">
      <div className="form-group">
        <label>{t('Title', 'Título')}</label>
        <input type="text" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} />
      </div>
      <div className="form-group">
        <label>{t('Summary', 'Resumen')}</label>
        <textarea value={formData.summary} onChange={e => setFormData({ ...formData, summary: e.target.value })} rows={2} />
      </div>
      <div className="form-group">
        <label>{t('Content', 'Contenido')}</label>
        <RichTextEditor content={formData.content} onChange={c => setFormData({ ...formData, content: c })} />
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>{t('Category', 'Categoría')}</label>
          <select value={formData.categoryId} onChange={e => setFormData({ ...formData, categoryId: e.target.value })}>
            <option value="">{t('No category', 'Sin categoría')}</option>
            {categories.map(cat => <option key={cat._id} value={cat._id}>{cat.name}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>{t('Status', 'Estado')}</label>
          <select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value as any })}>
            <option value="draft">{t('Draft', 'Borrador')}</option>
            <option value="published">{t('Published', 'Publicado')}</option>
            <option value="archived">{t('Archived', 'Archivado')}</option>
          </select>
        </div>
      </div>
      <div className="form-group">
        <label>{t('Tags', 'Etiquetas')}</label>
        <div className="cms-tags-input">
          {formData.tags.map((tag, i) => (
            <span key={i} className="cms-tag-badge">
              {tag}
              <button type="button" className="cms-tag-rm" onClick={() => setFormData({ ...formData, tags: formData.tags.filter((_, j) => j !== i) })}>✕</button>
            </span>
          ))}
          <input type="text" placeholder={t('Add tag...', 'Añadir etiqueta...')} className="cms-tag-add-input"
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.target as HTMLInputElement).value.trim()) {
                setFormData({ ...formData, tags: [...formData.tags, (e.target as HTMLInputElement).value.trim()] });
                (e.target as HTMLInputElement).value = '';
              }
            }}
          />
        </div>
      </div>
      <div className="form-actions">
        <button className="btn-cancel" onClick={() => { setIsEditing(false); setShowNewPage(false); }}>
          {t('Cancel', 'Cancelar')}
        </button>
        <button className="btn-submit" onClick={isEdit ? handleUpdatePage : handleCreatePage} disabled={isSaving}>
          {isSaving ? t('Saving...', 'Guardando...') : isEdit ? t('Save', 'Guardar') : t('Create', 'Crear')}
        </button>
      </div>
    </div>
  );

  // ── Render Categories Tab ──
  const renderCategoriesTab = () => (
    <div className="cms-tab-content">
      <div className="cms-tab-header">
        <h2>{t('Categories', 'Categorías')}</h2>
        <button className="btn-primary btn-sm" onClick={() => setShowNewCategory(true)}>+ {t('New', 'Nueva')}</button>
      </div>

      {showNewCategory && (
        <div className="cms-card cms-card-form">
          <h4>{t('New Category', 'Nueva Categoría')}</h4>
          <div className="cms-form">
            <div className="form-group">
              <label>{t('Name', 'Nombre')}</label>
              <input type="text" value={categoryForm.name} onChange={e => setCategoryForm({ ...categoryForm, name: e.target.value })} />
            </div>
            <div className="form-group">
              <label>{t('Description', 'Descripción')}</label>
              <textarea value={categoryForm.description} onChange={e => setCategoryForm({ ...categoryForm, description: e.target.value })} rows={3} />
            </div>
            <div className="form-actions">
              <button className="btn-cancel" onClick={() => setShowNewCategory(false)}>{t('Cancel', 'Cancelar')}</button>
              <button className="btn-submit" onClick={handleCreateCategory}>{t('Create', 'Crear')}</button>
            </div>
          </div>
        </div>
      )}

      <div className="cms-card">
        {categories.length === 0 ? (
          <div className="cms-empty">{t('No categories', 'No hay categorías')}</div>
        ) : (
          <table className="cms-table cms-table-simple">
            <thead>
              <tr>
                <th>{t('Name', 'Nombre')}</th>
                <th>{t('Pages', 'Páginas')}</th>
                <th>{t('Description', 'Descripción')}</th>
                <th className="cms-th-actions">{t('Actions', 'Acciones')}</th>
              </tr>
            </thead>
            <tbody>
              {categories.map(cat => (
                <tr key={cat._id}>
                  <td><strong>{cat.name}</strong></td>
                  <td>{pageCountByCategory[cat._id] || 0}</td>
                  <td className="cms-td-muted">{cat.description || '-'}</td>
                  <td className="cms-td-actions">
                    <button className="cms-action-btn" title={t('Delete', 'Eliminar')} onClick={() => handleDeleteCategory(cat._id)}>🗑️</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );

  // ── Render Tags Tab ──
  const renderTagsTab = () => (
    <div className="cms-tab-content">
      <div className="cms-tab-header">
        <h2>{t('Tags', 'Etiquetas')}</h2>
      </div>

      <div className="cms-card cms-card-form">
        <h4>{t('New Tag', 'Nueva Etiqueta')}</h4>
        <div className="cms-form">
          <div className="form-row">
            <div className="form-group">
              <input type="text" value={newTagName} onChange={e => setNewTagName(e.target.value)} placeholder={t('Tag name', 'Nombre de etiqueta')} />
            </div>
            <div className="form-group" style={{ flex: 'none' }}>
              <button className="btn-submit" onClick={handleCreateTag} disabled={!newTagName.trim()}>+ {t('Add', 'Añadir')}</button>
            </div>
          </div>
        </div>
      </div>

      <div className="cms-card">
        {tags.length === 0 ? (
          <div className="cms-empty">{t('No tags', 'No hay etiquetas')}</div>
        ) : (
          <table className="cms-table cms-table-simple">
            <thead>
              <tr>
                <th>{t('Tag', 'Etiqueta')}</th>
                <th className="cms-th-actions">{t('Actions', 'Acciones')}</th>
              </tr>
            </thead>
            <tbody>
              {tags.map((t: any) => (
                <tr key={t._id}>
                  <td><span className="cms-tag-badge" style={{ background: t.color || '#E5E7EB', color: t.color ? '#fff' : '#333' }}>{t.name}</span></td>
                  <td className="cms-td-actions">
                    <button className="cms-action-btn" title={t('Delete', 'Eliminar')} onClick={() => handleDeleteTag(t._id)}>🗗</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );

  return (
    <Layout>
      <div className="cms-container">
        {error && <div className="cms-error">{error}</div>}

        <div className="cms-topbar">
          <h1>📄 {t('Content Management', 'Gestión de Contenido')}</h1>
          <div className="cms-topbar-tabs">
            <button className={`cms-topbar-tab${activeTab === 'pages' ? ' active' : ''}`} onClick={() => setActiveTab('pages')}>
              📄 {t('Pages', 'Páginas')}
            </button>
            <button className={`cms-topbar-tab${activeTab === 'categories' ? ' active' : ''}`} onClick={() => setActiveTab('categories')}>
              📁 {t('Categories', 'Categorías')}
            </button>
            <button className={`cms-topbar-tab${activeTab === 'tags' ? ' active' : ''}`} onClick={() => setActiveTab('tags')}>
              🏷 {t('Tags', 'Etiquetas')}
            </button>
          </div>
        </div>

        {activeTab === 'pages' && renderDashboard()}

        {activeTab === 'pages' && (
          <div className="cms-content-area">
            {renderPagesTab()}
            <div className="cms-content-detail">
              {renderMainContent()}
            </div>
          </div>
        )}

        {activeTab === 'categories' && renderCategoriesTab()}
        {activeTab === 'tags' && renderTagsTab()}
      </div>
    </Layout>
  );
}
