import { useState, useEffect } from 'react';
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

type Tab = 'pages' | 'categories' | 'bookmarks' | 'recent' | 'search';

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
}

function RichTextEditor({ content, onChange }: RichTextEditorProps) {
  const [linkUrl, setLinkUrl] = useState('');
  const [showLinkInput, setShowLinkInput] = useState(false);

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
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  if (!editor) {
    return (
      <div className="rich-editor" style={{ padding: '20px', border: '1px solid #ccc', minHeight: '250px' }}>
        <em>Cargando editor...</em>
      </div>
    );
  }

  const setLink = () => {
    if (linkUrl) {
      editor.chain().focus().extendMarkRange('link').setLink({ href: linkUrl }).run();
    } else {
      editor.chain().focus().unsetLink().run();
    }
    setLinkUrl('');
    setShowLinkInput(false);
  };

  return (
    <div className="rich-editor">
      <div className="rich-editor-toolbar">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={editor.isActive('bold') ? 'active' : ''}
          title="Negrita (Ctrl+B)"
        >
          <strong>B</strong>
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={editor.isActive('italic') ? 'active' : ''}
          title="Cursiva (Ctrl+I)"
        >
          <em>I</em>
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={editor.isActive('underline') ? 'active' : ''}
          title="Subrayado (Ctrl+U)"
        >
          <u>U</u>
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={editor.isActive('strike') ? 'active' : ''}
          title="Tachado"
        >
          <s>S</s>
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleCode().run()}
          className={editor.isActive('code') ? 'active' : ''}
          title="Código inline"
        >
          {'</>'}
        </button>
        <span className="toolbar-separator" />

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={editor.isActive('heading', { level: 1 }) ? 'active' : ''}
          title="Título 1"
        >
          H1
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={editor.isActive('heading', { level: 2 }) ? 'active' : ''}
          title="Título 2"
        >
          H2
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={editor.isActive('heading', { level: 3 }) ? 'active' : ''}
          title="Título 3"
        >
          H3
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().setParagraph().run()}
          className={editor.isActive('paragraph') ? 'active' : ''}
          title="Párrafo"
        >
          P
        </button>
        <span className="toolbar-separator" />

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={editor.isActive('bulletList') ? 'active' : ''}
          title="Lista con viñetas"
        >
          •
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={editor.isActive('orderedList') ? 'active' : ''}
          title="Lista numerada"
        >
          1.
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().sinkListItem('listItem').run()}
          title="Sangría izquierda"
        >
          ↩
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().liftListItem('listItem').run()}
          title="Sangría derecha"
        >
          ↪
        </button>
        <span className="toolbar-separator" />

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={editor.isActive('blockquote') ? 'active' : ''}
          title="Cita"
        >
          "
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          className={editor.isActive('codeBlock') ? 'active' : ''}
          title="Bloque de código"
        >
          {'{ }'}
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          title="Línea horizontal"
        >
          —
        </button>
        <span className="toolbar-separator" />

        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          className={editor.isActive({ textAlign: 'left' }) ? 'active' : ''}
          title="Alinear a la izquierda"
        >
          ⬅
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          className={editor.isActive({ textAlign: 'center' }) ? 'active' : ''}
          title="Centrar"
        >
          ⬌
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          className={editor.isActive({ textAlign: 'right' }) ? 'active' : ''}
          title="Alinear a la derecha"
        >
          ➡
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign('justify').run()}
          className={editor.isActive({ textAlign: 'justify' }) ? 'active' : ''}
          title="Justificar"
        >
          ≡
        </button>
        <span className="toolbar-separator" />

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleSubscript().run()}
          className={editor.isActive('subscript') ? 'active' : ''}
          title="Subíndice"
        >
          X₂
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleSuperscript().run()}
          className={editor.isActive('superscript') ? 'active' : ''}
          title="Superíndice"
        >
          X²
        </button>
        <span className="toolbar-separator" />

        <button
          type="button"
          onClick={() => setShowLinkInput(!showLinkInput)}
          className={editor.isActive('link') ? 'active' : ''}
          title="Insertar enlace"
        >
          🔗
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().unsetAllMarks().run()}
          title="Limpiar formato"
        >
          ⌫
        </button>
        <span className="toolbar-separator" />

        <button
          type="button"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          title="Deshacer"
        >
          ↶
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          title="Rehacer"
        >
          ↷
        </button>
      </div>

      {showLinkInput && (
        <div className="link-input-bar">
          <input
            type="url"
            placeholder="URL del enlace..."
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && setLink()}
          />
          <button type="button" onClick={setLink}>✓</button>
          <button type="button" onClick={() => { setLinkUrl(''); setShowLinkInput(false); }}>✕</button>
        </div>
      )}

      <EditorContent editor={editor} className="rich-editor-content" />
    </div>
  );
}

export function CMS() {
  const { language, t } = useLanguage();
  const apiFetch = useApi();
  const [activeTab, setActiveTab] = useState<Tab>('pages');
  const [pages, setPages] = useState<ContentPage[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [recent, setRecent] = useState<RecentAccess[]>([]);
  const [searchResults, setSearchResults] = useState<ContentPage[]>([]);
  const [selectedPage, setSelectedPage] = useState<ContentPage | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showNewPage, setShowNewPage] = useState(false);
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [filter, setFilter] = useState({ status: '', categoryId: '', search: '' });
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    content: '',
    summary: '',
    categoryId: '',
    tags: [] as string[],
    status: 'draft' as 'draft' | 'published' | 'archived'
  });

  const [categoryForm, setCategoryForm] = useState({
    name: '',
    description: ''
  });

  useEffect(() => {
    fetchCategories();
    fetchPages();
  }, [filter]);

  useEffect(() => {
    if (activeTab === 'bookmarks') fetchBookmarks();
    if (activeTab === 'recent') fetchRecent();
  }, [activeTab]);

  const [error, setError] = useState<string | null>(null);

  const fetchCategories = async () => {
    try {
      const res = await apiFetch('/cms/categories');
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const data = await res.json();
      setCategories(data);
    } catch (err) {
      console.error('Error fetching categories:', err);
      setError(language === 'es' ? 'Error 连接后端' : 'Backend connection error');
    }
  };

  const fetchPages = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filter.status) params.set('status', filter.status);
      if (filter.categoryId) params.set('categoryId', filter.categoryId);
      
      const res = await apiFetch(`/cms/pages?${params}`);
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const data = await res.json();
      setPages(data);
    } catch (err) {
      console.error('Error fetching pages:', err);
      setError(language === 'es' ? 'Error 连接后端' : 'Backend connection error');
    } finally {
      setLoading(false);
    }
  };

  const fetchBookmarks = async () => {
    try {
      const res = await apiFetch('/cms/bookmarks');
      const data = await res.json();
      setBookmarks(data);
    } catch (err) {
      console.error('Error fetching bookmarks:', err);
    }
  };

  const fetchRecent = async () => {
    try {
      const res = await apiFetch('/cms/recent?limit=20');
      const data = await res.json();
      setRecent(data);
    } catch (err) {
      console.error('Error fetching recent:', err);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const res = await apiFetch(`/cms/search?q=${encodeURIComponent(searchQuery)}&limit=20`);
      const data = await res.json();
      setSearchResults(data.map((r: any) => ({
        _id: r.id,
        title: r.title,
        slug: r.slug,
        content: r.content,
        summary: '',
        tags: [],
        status: 'published' as const,
        viewCount: 0,
        isFeatured: false,
        createdAt: '',
        updatedAt: ''
      })));
    } catch (err) {
      console.error('Error searching:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleCreatePage = async () => {
    setIsSaving(true);
    try {
      await apiFetch('/cms/pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      setShowNewPage(false);
      setFormData({ title: '', content: '', summary: '', categoryId: '', tags: [], status: 'draft' });
      fetchPages();
    } catch (err) {
      console.error('Error creating page:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdatePage = async () => {
    if (!selectedPage) return;
    setIsSaving(true);
    try {
      await apiFetch(`/cms/pages/${selectedPage._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      setIsEditing(false);
      fetchPages();
      if (selectedPage._id) {
        const res = await apiFetch(`/cms/pages/${selectedPage._id}`);
        const data = await res.json();
        setSelectedPage(data);
      }
    } catch (err) {
      console.error('Error updating page:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletePage = async (id: string) => {
    if (!confirm(language === 'es' ? '¿Eliminar página?' : 'Delete page?')) return;
    try {
      await apiFetch(`/cms/pages/${id}`, { method: 'DELETE' });
      setSelectedPage(null);
      fetchPages();
    } catch (err) {
      console.error('Error deleting page:', err);
    }
  };

  const handleCreateCategory = async () => {
    try {
      await apiFetch('/cms/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(categoryForm)
      });
      setShowNewCategory(false);
      setCategoryForm({ name: '', description: '' });
      fetchCategories();
    } catch (err) {
      console.error('Error creating category:', err);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm(language === 'es' ? '¿Eliminar categoría?' : 'Delete category?')) return;
    try {
      await apiFetch(`/cms/categories/${id}`, { method: 'DELETE' });
      fetchCategories();
    } catch (err) {
      console.error('Error deleting category:', err);
    }
  };

  const handleToggleBookmark = async (pageId: string) => {
    try {
      const isBookmarked = bookmarks.some(b => b.contentId?._id === pageId);
      if (isBookmarked) {
        await apiFetch(`/cms/bookmarks/${pageId}`, { method: 'DELETE' });
      } else {
        await apiFetch('/cms/bookmarks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contentId: pageId })
        });
      }
      fetchBookmarks();
    } catch (err) {
      console.error('Error toggling bookmark:', err);
    }
  };

  const openEdit = (page: ContentPage) => {
    setFormData({
      title: page.title,
      content: page.content,
      summary: page.summary || '',
      categoryId: page.categoryId?._id || '',
      tags: page.tags,
      status: page.status
    });
    setIsEditing(true);
  };

  const filteredPages = pages.filter(page => {
    if (filter.search) {
      const search = filter.search.toLowerCase();
      return page.title.toLowerCase().includes(search) || page.summary?.toLowerCase().includes(search);
    }
    return true;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published': return '#22C55E';
      case 'draft': return '#F59E0B';
      case 'archived': return '#6B7280';
      default: return '#6B7280';
    }
  };

  const renderTabs = () => (
    <div className="cms-tabs">
      <button 
        className={`cms-tab ${activeTab === 'pages' ? 'active' : ''}`}
        onClick={() => setActiveTab('pages')}
      >
        📄 {language === 'es' ? 'Páginas' : 'Pages'}
      </button>
      <button 
        className={`cms-tab ${activeTab === 'categories' ? 'active' : ''}`}
        onClick={() => setActiveTab('categories')}
      >
        📁 {language === 'es' ? 'Categorías' : 'Categories'}
      </button>
      <button 
        className={`cms-tab ${activeTab === 'bookmarks' ? 'active' : ''}`}
        onClick={() => setActiveTab('bookmarks')}
      >
        ⭐ {language === 'es' ? 'Favoritos' : 'Bookmarks'}
      </button>
      <button 
        className={`cms-tab ${activeTab === 'recent' ? 'active' : ''}`}
        onClick={() => setActiveTab('recent')}
      >
        🕐 {language === 'es' ? 'Recientes' : 'Recent'}
      </button>
      <button 
        className={`cms-tab ${activeTab === 'search' ? 'active' : ''}`}
        onClick={() => setActiveTab('search')}
      >
        🔍 {language === 'es' ? 'Búsqueda' : 'Search'}
      </button>
    </div>
  );

  const renderPagesTab = () => (
    <>
      <div className="cms-sidebar">
        <div className="cms-header">
          <h2>{t('cms') || 'Content'}</h2>
          <button className="btn-primary" onClick={() => setShowNewPage(true)}>
            + {language === 'es' ? 'Nueva' : 'New'}
          </button>
        </div>

        <div className="cms-filters">
          <input
            type="text"
            placeholder={language === 'es' ? 'Buscar...' : 'Search...'}
            value={filter.search}
            onChange={(e) => setFilter({ ...filter, search: e.target.value })}
            className="cms-search"
          />
          <select
            value={filter.status}
            onChange={(e) => setFilter({ ...filter, status: e.target.value })}
            className="cms-select"
          >
            <option value="">{language === 'es' ? 'Todos los estados' : 'All statuses'}</option>
            <option value="draft">{language === 'es' ? 'Borrador' : 'Draft'}</option>
            <option value="published">{language === 'es' ? 'Publicado' : 'Published'}</option>
            <option value="archived">{language === 'es' ? 'Archivado' : 'Archived'}</option>
          </select>
        </div>

        <div className="cms-list">
          {loading ? (
            <div className="cms-loading">{t('loading')}</div>
          ) : filteredPages.length === 0 ? (
            <div className="cms-empty">
              {language === 'es' ? 'No hay páginas' : 'No pages found'}
            </div>
          ) : (
            filteredPages.map(page => (
              <div
                key={page._id}
                className={`cms-item ${selectedPage?._id === page._id ? 'active' : ''}`}
                onClick={() => { setSelectedPage(page); setIsEditing(false); }}
              >
                <div className="cms-item-title">{page.title}</div>
                <div className="cms-item-meta">
                  <span 
                    className="cms-status"
                    style={{ backgroundColor: getStatusColor(page.status) }}
                  >
                    {page.status}
                  </span>
                  {page.categoryId && (
                    <span className="cms-category">{page.categoryId.name}</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="cms-main">
        {showNewPage && (
          <div className="cms-editor">
            <h3>{language === 'es' ? 'Nueva Página' : 'New Page'}</h3>
            <div className="cms-form">
              <div className="form-group">
                <label>{language === 'es' ? 'Título' : 'Title'}</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>{language === 'es' ? 'Resumen' : 'Summary'}</label>
                <textarea
                  value={formData.summary}
                  onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
                  rows={2}
                />
              </div>
              <div className="form-group">
                <label>{language === 'es' ? 'Contenido' : 'Content'}</label>
                <RichTextEditor
                  content={formData.content}
                  onChange={(content) => setFormData({ ...formData, content })}
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>{language === 'es' ? 'Categoría' : 'Category'}</label>
                  <select
                    value={formData.categoryId}
                    onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                  >
                    <option value="">{language === 'es' ? 'Sin categoría' : 'No category'}</option>
                    {categories.map(cat => (
                      <option key={cat._id} value={cat._id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>{language === 'es' ? 'Estado' : 'Status'}</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  >
                    <option value="draft">{language === 'es' ? 'Borrador' : 'Draft'}</option>
                    <option value="published">{language === 'es' ? 'Publicado' : 'Published'}</option>
                    <option value="archived">{language === 'es' ? 'Archivado' : 'Archived'}</option>
                  </select>
                </div>
              </div>
              <div className="form-actions">
                <button className="btn-cancel" onClick={() => setShowNewPage(false)}>
                  {language === 'es' ? 'Cancelar' : 'Cancel'}
                </button>
                <button className="btn-submit" onClick={handleCreatePage} disabled={isSaving}>
                  {isSaving ? (language === 'es' ? 'Guardando...' : 'Saving...') : (language === 'es' ? 'Crear' : 'Create')}
                </button>
              </div>
            </div>
          </div>
        )}

        {selectedPage && !showNewPage && (
          <>
            {isEditing ? (
              <div className="cms-editor">
                <h3>{language === 'es' ? 'Editar Página' : 'Edit Page'}</h3>
                <div className="cms-form">
                  <div className="form-group">
                    <label>{language === 'es' ? 'Título' : 'Title'}</label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>{language === 'es' ? 'Resumen' : 'Summary'}</label>
                    <textarea
                      value={formData.summary}
                      onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
                      rows={2}
                    />
                  </div>
                  <div className="form-group">
                    <label>{language === 'es' ? 'Contenido' : 'Content'}</label>
                    <RichTextEditor
                      content={formData.content}
                      onChange={(content) => setFormData({ ...formData, content })}
                    />
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>{language === 'es' ? 'Categoría' : 'Category'}</label>
                      <select
                        value={formData.categoryId}
                        onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                      >
                        <option value="">{language === 'es' ? 'Sin categoría' : 'No category'}</option>
                        {categories.map(cat => (
                          <option key={cat._id} value={cat._id}>{cat.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>{language === 'es' ? 'Estado' : 'Status'}</label>
                      <select
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                      >
                        <option value="draft">{language === 'es' ? 'Borrador' : 'Draft'}</option>
                        <option value="published">{language === 'es' ? 'Publicado' : 'Published'}</option>
                        <option value="archived">{language === 'es' ? 'Archivado' : 'Archived'}</option>
                      </select>
                    </div>
                  </div>
                  <div className="form-actions">
                    <button className="btn-cancel" onClick={() => setIsEditing(false)}>
                      {language === 'es' ? 'Cancelar' : 'Cancel'}
                    </button>
                    <button className="btn-submit" onClick={handleUpdatePage} disabled={isSaving}>
                      {isSaving ? (language === 'es' ? 'Guardando...' : 'Saving...') : (language === 'es' ? 'Guardar' : 'Save')}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="cms-view">
                <div className="cms-view-header">
                  <div>
                    <h1>{selectedPage.title}</h1>
                    <div className="cms-view-meta">
                      <span 
                        className="cms-status"
                        style={{ backgroundColor: getStatusColor(selectedPage.status) }}
                      >
                        {selectedPage.status}
                      </span>
                      {selectedPage.categoryId && (
                        <span className="cms-category">{selectedPage.categoryId.name}</span>
                      )}
                      <span className="cms-views">
                        {selectedPage.viewCount} {language === 'es' ? 'vistas' : 'views'}
                      </span>
                      <button 
                        className="bookmark-btn"
                        onClick={() => handleToggleBookmark(selectedPage._id)}
                      >
                        {bookmarks.some(b => b.contentId?._id === selectedPage._id) ? '⭐' : '☆'}
                      </button>
                    </div>
                  </div>
                  <div className="cms-view-actions">
                    <button className="btn-edit" onClick={() => openEdit(selectedPage)}>
                      {language === 'es' ? 'Editar' : 'Edit'}
                    </button>
                    <button 
                      className="btn-delete"
                      onClick={() => handleDeletePage(selectedPage._id)}
                    >
                      {language === 'es' ? 'Eliminar' : 'Delete'}
                    </button>
                  </div>
                </div>
                {selectedPage.summary && (
                  <div className="cms-view-summary">
                    <h3>{language === 'es' ? 'Resumen' : 'Summary'}</h3>
                    <p>{selectedPage.summary}</p>
                  </div>
                )}
                <div className="cms-view-content">
                  <h3>{language === 'es' ? 'Contenido' : 'Content'}</h3>
                  <div 
                    className="content-text"
                    dangerouslySetInnerHTML={{ __html: selectedPage.content || '<p>Sin contenido</p>' }}
                  />
                </div>
              </div>
            )}
          </>
        )}

        {!selectedPage && !showNewPage && (
          <div className="cms-empty-view">
            <div className="empty-icon">📄</div>
            <h3>{language === 'es' ? 'Selecciona una página' : 'Select a page'}</h3>
            <p>{language === 'es' ? 'O crea una nueva página de contenido' : 'Or create a new content page'}</p>
            <button className="btn-primary" onClick={() => setShowNewPage(true)}>
              + {language === 'es' ? 'Nueva Página' : 'New Page'}
            </button>
          </div>
        )}
      </div>
    </>
  );

  const renderCategoriesTab = () => (
    <div className="cms-categories-tab">
      <div className="cms-header">
        <h2>{language === 'es' ? 'Categorías' : 'Categories'}</h2>
        <button className="btn-primary" onClick={() => setShowNewCategory(true)}>
          + {language === 'es' ? 'Nueva' : 'New'}
        </button>
      </div>

      {showNewCategory && (
        <div className="cms-editor">
          <h3>{language === 'es' ? 'Nueva Categoría' : 'New Category'}</h3>
          <div className="cms-form">
            <div className="form-group">
              <label>{language === 'es' ? 'Nombre' : 'Name'}</label>
              <input
                type="text"
                value={categoryForm.name}
                onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>{language === 'es' ? 'Descripción' : 'Description'}</label>
              <textarea
                value={categoryForm.description}
                onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                rows={3}
              />
            </div>
            <div className="form-actions">
              <button className="btn-cancel" onClick={() => setShowNewCategory(false)}>
                {language === 'es' ? 'Cancelar' : 'Cancel'}
              </button>
              <button className="btn-submit" onClick={handleCreateCategory}>
                {language === 'es' ? 'Crear' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="cms-categories-list">
        {categories.length === 0 ? (
          <div className="cms-empty">
            {language === 'es' ? 'No hay categorías' : 'No categories'}
          </div>
        ) : (
          categories.map(cat => (
            <div key={cat._id} className="cms-category-item">
              <div className="cms-category-info">
                <span className="cms-category-name">{cat.name}</span>
                {cat.description && <span className="cms-category-desc">{cat.description}</span>}
              </div>
              <button 
                className="btn-delete-small"
                onClick={() => handleDeleteCategory(cat._id)}
              >
                🗑️
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );

  const renderBookmarksTab = () => (
    <div className="cms-bookmarks-tab">
      <h2>{language === 'es' ? 'Favoritos' : 'Bookmarks'}</h2>
      <div className="cms-list-full">
        {bookmarks.length === 0 ? (
          <div className="cms-empty">
            {language === 'es' ? 'No hay favoritos' : 'No bookmarks'}
          </div>
        ) : (
          bookmarks.map(bookmark => (
            <div 
              key={bookmark._id} 
              className="cms-item"
              onClick={() => { setSelectedPage(bookmark.contentId); setIsEditing(false); setActiveTab('pages'); }}
            >
              <div className="cms-item-title">⭐ {bookmark.contentId?.title}</div>
              <div className="cms-item-meta">
                {bookmark.contentId?.categoryId && (
                  <span className="cms-category">{bookmark.contentId.categoryId.name}</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  const renderRecentTab = () => (
    <div className="cms-recent-tab">
      <h2>{language === 'es' ? 'Historial Reciente' : 'Recent History'}</h2>
      <div className="cms-list-full">
        {recent.length === 0 ? (
          <div className="cms-empty">
            {language === 'es' ? 'No hay historial' : 'No history'}
          </div>
        ) : (
          recent.map(item => (
            <div 
              key={item._id} 
              className="cms-item"
              onClick={() => { setSelectedPage(item.contentId); setIsEditing(false); setActiveTab('pages'); }}
            >
              <div className="cms-item-title">🕐 {item.contentId?.title}</div>
              <div className="cms-item-meta">
                <span className="cms-date">
                  {new Date(item.accessedAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  const renderSearchTab = () => (
    <div className="cms-search-tab">
      <h2>{language === 'es' ? 'Búsqueda Vectorial' : 'Vector Search'}</h2>
      <div className="cms-search-box">
        <input
          type="text"
          placeholder={language === 'es' ? 'Escribe tu búsqueda...' : 'Enter your search...'}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          className="cms-search-input"
        />
        <button className="btn-primary" onClick={handleSearch} disabled={isSearching}>
          {isSearching ? (language === 'es' ? 'Buscando...' : 'Searching...') : (language === 'es' ? 'Buscar' : 'Search')}
        </button>
      </div>

      <div className="cms-search-results">
        {searchResults.length === 0 && searchQuery && !isSearching ? (
          <div className="cms-empty">
            {language === 'es' ? 'No hay resultados' : 'No results'}
          </div>
        ) : (
          searchResults.map(result => (
            <div 
              key={result._id} 
              className="cms-item"
              onClick={() => { setSelectedPage(result); setIsEditing(false); setActiveTab('pages'); }}
            >
              <div className="cms-item-title">{result.title}</div>
              <div className="cms-item-meta">
                <span className="cms-snippet">
                  {result.content?.substring(0, 100)}...
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  return (
    <Layout>
      <div className="cms-container">
        {error && (
          <div className="cms-error" style={{ padding: '20px', background: '#FEE2E2', color: '#DC2626', margin: '10px' }}>
            {error}
          </div>
        )}
        {renderTabs()}
        {activeTab === 'pages' && renderPagesTab()}
        {activeTab === 'categories' && renderCategoriesTab()}
        {activeTab === 'bookmarks' && renderBookmarksTab()}
        {activeTab === 'recent' && renderRecentTab()}
        {activeTab === 'search' && renderSearchTab()}
      </div>
    </Layout>
  );
}
