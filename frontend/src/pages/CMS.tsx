import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { useLanguage } from '../i18n/LanguageContext';
import { Layout } from '../components/Layout';
import { useApi } from '../contexts/AuthContext';

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

type Tab = 'pages' | 'categories' | 'tags';

const PAGE_SIZE = 20;

export function CMS() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const t = (es: string, en: string) => language === 'es' ? es : en;
  const apiFetch = useApi();

  const [activeTab, setActiveTab] = useState<Tab>('pages');
  const [pages, setPages] = useState<ContentPage[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [recent, setRecent] = useState<RecentAccess[]>([]);
  const [searchResults, setSearchResults] = useState<ContentPage[]>([]);
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingTag, setEditingTag] = useState<any | null>(null);

  const [filter, setFilter] = useState({ status: '', categoryId: '', search: '' });
  const [sortKey, setSortKey] = useState<string>('updatedAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pageNum, setPageNum] = useState(1);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [tags, setTags] = useState<string[]>([]);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('');
  const [categoryForm, setCategoryForm] = useState({ name: '', description: '' });
  const [expandedTreeIds, setExpandedTreeIds] = useState<Set<string>>(new Set());

  const pageTree = useMemo(() => {
    const map = new Map<string, ContentPage[]>();
    const roots: ContentPage[] = [];
    pages.forEach(p => {
      const pid = (p as any).parentId?._id || (p as any).parentId || null;
      if (pid) {
        if (!map.has(pid)) map.set(pid, []);
        map.get(pid)!.push(p);
      } else {
        roots.push(p);
      }
    });
    map.forEach(children => children.sort((a, b) => ((a as any).order || 0) - ((b as any).order || 0)));
    roots.sort((a, b) => ((a as any).order || 0) - ((b as any).order || 0));
    return { roots, map };
  }, [pages]);

  const getDepth = useCallback((pageId: string, cache = new Map<string, number>()): number => {
    if (cache.has(pageId)) return cache.get(pageId)!;
    const p = pages.find(x => x._id === pageId);
    if (!p) return 0;
    const pid = (p as any).parentId?._id || (p as any).parentId || null;
    if (!pid) { cache.set(pageId, 0); return 0; }
    const depth = getDepth(pid, cache) + 1;
    cache.set(pageId, depth);
    return depth;
  }, [pages]);

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

  const handleDeletePage = async (id: string) => {
    if (!confirm(t('Delete page?', '¿Eliminar página?'))) return;
    try {
      await apiFetch(`/cms/pages/${id}`, { method: 'DELETE' });
      fetchPages();
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

  const handleMoveToParent = async (pageId: string, newParentId: string) => {
    try {
      await apiFetch(`/cms/pages/${pageId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentId: newParentId || null }),
      });
      fetchPages();
    } catch (e) { console.error('moveTo', e); }
  };

  const handleDragEnd = async (result: any) => {
    if (!result.destination) return;
    const draggedId = result.draggableId;
    const sourceParentId = result.source.droppableId === '__root__' ? null : result.source.droppableId;
    const destParentId = result.destination.droppableId === '__root__' ? null : result.destination.droppableId;
    const destIndex = result.destination.index;

    const destSiblings = destParentId
      ? [...(pageTree.map.get(destParentId) || [])]
      : [...pageTree.roots];

    const existingIdx = destSiblings.findIndex(p => p._id === draggedId);
    if (existingIdx !== -1) destSiblings.splice(existingIdx, 1);
    destSiblings.splice(destIndex, 0, pages.find(p => p._id === draggedId)!);

    const updates: any[] = destSiblings.map((p, i) => ({
      _id: p._id, parentId: destParentId, order: i
    }));

    if (sourceParentId !== destParentId) {
      const sourceSiblings = sourceParentId
        ? (pageTree.map.get(sourceParentId) || [])
        : pageTree.roots;
      sourceSiblings.filter(p => p._id !== draggedId).forEach((p, i) => {
        updates.push({ _id: p._id, parentId: sourceParentId, order: i });
      });
    }

    try {
      await apiFetch('/cms/pages/reorder', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      });
      fetchPages();
    } catch (e) { console.error('reorder', e); }
  };

  const handleCreateCategory = async () => {
    try {
      if (editingCategory) {
        await apiFetch(`/cms/categories/${editingCategory._id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(categoryForm) });
      } else {
        await apiFetch('/cms/categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(categoryForm) });
      }
      setShowNewCategory(false); setEditingCategory(null); setCategoryForm({ name: '', description: '' }); fetchCategories();
    } catch (e) { console.error('saveCategory', e); }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm(t('Delete category?', '¿Eliminar categoría?'))) return;
    try { await apiFetch(`/cms/categories/${id}`, { method: 'DELETE' }); setEditingCategory(null); fetchCategories(); }
    catch (e) { console.error('deleteCategory', e); }
  }; 

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;
    try {
      if (editingTag) {
        await apiFetch(`/cms/tags/${editingTag._id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newTagName, color: newTagColor }) });
      } else {
        await apiFetch('/cms/tags', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newTagName, color: newTagColor }) });
      }
      setNewTagName(''); setNewTagColor(''); setEditingTag(null); fetchTags();
    } catch (e) { console.error('saveTag', e); }
  };

  const handleDeleteTag = async (id: string) => {
    if (!confirm(t('Delete tag?', '¿Eliminar etiqueta?'))) return;
    try { await apiFetch(`/cms/tags/${id}`, { method: 'DELETE' }); setEditingTag(null); fetchTags(); }
    catch (e) { console.error('deleteTag', e); }
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

  // ── Tree helpers ──
  const renderTreeNodes = (nodes: ContentPage[], depth = 0): JSX.Element[] => {
    return nodes.flatMap((node, idx) => {
      const children = pageTree.map.get(node._id) || [];
      const hasChildren = children.length > 0;
      const isExpanded = expandedTreeIds.has(node._id);
      return [
        <Draggable key={node._id} draggableId={node._id} index={idx}>
          {(provided, snapshot) => (
            <div
              ref={provided.innerRef}
              {...provided.draggableProps}
              {...provided.dragHandleProps}
               className={`cms-tree-node${snapshot.isDragging ? ' dragging' : ''}`}
              style={{ ...provided.draggableProps.style, paddingLeft: 12 + depth * 16 }}
              onClick={() => navigate(`/cms/pages/edit/${node._id}`)}
            >
              {hasChildren ? (
                <span className="cms-tree-toggle" onClick={e => { e.stopPropagation(); const s = new Set(expandedTreeIds); if (isExpanded) s.delete(node._id); else s.add(node._id); setExpandedTreeIds(s); }}>
                  {isExpanded ? '▼' : '▶'}
                </span>
              ) : <span className="cms-tree-toggle cms-tree-toggle-empty">•</span>}
              <span className="cms-tree-title">{node.title}</span>
            </div>
          )}
        </Draggable>,
        ...(hasChildren && isExpanded ? renderTreeNodes(children, depth + 1) : []),
      ];
    });
  };

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
        <div className="cms-sb-section-title">{t('Pages Tree', 'Árbol de Páginas')}</div>
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="__root__" type="PAGE">
            {(provided) => (
              <div ref={provided.innerRef} {...provided.droppableProps}>
                {renderTreeNodes(pageTree.roots)}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      </div>

      <div className="cms-sb-section" style={{ borderTop: '1px solid var(--gray-200)' }}>
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
          {tags.map((tag: any) => (
            <div key={tag._id} className="cms-sb-item" style={{ fontSize: 12 }}>
              <span className="cms-tag-dot" style={{ background: tag.color || '#6B7280' }} /> {tag.name}
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
            <button className="btn-primary" onClick={() => navigate('/cms/pages/new')}>
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
              <div key={r._id} className="cms-vector-item" onClick={() => navigate(`/cms/pages/edit/${r._id}`)}>
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
                  const depth = getDepth(page._id);
                  return (
                    <tr key={page._id}>
                      <td className="cms-td-title" onClick={() => navigate(`/cms/pages/edit/${page._id}`)} style={{ paddingLeft: 16 + depth * 20 }}>
                        <span className="cms-page-title">{depth > 0 && '└ '.repeat(depth)}{page.title}</span>
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
                        {page.status === 'published' && (
                          <a href={`/site/${page.slug}`} target="_blank" rel="noopener noreferrer" className="cms-action-btn" title={t('View public page', 'Ver página pública')}>🔗</a>
                        )}
                        <button className="cms-action-btn" title={t('Edit', 'Editar')} onClick={() => navigate(`/cms/pages/edit/${page._id}`)}>✏️</button>
                        <button className="cms-action-btn" title={t('Duplicate', 'Duplicar')} onClick={() => handleDuplicatePage(page)}>📋</button>
                        <button className="cms-action-btn" title={isBm ? t('Remove bookmark', 'Quitar favorito') : t('Bookmark', 'Favorito')} onClick={() => handleToggleBookmark(page._id)}>{isBm ? '⭐' : '☆'}</button>
                        <select className="cms-move-inline" value="" onChange={e => { const v = e.target.value; if (v) { handleMoveToParent(page._id, v); } e.target.value = ''; }} title={t('Move to...', 'Mover a...')}>
                          <option value="">↕</option>
                          <option value="">— {t('Root', 'Raíz')} —</option>
                          {pages.filter(p => p._id !== page._id).map(p => (
                            <option key={p._id} value={p._id}>{'─ '.repeat(getDepth(p._id))}{p.title}</option>
                          ))}
                        </select>
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

  // Render View / Preview — removed, click navigates to editor

  // ── Render Categories Tab ──
  const renderCategoriesTab = () => (
    <div className="cms-tab-content">
      <div className="cms-tab-header">
        <h2>{t('Categories', 'Categorías')}</h2>
        <button className="btn-primary btn-sm" onClick={() => { setShowNewCategory(true); setEditingCategory(null); setCategoryForm({ name: '', description: '' }); }}>+ {t('New', 'Nueva')}</button>
      </div>

      {(showNewCategory || editingCategory) && (
        <div className="cms-card cms-card-form">
          <h4>{editingCategory ? t('Edit Category', 'Editar Categoría') : t('New Category', 'Nueva Categoría')}</h4>
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
              <button className="btn-cancel" onClick={() => { setShowNewCategory(false); setEditingCategory(null); setCategoryForm({ name: '', description: '' }); }}>{t('Cancel', 'Cancelar')}</button>
              <button className="btn-submit" onClick={handleCreateCategory}>{editingCategory ? t('Save', 'Guardar') : t('Create', 'Crear')}</button>
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
                    <button className="cms-action-btn" title={t('Edit', 'Editar')} onClick={() => { setEditingCategory(cat); setCategoryForm({ name: cat.name, description: cat.description || '' }); setShowNewCategory(false); }}>✏️</button>
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
        <button className="btn-primary btn-sm" onClick={() => { setEditingTag(null); setNewTagName(''); setNewTagColor(''); }}>+ {t('New', 'Nuevo')}</button>
      </div>

      <div className="cms-card cms-card-form">
        <h4>{editingTag ? t('Edit Tag', 'Editar Etiqueta') : t('New Tag', 'Nueva Etiqueta')}</h4>
        <div className="cms-form">
          <div className="form-row">
            <div className="form-group">
              <input type="text" value={newTagName} onChange={e => setNewTagName(e.target.value)} placeholder={t('Tag name', 'Nombre de etiqueta')} />
            </div>
            <div className="form-group" style={{ maxWidth: 100 }}>
              <input type="color" value={newTagColor || '#6B7280'} onChange={e => setNewTagColor(e.target.value)} title={t('Color', 'Color')} />
            </div>
            <div className="form-group" style={{ flex: 'none' }}>
              <button className="btn-submit" onClick={() => { if (editingTag) { handleDeleteTag(editingTag._id); } setEditingTag(null); setNewTagName(''); setNewTagColor(''); }} style={{ display: editingTag ? 'inline-block' : 'none' }}>{t('Cancel', 'Cancelar')}</button>
              <button className="btn-submit" onClick={handleCreateTag} disabled={!newTagName.trim()}>{editingTag ? t('Save', 'Guardar') : '+ ' + t('Add', 'Añadir')}</button>
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
              {tags.map((tag: any) => (
                <tr key={tag._id}>
                  <td><span className="cms-tag-badge" style={{ background: tag.color || '#E5E7EB', color: tag.color ? '#fff' : '#333' }}>{tag.name}</span></td>
                  <td className="cms-td-actions">
                    <button className="cms-action-btn" title={t('Edit', 'Editar')} onClick={() => { setEditingTag(tag); setNewTagName(tag.name); setNewTagColor(tag.color || ''); }}>✏️</button>
                    <button className="cms-action-btn" title={t('Delete', 'Eliminar')} onClick={() => handleDeleteTag(tag._id)}>🗑️</button>
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

        {activeTab === 'pages' && renderPagesTab()}

        {activeTab === 'categories' && renderCategoriesTab()}
        {activeTab === 'tags' && renderTagsTab()}
      </div>
    </Layout>
  );
}
