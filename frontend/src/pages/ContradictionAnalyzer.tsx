import { useState } from 'react';
import { Layout } from '../components/Layout';
import { useApi } from '../contexts/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import type { ContradictionAnalysisResponse } from '../types';
import '../styles/App.css';

export function ContradictionAnalyzerPage() {
  const apiFetch = useApi();
  const { language } = useLanguage();
  const [question, setQuestion] = useState('');
  const [domain, setDomain] = useState('general');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ContradictionAnalysisResponse | null>(null);

  const runAnalysis = async () => {
    if (!question.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch('/analysis/contradictions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, domain }),
      });
      if (!response.ok) {
        throw new Error(language === 'es' ? 'No se pudo ejecutar el analisis' : 'Failed to run analysis');
      }
      setResult(await response.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'analysis error');
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="analytics-page">
        <div className="analytics-header">
          <h1>{language === 'es' ? 'Detector de contradicciones' : 'Contradiction analyzer'}</h1>
        </div>

        <section className="analytics-panel">
          <div className="analytics-grid">
            <div>
              <label>{language === 'es' ? 'Pregunta' : 'Question'}</label>
              <textarea
                className="chat-input"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder={language === 'es' ? 'Ej: Hemos comprometido 24x7 monitoring?' : 'E.g. Have we contractually committed 24x7 monitoring?'}
              />
            </div>
            <div>
              <label>{language === 'es' ? 'Dominio' : 'Domain'}</label>
              <input
                className="search-input"
                value={domain}
                onChange={(event) => setDomain(event.target.value || 'general')}
              />
              <button className="btn-primary" style={{ marginTop: 12 }} onClick={runAnalysis} disabled={loading || !question.trim()}>
                {loading ? (language === 'es' ? 'Analizando...' : 'Analyzing...') : (language === 'es' ? 'Analizar' : 'Analyze')}
              </button>
            </div>
          </div>
        </section>

        {error && <div className="analytics-error">{error}</div>}

        {result && (
          <>
            <section className="analytics-panel">
              <h2>{language === 'es' ? 'Resultado' : 'Result'}</h2>
              <table className="analytics-table">
                <tbody>
                  <tr>
                    <td>{language === 'es' ? 'Score contradiccion' : 'Contradiction score'}</td>
                    <td>{result.contradiction_score}</td>
                  </tr>
                  <tr>
                    <td>{language === 'es' ? 'Hallazgos' : 'Findings'}</td>
                    <td>{result.findings.length}</td>
                  </tr>
                </tbody>
              </table>
            </section>

            <section className="analytics-panel">
              <h2>{language === 'es' ? 'Detalle de hallazgos' : 'Findings detail'}</h2>
              <table className="analytics-table">
                <thead>
                  <tr>
                    <th>{language === 'es' ? 'Severidad' : 'Severity'}</th>
                    <th>{language === 'es' ? 'Tipo' : 'Type'}</th>
                    <th>{language === 'es' ? 'Motivo' : 'Reason'}</th>
                    <th>{language === 'es' ? 'Score' : 'Score'}</th>
                  </tr>
                </thead>
                <tbody>
                  {result.findings.map((finding, index) => (
                    <tr key={`${finding.type}-${index}`}>
                      <td>{finding.severity}</td>
                      <td>{finding.type}</td>
                      <td>{finding.reason}</td>
                      <td>{finding.score}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </>
        )}
      </div>
    </Layout>
  );
}
