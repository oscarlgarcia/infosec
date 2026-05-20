import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext';
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
}

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

export function CMSEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const t = (es: string, en: string) => language === 'es' ? es : en;
  const apiFetch = useApi();

  const isNew = !id || id === 'new';

  const [categories, setCategories] = useState<Category[]>([]);
  const [pages, setPages] = useState<any[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [slugStatus, setSlugStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const slugTimer = useRef<any>(null);
  const autoSaveTimer = useRef<any>(null);

  const [formData, setFormData] = useState({
    title: '', content: '', summary: '', slug: '', categoryId: '', parentId: '',
    tags: [] as string[], status: 'draft' as 'draft' | 'published' | 'archived'
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [catR, pagesR] = await Promise.all([
          apiFetch('/cms/categories'),
          apiFetch('/cms/pages'),
        ]);
        if (catR.ok) setCategories(await catR.json());
        if (pagesR.ok) setPages(await pagesR.json());
      } catch (e) { console.error('fetchData', e); }
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (isNew) return;
    const fetchPage = async () => {
      try {
        const r = await apiFetch(`/cms/pages/${id}`);
        if (r.ok) {
          const page: ContentPage = await r.json();
          setFormData({
            title: page.title,
            content: page.content,
            summary: page.summary || '',
            slug: page.slug,
            categoryId: page.categoryId?._id || '',
            parentId: (page as any).parentId?._id || (page as any).parentId || '',
            tags: page.tags,
            status: page.status,
          });
        } else {
          setError(t('Page not found', 'Página no encontrada'));
        }
      } catch (e) {
        setError(t('Error loading page', 'Error al cargar la página'));
      } finally {
        setLoading(false);
      }
    };
    fetchPage();
  }, [id]);

  // Auto-generate slug from title
  useEffect(() => {
    if (isNew || !formData.slug) {
      const generated = formData.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      if (generated && generated !== formData.slug) {
        setFormData(prev => ({ ...prev, slug: generated }));
      }
    }
  }, [formData.title]);

  // Debounced slug availability check
  useEffect(() => {
    if (slugTimer.current) clearTimeout(slugTimer.current);
    if (!formData.slug) { setSlugStatus('idle'); return; }
    if (isNew && !formData.slug) return;
    slugTimer.current = setTimeout(async () => {
      setSlugStatus('checking');
      try {
        const r = await apiFetch(`/cms/pages/check-slug?slug=${encodeURIComponent(formData.slug)}${id ? `&excludeId=${id}` : ''}`);
        if (r.ok) {
          const data = await r.json();
          setSlugStatus(data.available ? 'available' : 'taken');
        }
      } catch { setSlugStatus('idle'); }
    }, 500);
    return () => { if (slugTimer.current) clearTimeout(slugTimer.current); };
  }, [formData.slug, id]);

  useEffect(() => {
    if (isNew) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(async () => {
      setAutoSaveStatus('saving');
      try {
        await apiFetch(`/cms/pages/${id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
        setAutoSaveStatus('saved');
        setTimeout(() => setAutoSaveStatus('idle'), 2000);
      } catch { setAutoSaveStatus('idle'); }
    }, 30000);
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  }, [formData, id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const body = { ...formData };
      if (isNew) {
        const { slug, ...rest } = body;
        await apiFetch('/cms/pages', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(rest),
        });
      } else {
        await apiFetch(`/cms/pages/${id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      }
      navigate('/cms');
    } catch (e: any) {
      console.error('save', e);
      setError(e.message || t('Error saving page', 'Error al guardar la página'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(t('Delete this page?', '¿Eliminar esta página?'))) return;
    try {
      await apiFetch(`/cms/pages/${id}`, { method: 'DELETE' });
      navigate('/cms');
    } catch (e) { console.error('delete', e); }
  };

  if (loading) {
    return (
      <div className="cms-editor-shell">
        <div className="cms-editor-loading"><em>{t('Loading...', 'Cargando...')}</em></div>
      </div>
    );
  }

  return (
    <div className="cms-editor-shell">
      <div className="cms-editor-topbar">
        <button className="btn-secondary btn-sm" onClick={() => navigate('/cms')}>
          ← {t('Back to list', 'Volver al listado')}
        </button>
        <h2>{isNew ? t('New Page', 'Nueva Página') : t('Edit Page', 'Editar Página')}</h2>
        <div className="cms-editor-topbar-right">
          {!isNew && (
            <span className={`cms-autosave cms-autosave-${autoSaveStatus}`}>
              {autoSaveStatus === 'saving' ? t('Saving...', 'Guardando...') : autoSaveStatus === 'saved' ? t('Saved', 'Guardado') : ''}
            </span>
          )}
          <button className="btn-secondary btn-sm" onClick={() => setShowPreview(!showPreview)}>
            {showPreview ? '✏️ ' + t('Edit', 'Editar') : '👁 ' + t('Preview', 'Vista previa')}
          </button>
          {!isNew && formData.status === 'published' && (
            <a href={`/site/${formData.slug}`} target="_blank" rel="noopener noreferrer" className="btn-secondary btn-sm" style={{ textDecoration: 'none' }}>
              🔗 {t('View public', 'Ver pública')}
            </a>
          )}
          <button className="btn-primary btn-sm" onClick={handleSave} disabled={saving}>
            {saving ? t('Saving...', 'Guardando...') : isNew ? t('Create', 'Crear') : t('Save', 'Guardar')}
          </button>
          {!isNew && (
            <button className="btn-delete btn-sm" onClick={handleDelete}>🗑️</button>
          )}
        </div>
      </div>

      {error && <div className="cms-error" style={{ margin: '0 24px' }}>{error}</div>}

      {showPreview ? (
        <div className="cms-editor-preview">
          <h1 className="cms-preview-title">{formData.title || t('(Untitled)', '(Sin título)')}</h1>
          {formData.summary && <p className="cms-preview-summary">{formData.summary}</p>}
          <div className="cms-view-content" dangerouslySetInnerHTML={{ __html: formData.content || '<p><em>' + t('No content', 'Sin contenido') + '</em></p>' }} />
        </div>
      ) : (
        <div className="cms-editor-form">
          <div className="form-group">
            <label>{t('Title', 'Título')}</label>
            <input type="text" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} />
          </div>
          <div className="form-group">
            <label>
              {t('Slug', 'Slug')}
              {slugStatus === 'checking' && <span className="cms-slug-status checking"> ⏳</span>}
              {slugStatus === 'available' && <span className="cms-slug-status available"> ✅</span>}
              {slugStatus === 'taken' && <span className="cms-slug-status taken"> ❌ {t('Already in use', 'Ya en uso')}</span>}
            </label>
            <input type="text" value={formData.slug} onChange={e => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') })} className={`cms-slug-input${slugStatus === 'taken' ? ' cms-slug-taken' : ''}${slugStatus === 'available' ? ' cms-slug-ok' : ''}`} />
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
            <div className="form-group">
              <label>{t('Parent page', 'Página padre')}</label>
              <select value={formData.parentId} onChange={e => setFormData({ ...formData, parentId: e.target.value })}>
                <option value="">— {t('Root', 'Raíz')} —</option>
                {pages.map(p => <option key={p._id} value={p._id}>{p.title}</option>)}
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
        </div>
      )}
    </div>
  );
}
