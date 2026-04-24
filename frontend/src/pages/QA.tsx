import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext';
import { useApi } from '../contexts/AuthContext';
import { Layout } from '../components/Layout';
import '../styles/App.css';

const DEPARTMENT_OPTIONS = ['Cloud', 'IT', 'Development', 'Compliance', 'Legal'] as const;

const INFOSEC_DOMAINS = [
  { name: 'InfoSec Policy & Procedures', section: 1 },
  { name: 'Security Human Resource', section: 2 },
  { name: 'Asset management', section: 3 },
  { name: 'Access control', section: 4 },
  { name: 'Encryption', section: 5 },
  { name: 'Physical and Logical security', section: 6 },
  { name: 'ESG', section: 7 },
  { name: 'SDLC', section: 8 },
  { name: 'Relation with suppliers/third-party', section: 9 },
  { name: 'Incident Management', section: 10 },
  { name: 'Business Continuity', section: 11 },
  { name: 'Operational management', section: 12 },
  { name: 'Compliance', section: 13 },
  { name: 'Audit', section: 14 },
  { name: 'Information Security', section: 15 },
  { name: 'IT General Security', section: 16 },
  { name: 'IT Network Security', section: 17 },
  { name: 'IT Systems Security', section: 18 },
  { name: 'Risk Management', section: 19 },
  { name: 'Segregation of Duties', section: 20 },
  { name: 'Intellectual Property & Proprietary Rights', section: 21 },
] as const;

const INFOSEC_DOMAIN_LIST = INFOSEC_DOMAINS.map(d => d.name);

interface QAEntry {
  id: string;
  questionNumber?: string;
  question: string;
  answer: string;
  department?: string;
  infoSecDomain?: string;
  source?: string;
  createdAt: string;
}

interface QASearchResult {
  id: string;
  question: string;
  answer: string;
  questionNumber?: string;
  infoSecDomain?: string;
  similarity: number;
  matchType: 'exact' | 'similar' | 'none';
}

const parseQuestionNumber = (q: string): number[] => {
  if (!q) return [0, 0];
  const parts = q.split('.').map(Number);
  return parts.length === 2 ? parts : [0, 0];
};

const highlightText = (text: string, query: string): React.ReactNode => {
  if (!query.trim()) return text;
  const parts = text.split(new RegExp(`(${query})`, 'gi'));
  return parts.map((part, i) => 
    part.toLowerCase() === query.toLowerCase() 
      ? <mark key={i} style={{ backgroundColor: '#fef08a', padding: '0 2px', borderRadius: '2px' }}>{part}</mark> 
      : part
  );
};

export function QAPage() {
  const { language } = useLanguage();
  const apiFetch = useApi();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [entries, setEntries] = useState<QAEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('');
  
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<QASearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  
  const [formData, setFormData] = useState({
    question: '',
    answer: '',
    department: '',
    infoSecDomain: '',
  });

  useEffect(() => {
    void fetchEntries();
  }, []);

  const fetchEntries = async () => {
    setIsLoading(true);
    const res = await apiFetch('/qa');
    if (res.ok) {
      const data = await res.json();
      setEntries(data);
    }
    setIsLoading(false);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    setSearchResults([]);
    
    const res = await apiFetch('/qa/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: searchQuery }),
    });
    
    if (res.ok) {
      const data = await res.json();
      setSearchResults(data);
      setShowSearchModal(true);
    }
    
    setIsSearching(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.infoSecDomain) {
      alert(language === 'es' ? 'Selecciona un InfoSec Domain' : 'Select an InfoSec Domain');
      return;
    }
    
    const body: Record<string, string> = {
      question: formData.question,
      answer: formData.answer,
      infoSecDomain: formData.infoSecDomain,
    };
    if (formData.department) body.department = formData.department;

    let res;
    if (editingId) {
      res = await apiFetch(`/qa/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } else {
      res = await apiFetch('/qa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    }

    if (res.ok) {
      setFormData({ question: '', answer: '', department: '', infoSecDomain: '' });
      setEditingId(null);
      await fetchEntries();
    }
  };

  const handleEdit = (entry: QAEntry) => {
    setFormData({
      question: entry.question,
      answer: entry.answer,
      department: entry.department || '',
      infoSecDomain: entry.infoSecDomain || '',
    });
    setEditingId(entry.id);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(language === 'es' ? '¿Eliminar esta pregunta?' : 'Delete this question?')) {
      return;
    }
    const res = await apiFetch(`/qa/${id}`, { method: 'DELETE' });
    if (res.ok) {
      await fetchEntries();
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const content = await file.text();

    const res = await apiFetch('/qa/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });

    if (res.ok) {
      const result = await res.json();
      alert(language === 'es' 
        ? `Importado: ${result.imported}, Saltados: ${result.skipped}`
        : `Imported: ${result.imported}, Skipped: ${result.skipped}`);
      await fetchEntries();
    }
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setIsImporting(false);
  };

  const handleExport = async () => {
    const res = await apiFetch('/qa/export');
    if (!res.ok) return;

    const content = await res.text();
    const date = new Date().toISOString().split('T')[0];
    const filename = `Q&A_${date}.txt`;
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredEntries = filter
    ? entries.filter(e => 
        e.question.toLowerCase().includes(filter.toLowerCase()) ||
        e.answer.toLowerCase().includes(filter.toLowerCase()) ||
        (e.questionNumber && e.questionNumber.includes(filter)) ||
        (e.infoSecDomain && e.infoSecDomain.toLowerCase().includes(filter.toLowerCase()))
      )
    : entries;

  const sortedEntries = [...filteredEntries].sort((a, b) => {
    const aNum = parseQuestionNumber(a.questionNumber || '');
    const bNum = parseQuestionNumber(b.questionNumber || '');
    if (aNum[0] !== bNum[0]) return aNum[0] - bNum[0];
    return aNum[1] - bNum[1];
  });

  return (
    <Layout>
      <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto', overflowY: 'auto', maxHeight: 'calc(100vh - 100px)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <span style={{ display: 'inline-flex', marginBottom: '14px', padding: '8px 12px', borderRadius: '999px', background: 'rgba(13, 58, 122, 0.08)', color: '#0d3a7a', fontSize: '12px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Knowledge Base</span>
            <h1 style={{ margin: 0, fontSize: '24px', color: '#0f172a' }}>Q&A</h1>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <Link 
              to="/knowledge-base"
              className="btn-primary"
              style={{ background: '#64748b', textDecoration: 'none', padding: '10px 16px', borderRadius: '8px', color: 'white' }}
            >
              ← {language === 'es' ? 'Volver' : 'Back'}
            </Link>
          </div>
        </div>

        <div style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', padding: '20px', borderRadius: '12px', marginBottom: '24px' }}>
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <input
                type="text"
                placeholder={language === 'es' ? 'Buscar pregunta...' : 'Search question...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ width: '100%', padding: '12px 40px 12px 16px', border: 'none', borderRadius: '8px', fontSize: '15px', outline: 'none' }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: '#64748b', padding: '4px' }}
                >
                  ✕
                </button>
              )}
            </div>
            <button
              type="submit"
              disabled={isSearching || !searchQuery.trim()}
              style={{ padding: '12px 24px', background: '#1e293b', color: 'white', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: '600', cursor: isSearching ? 'not-allowed' : 'pointer', opacity: isSearching ? 0.7 : 1 }}
            >
              {isSearching ? (language === 'es' ? 'Buscando...' : 'Searching...') : (language === 'es' ? '🔍 AI Buscar' : '🔍 AI Search')}
            </button>
          </form>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '24px' }}>
          <div style={{ background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', height: 'fit-content' }}>
            <h3 style={{ marginTop: 0 }}>{language === 'es' ? 'Añadir/Editar' : 'Add/Edit'}</h3>
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: '500' }}>
                  {language === 'es' ? 'InfoSec Domain' : 'InfoSec Domain'} * (auto-generates number)
                </label>
                <select
                  value={formData.infoSecDomain}
                  onChange={(e) => setFormData({ ...formData, infoSecDomain: e.target.value })}
                  required
                  style={{ width: '100%', padding: '8px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '14px' }}
                >
                  <option value="">{language === 'es' ? 'Seleccionar dominio' : 'Select domain'}</option>
                  {INFOSEC_DOMAINS.map((domain) => (
                    <option key={domain.name} value={domain.name}>{domain.section}. {domain.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: '500' }}>
                  {language === 'es' ? 'Departamento' : 'Department'}
                </label>
                <select
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  style={{ width: '100%', padding: '8px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '14px' }}
                >
                  <option value="">{language === 'es' ? 'Todos' : 'All'}</option>
                  {DEPARTMENT_OPTIONS.map((dept) => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: '500' }}>
                  {language === 'es' ? 'Pregunta' : 'Question'} *
                </label>
                <textarea
                  value={formData.question}
                  onChange={(e) => setFormData({ ...formData, question: e.target.value })}
                  required
                  rows={4}
                  style={{ width: '100%', padding: '8px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '14px', resize: 'vertical' }}
                />
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: '500' }}>
                  {language === 'es' ? 'Respuesta' : 'Answer'} *
                </label>
                <textarea
                  value={formData.answer}
                  onChange={(e) => setFormData({ ...formData, answer: e.target.value })}
                  required
                  rows={6}
                  style={{ width: '100%', padding: '8px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '14px', resize: 'vertical' }}
                />
              </div>
              <button
                type="submit"
                className="btn-primary"
                style={{ width: '100%' }}
              >
                {editingId ? (language === 'es' ? 'Actualizar' : 'Update') : (language === 'es' ? 'Añadir' : 'Add')}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(null);
                    setFormData({ question: '', answer: '', department: '', infoSecDomain: '' });
                  }}
                  style={{ width: '100%', marginTop: '8px', padding: '10px', background: '#64748b', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                >
                  {language === 'es' ? 'Cancelar' : 'Cancel'}
                </button>
              )}
            </form>

            <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid #e2e8f0' }}>
              <h4 style={{ marginTop: 0 }}>{language === 'es' ? 'Importar Q&A.txt' : 'Import Q&A.txt'}</h4>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt"
                onChange={handleFileUpload}
                disabled={isImporting}
                style={{ marginBottom: '8px' }}
              />
              {isImporting && <div style={{ color: '#64748b', fontSize: '13px' }}>{language === 'es' ? 'Importando...' : 'Importing...'}</div>}
            </div>

            <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid #e2e8f0' }}>
              <button
                onClick={handleExport}
                className="btn-primary"
                style={{ width: '100%', background: '#16a34a' }}
              >
                📥 {language === 'es' ? 'Exportar Q&A' : 'Export Q&A'}
              </button>
            </div>
          </div>

          <div style={{ background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0 }}>
                {language === 'es' ? 'Preguntas y Respuestas' : 'Questions & Answers'}
                <span style={{ marginLeft: '8px', color: '#64748b', fontSize: '14px' }}>({sortedEntries.length})</span>
              </h3>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  placeholder={language === 'es' ? 'Find Word' : 'Find Word'}
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  style={{ padding: '8px 32px 8px 12px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '14px', width: '200px' }}
                />
                {filter && (
                  <button
                    type="button"
                    onClick={() => setFilter('')}
                    style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', color: '#64748b', padding: '2px' }}
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {isLoading ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                {language === 'es' ? 'Cargando...' : 'Loading...'}
              </div>
            ) : sortedEntries.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                {language === 'es' ? 'No hay preguntas' : 'No questions'}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {sortedEntries.map((entry) => (
                  <div
                    key={entry.id}
                    style={{ padding: '16px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {entry.questionNumber && (
                          <span style={{ display: 'inline-block', background: '#3b82f6', color: 'white', padding: '2px 8px', borderRadius: '4px', fontSize: '12px' }}>
                            {entry.questionNumber}
                          </span>
                        )}
                        {entry.infoSecDomain && (
                          <span style={{ display: 'inline-block', background: '#8b5cf6', color: 'white', padding: '2px 8px', borderRadius: '4px', fontSize: '12px' }}>
                            {entry.infoSecDomain}
                          </span>
                        )}
                        {entry.department && (
                          <span style={{ color: '#64748b', fontSize: '12px' }}>{entry.department}</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          onClick={() => handleEdit(entry)}
                          style={{ padding: '4px 8px', background: '#f59e0b', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDelete(entry.id)}
                          style={{ padding: '4px 8px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                    <div style={{ fontWeight: '600', marginBottom: '12px', fontSize: '15px' }}>{highlightText(entry.question, filter)}</div>
                    <div style={{ color: '#475569', fontSize: '14px', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>{highlightText(entry.answer, filter)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {showSearchModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowSearchModal(false)}>
            <div style={{ background: 'white', borderRadius: '12px', padding: '24px', maxWidth: '900px', width: '90%', maxHeight: '80vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ margin: 0, fontSize: '20px' }}>{language === 'es' ? 'Resultados de Búsqueda' : 'Search Results'}</h2>
                <button onClick={() => setShowSearchModal(false)} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', padding: '0' }}>×</button>
              </div>
              
              {searchResults.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                  {language === 'es' ? 'No se encontraron resultados' : 'No results found'}
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                      <th style={{ textAlign: 'left', padding: '12px 8px', fontSize: '13px', color: '#64748b' }}>{language === 'es' ? 'Pregunta' : 'Question'}</th>
                      <th style={{ textAlign: 'left', padding: '12px 8px', fontSize: '13px', color: '#64748b' }}>{language === 'es' ? 'Respuesta' : 'Answer'}</th>
                      <th style={{ textAlign: 'center', padding: '12px 8px', fontSize: '13px', color: '#64748b', width: '100px' }}>{language === 'es' ? 'Similitud' : 'Similarity'}</th>
                      <th style={{ textAlign: 'center', padding: '12px 8px', fontSize: '13px', color: '#64748b', width: '120px' }}>{language === 'es' ? 'Sección' : 'Section'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {searchResults.map((result) => (
                      <tr key={result.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '12px 8px', fontSize: '14px', fontWeight: '500' }}>{result.question}</td>
                        <td style={{ padding: '12px 8px', fontSize: '14px', color: '#475569' }}>{result.answer.length > 150 ? result.answer.substring(0, 150) + '...' : result.answer}</td>
                        <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                          <span style={{ 
                            display: 'inline-block', 
                            padding: '4px 10px', 
                            borderRadius: '20px', 
                            fontSize: '13px', 
                            fontWeight: '600',
                            background: result.similarity >= 0.95 ? '#dcfce7' : result.similarity >= 0.75 ? '#fef3c7' : '#f1f5f9',
                            color: result.similarity >= 0.95 ? '#16a34a' : result.similarity >= 0.75 ? '#d97706' : '#64748b'
                          }}>
                            {Math.round(result.similarity * 100)}%
                          </span>
                        </td>
                        <td style={{ padding: '12px 8px', textAlign: 'center', fontSize: '13px', color: '#64748b' }}>
                          {result.questionNumber || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

export const QA = QAPage;