import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useApi } from '../contexts/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';

const INFOSEC_DOMAINS = [
  'InfoSec Policy & Procedures', 'Security Human Resource', 'Asset management',
  'Access control', 'Encryption', 'Physical and Logical security', 'ESG',
  'SDLC', 'Relation with suppliers/third-party', 'Incident Management',
  'Business Continuity', 'Operational management', 'Compliance', 'Audit',
  'Information Security', 'IT General Security', 'IT Network Security',
  'IT Systems Security', 'Risk Management', 'Segregation of Duties',
  'Intellectual Property & Proprietary Rights',
];

export function CanonicalAnswers() {
  const apiFetch = useApi();
  const { language } = useLanguage();
  const t = (es: string, en: string) => language === 'es' ? es : en;

  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [domainFilter, setDomainFilter] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [formData, setFormData] = useState({ question: '', answer: '', domain: '', owner: '', status: 'draft', sourceRefs: '' });
  const pageSize = 20;

  useEffect(() => {
    fetchItems();
  }, [page, statusFilter, domainFilter, search]);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (statusFilter) params.set('status', statusFilter);
      if (domainFilter) params.set('domain', domainFilter);
      if (search) params.set('search', search);
      const res = await apiFetch(`/api/canonical-answers?${params}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
        setTotal(data.total || 0);
      }
    } catch (err) {
      console.error('Error loading canonicals:', err);
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditItem(null);
    setFormData({ question: '', answer: '', domain: INFOSEC_DOMAINS[0], owner: '', status: 'draft', sourceRefs: '' });
    setShowModal(true);
  };

  const openEdit = (item: any) => {
    setEditItem(item);
    setFormData({
      question: item.question,
      answer: item.currentAnswer,
      domain: item.domain,
      owner: item.owner,
      status: item.status,
      sourceRefs: (item.sourceRefs || []).join('\n'),
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    try {
      const body = {
        question: formData.question,
        answer: formData.answer,
        domain: formData.domain,
        owner: formData.owner,
        status: formData.status,
        sourceRefs: formData.sourceRefs.split('\n').filter(Boolean),
      };
      const url = editItem ? `/api/canonical-answers/${editItem._id}` : '/api/canonical-answers';
      const method = editItem ? 'PUT' : 'POST';
      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setShowModal(false);
        fetchItems();
      }
    } catch (err) {
      console.error('Error saving canonical:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('Delete this canonical answer?', '¿Eliminar esta respuesta canónica?'))) return;
    const res = await apiFetch(`/api/canonical-answers/${id}`, { method: 'DELETE' });
    if (res.ok) fetchItems();
  };

  const handleVerify = async (id: string) => {
    try {
      const res = await apiFetch(`/api/canonical-answers/${id}/verify`, { method: 'POST' });
      if (res.ok) {
        const result = await res.json();
        alert(result.verified
          ? t('Verified! Confidence:', '¡Verificado! Confianza:') + ` ${Math.round(result.confidence * 100)}%`
          : t('Could not verify against sources', 'No se pudo verificar contra las fuentes'));
      }
    } catch (err) {
      console.error('Error verifying:', err);
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <Layout>
      <Link to="/knowledge-center" className="back-link">← {t('Back', 'Volver')}</Link>
      <div className="canonical-answers">
        <div className="kc-header">
          <h1>⭐ {t('Canonical Answers', 'Respuestas Canónicas')}</h1>
          <button className="btn-primary" onClick={openCreate}>➕ {t('New Canonical', 'Nueva Canónica')}</button>
        </div>

        <div className="tr-filter-bar">
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
            <option value="">{t('All Status', 'Todos los Estados')}</option>
            <option value="approved">{t('Approved', 'Aprobado')}</option>
            <option value="draft">{t('Draft', 'Borrador')}</option>
            <option value="archived">{t('Archived', 'Archivado')}</option>
          </select>
          <select value={domainFilter} onChange={e => { setDomainFilter(e.target.value); setPage(1); }}>
            <option value="">{t('All Domains', 'Todos los Dominios')}</option>
            {INFOSEC_DOMAINS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <input type="text" className="tr-search-input" placeholder={t('Search question...', 'Buscar pregunta...')}
            value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>

        {loading ? (
          <div className="analytics-loading">{t('Loading...', 'Cargando...')}</div>
        ) : items.length === 0 ? (
          <div className="kc-empty">
            <p>{t('No canonical answers yet.', 'Aún no hay respuestas canónicas.')}</p>
            <button className="btn-primary" onClick={openCreate}>➕ {t('New Canonical', 'Nueva Canónica')}</button>
          </div>
        ) : (
          <table className="analytics-table">
            <thead>
              <tr>
                <th>{t('Question', 'Pregunta')}</th>
                <th>{t('Domain', 'Dominio')}</th>
                <th>{t('Owner', 'Responsable')}</th>
                <th>{t('Status', 'Estado')}</th>
                <th>{t('Actions', 'Acciones')}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item: any) => (
                <tr key={item._id}>
                  <td>{item.question}</td>
                  <td>{item.domain}</td>
                  <td>{item.owner}</td>
                  <td><span className={`tr-status-badge tr-status-${item.status}`}>{item.status}</span></td>
                  <td>
                    <button className="btn-secondary btn-sm" onClick={() => openEdit(item)}>✏️</button>
                    <button className="btn-secondary btn-sm" style={{ marginLeft: 4 }} onClick={() => handleVerify(item._id)}>
                      🔍 {t('Verify', 'Verificar')}
                    </button>
                    <button className="btn-secondary btn-sm" style={{ marginLeft: 4 }} onClick={() => handleDelete(item._id)}>🗑️</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {totalPages > 1 && (
          <div className="pagination">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← {t('Prev', 'Anterior')}</button>
            <span>{page} / {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>{t('Next', 'Siguiente')} →</button>
          </div>
        )}

        {showModal && (
          <div className="modal-overlay" onClick={() => setShowModal(false)}>
            <div className="modal-content modal-content-large" onClick={e => e.stopPropagation()}>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
              <div className="modal-header">
                <h3>{editItem ? t('Edit Canonical Answer', 'Editar Respuesta Canónica') : t('New Canonical Answer', 'Nueva Respuesta Canónica')}</h3>
              </div>
              <div className="modal-body">
                <div className="cms-form">
                  <div className="form-group">
                    <label>{t('Question', 'Pregunta')}</label>
                    <input type="text" value={formData.question} onChange={e => setFormData({ ...formData, question: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>{t('Answer', 'Respuesta')}</label>
                    <textarea rows={4} value={formData.answer} onChange={e => setFormData({ ...formData, answer: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>{t('Domain', 'Dominio')}</label>
                    <select value={formData.domain} onChange={e => setFormData({ ...formData, domain: e.target.value })}>
                      {INFOSEC_DOMAINS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>{t('Owner', 'Responsable')}</label>
                    <input type="text" value={formData.owner} onChange={e => setFormData({ ...formData, owner: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>{t('Status', 'Estado')}</label>
                    <select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })}>
                      <option value="draft">{t('Draft', 'Borrador')}</option>
                      <option value="approved">{t('Approved', 'Aprobado')}</option>
                      <option value="archived">{t('Archived', 'Archivado')}</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>{t('Source References (one per line)', 'Referencias (una por línea)')}</label>
                    <textarea rows={3} value={formData.sourceRefs} onChange={e => setFormData({ ...formData, sourceRefs: e.target.value })} />
                  </div>
                </div>
              </div>
              <div className="modal-actions">
                <button className="btn-secondary" onClick={() => setShowModal(false)}>{t('Cancel', 'Cancelar')}</button>
                <button className="btn-primary" onClick={handleSave}>{t('Save', 'Guardar')}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
