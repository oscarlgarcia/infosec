import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useApi, useAuth, API_URL } from '../contexts/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import type {
  KnowledgeItem,
  KnowledgeSearchResponse,
  KnowledgeSourceType,
  KnowledgeSummaryResponse,
} from '../types';
import '../styles/App.css';

const SOURCE_OPTIONS: Array<{ value: KnowledgeSourceType; label: string }> = [
  { value: 'cms', label: 'CMS' },
  { value: 'faq', label: 'FAQ' },
  { value: 'qa', label: 'Q&A' },
  { value: 'document', label: 'Document' },
];

function itemKey(item: { sourceType: KnowledgeSourceType; id: string }) {
  return `${item.sourceType}:${item.id}`;
}

export function KnowledgeBasePage() {
  const { language } = useLanguage();
  const { user } = useAuth();
  const apiFetch = useApi();
  const [searchParams, setSearchParams] = useSearchParams();

  const [query, setQuery] = useState('');
  const [selectedSources, setSelectedSources] = useState<KnowledgeSourceType[]>([]);
  const [results, setResults] = useState<KnowledgeSearchResponse['results']>([]);
  const [summary, setSummary] = useState<KnowledgeSummaryResponse | null>(null);
  const [selectedItem, setSelectedItem] = useState<KnowledgeItem | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initialQuery = searchParams.get('q');
    const itemId = searchParams.get('itemId');
    const sourceType = searchParams.get('sourceType') as KnowledgeSourceType | null;
    const initialSourceTypes = (searchParams.get('sourceTypes') || '')
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean) as KnowledgeSourceType[];

    if (initialSourceTypes.length > 0) {
      setSelectedSources(initialSourceTypes);
    }

    if (initialQuery && !query) {
      setQuery(initialQuery);
      void handleSearchFromValue(initialQuery, initialSourceTypes);
    }

    if (itemId && sourceType) {
      void fetchItem(sourceType, itemId, false);
    }
  }, []);

  const fetchItem = async (sourceType: KnowledgeSourceType, id: string, syncUrl: boolean = true) => {
    const res = await apiFetch(`/knowledge-base/items/${sourceType}/${id}`);
    if (!res.ok) throw new Error(`Error fetching item: ${res.status}`);
    const data = await res.json();
    setSelectedItem(data);
    if (syncUrl) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.set('sourceType', sourceType);
      nextParams.set('itemId', id);
      setSearchParams(nextParams, { replace: true });
    }
  };

  const toggleSource = (source: KnowledgeSourceType) => {
    setSelectedSources((prev) =>
      prev.includes(source)
        ? prev.filter((s) => s !== source)
        : [...prev, source]
    );
  };

  const handleSearch = async (event?: FormEvent) => {
    event?.preventDefault();
    await handleSearchFromValue(query, selectedSources);
  };

  const handleSearchFromValue = async (searchQuery: string, sources: KnowledgeSourceType[]) => {
    if (!searchQuery.trim()) return;

    setIsLoading(true);
    setError(null);
    setResults([]);
    setSummary(null);
    setSelectedItem(null);

    try {
      const sourceTypes = sources.length > 0 ? sources : SOURCE_OPTIONS.map((s) => s.value);
      
      const [unifiedRes, docRes] = await Promise.all([
        apiFetch(`/knowledge-base/search?q=${encodeURIComponent(searchQuery)}&sourceTypes=${sourceTypes.join(',')}`),
        sourceTypes.includes('document') || sourceTypes.length === 0
          ? apiFetch(`/documents/search?q=${encodeURIComponent(searchQuery)}&limit=10`)
          : Promise.resolve({ ok: true, json: () => Promise.resolve({ results: [] }) })
      ]);
      
      const unifiedData = unifiedRes.ok ? await unifiedRes.json() : { results: [] };
      let docResults: any[] = [];
      
      if (docRes.ok) {
        const docData = await docRes.json();
        const docArray = Array.isArray(docData) ? docData : (docData.results || []);
        docResults = docArray.map((d: any) => ({
          id: d.id,
          title: d.originalName,
          snippet: d.snippet,
          highlightedSnippet: d.highlightedSnippet,
          sourceType: 'document' as KnowledgeSourceType,
          metadata: {
            sourceLabel: 'Document',
            department: d.department,
          },
          content: d.content,
        }));
      }
      
      const allResults = [...(unifiedData.results || []), ...docResults];
      setResults(allResults);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSummarize = async () => {
    if (!selectedItem) return;

    setIsSummarizing(true);
    try {
      const res = await apiFetch('/knowledge-base/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceType: selectedItem.sourceType,
          itemId: selectedItem.id,
        }),
      });
      if (!res.ok) throw new Error(`Error summarizing: ${res.status}`);
      const data = await res.json();
      setSummary(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Summary error');
    } finally {
      setIsSummarizing(false);
    }
  };

  const sidebarContent = (
    <div className="kb-sidebar">
      <div className="kb-sidebar-section">
        <h3>{language === 'es' ? 'Acciones' : 'Actions'}</h3>
        <Link to="/kb-documents" className="kb-sidebar-item">
          📄 {language === 'es' ? 'Ver Documentos' : 'View Documents'}
        </Link>
        <Link to="/qa" className="kb-sidebar-item">
          ❓ {language === 'es' ? 'Q&A' : 'Q&A'}
        </Link>
      </div>
    </div>
  );

  return (
    <Layout sidebarContent={sidebarContent}>
      <div className="kb-page">
        <div className="kb-header">
          <div>
            <span className="kb-eyebrow">Knowledge Base</span>
            <h1>{language === 'es' ? 'Búsqueda documental y resumen' : 'Document search and summary'}</h1>
            <p>
              {language === 'es'
                ? 'Consulta CMS, FAQs, Q&A y documentos desde una única interfaz.'
                : 'Search CMS, FAQs, Q&A, and uploaded documents from one workspace.'}
            </p>
          </div>
        </div>

        <form className="kb-search-bar" onSubmit={(event) => void handleSearch(event)}>
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={language === 'es' ? 'Buscar en la base de conocimiento...' : 'Search the knowledge base...'}
          />
          <button type="submit" className="btn-primary" disabled={!query.trim() || isLoading}>
            {isLoading ? (language === 'es' ? 'Buscando...' : 'Searching...') : (language === 'es' ? 'Buscar' : 'Search')}
          </button>
        </form>

        <div className="kb-filters">
          {SOURCE_OPTIONS.map((source) => (
            <button
              key={source.value}
              type="button"
              className={`kb-filter-chip ${selectedSources.includes(source.value) ? 'active' : ''}`}
              onClick={() => toggleSource(source.value)}
            >
              {source.label}
            </button>
          ))}
        </div>

        {error && <div className="kb-error">{error}</div>}

        <div className="kb-content-grid">
          <section className="kb-results-panel">
            <div className="kb-panel-heading">
              <h2>{language === 'es' ? 'Resultados' : 'Results'}</h2>
              <span>{results.length}</span>
            </div>

            {results.length === 0 ? (
              <div className="kb-empty-state">
                {query.trim()
                  ? (language === 'es' ? 'No hay resultados para esta consulta.' : 'No results for this query.')
                  : (language === 'es' ? 'Lanza una consulta para empezar.' : 'Run a search to get started.')}
              </div>
            ) : (
              <div className="kb-results-list">
                {results.map((result) => (
                  <article key={itemKey(result)} className="kb-result-card">
                    <div className="kb-result-meta">
                      <span>{result.metadata.sourceLabel}</span>
                      {result.metadata.category && <span>{result.metadata.category}</span>}
                      {result.metadata.department && <span>{result.metadata.department}</span>}
                    </div>
                    <h3>{result.title}</h3>
                    {result.highlightedSnippet ? (
                      <p dangerouslySetInnerHTML={{ __html: result.highlightedSnippet }} />
                    ) : (
                      <p>{result.snippet}</p>
                    )}
                    <div className="kb-result-actions">
                      <button type="button" className="btn-primary" onClick={() => void fetchItem(result.sourceType, result.id)}>
                        {language === 'es' ? 'Ver detalle' : 'Open detail'}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="kb-detail-panel">
            <div className="kb-panel-heading">
              <h2>{language === 'es' ? 'Resumen' : 'Summary'}</h2>
              <span>{isSummarizing ? (language === 'es' ? 'Generando...' : 'Generating...') : ''}</span>
            </div>

            {summary ? (
              <div className="kb-summary-card">
                <pre>{summary.summary}</pre>
                {summary.citations.length > 0 && (
                  <div className="kb-citations">
                    <h3>{language === 'es' ? 'Citas' : 'Citations'}</h3>
                    {summary.citations.map((citation) => (
                      <button
                        key={`${citation.sourceType}:${citation.itemId}`}
                        type="button"
                        className="kb-citation-chip"
                        onClick={() => void fetchItem(citation.sourceType, citation.itemId)}
                      >
                        {citation.title}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="kb-empty-state">
                {language === 'es' ? 'El resumen aparecerá aquí tras buscar.' : 'The summary will appear here after searching.'}
              </div>
            )}

            <div className="kb-panel-heading">
              <h2>{language === 'es' ? 'Detalle' : 'Detail'}</h2>
            </div>

            {selectedItem ? (
              <article className="kb-item-detail">
                <div className="kb-result-meta">
                  <span>{selectedItem.metadata.sourceLabel}</span>
                  {selectedItem.metadata.category && <span>{selectedItem.metadata.category}</span>}
                  {selectedItem.metadata.department && <span>{selectedItem.metadata.department}</span>}
                </div>
                <h3>{selectedItem.title}</h3>
                {selectedItem.summary && <p className="kb-item-summary">{selectedItem.summary}</p>}
                <div className="kb-item-content">{selectedItem.content}</div>
              </article>
            ) : (
              <div className="kb-empty-state">
                {language === 'es' ? 'Selecciona un resultado para ver el detalle.' : 'Select a result to open the full item.'}
              </div>
            )}
          </section>
        </div>
      </div>
    </Layout>
  );
}