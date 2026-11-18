import { useEffect, useState } from 'react';

type Lang = 'es' | 'en';

interface EvidenceCriteriaModalProps {
  open: boolean;
  language: Lang;
  domains: string[];
  frameworks: string[];
  saving?: boolean;
  error?: string | null;
  onClose: () => void;
  onSave: (values: { evidenceDomains: string[]; evidenceFrameworks: string[] }) => void;
}

function splitLines(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/\r?\n/)
        .map((entry) => entry.trim())
        .filter(Boolean)
    )
  );
}

export function EvidenceCriteriaModal({
  open,
  language,
  domains,
  frameworks,
  saving,
  error,
  onClose,
  onSave,
}: EvidenceCriteriaModalProps) {
  const isEs = language === 'es';
  const [domainText, setDomainText] = useState('');
  const [frameworkText, setFrameworkText] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setDomainText(domains.join('\n'));
    setFrameworkText(frameworks.join('\n'));
    setLocalError(null);
  }, [open, domains, frameworks]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const submit = () => {
    const nextDomains = splitLines(domainText);
    const nextFrameworks = splitLines(frameworkText);
    if (!nextDomains.length) {
      setLocalError(isEs ? 'Añade al menos un dominio.' : 'Add at least one domain.');
      return;
    }
    if (!nextFrameworks.length) {
      setLocalError(isEs ? 'Añade al menos un framework.' : 'Add at least one framework.');
      return;
    }
    setLocalError(null);
    onSave({ evidenceDomains: nextDomains, evidenceFrameworks: nextFrameworks });
  };

  return (
    <div className="ev-modal-layer" role="presentation">
      <div className="ev-modal-overlay" onClick={onClose} />
      <div className="ev-modal" role="dialog" aria-modal="true" aria-label={isEs ? 'Criterios de evidencia' : 'Evidence criteria'}>
        <header className="ev-modal-head">
          <div>
            <h2>{isEs ? 'Criterios de evidencia' : 'Evidence criteria'}</h2>
            <p className="r360-muted">
              {isEs
                ? 'Estas listas alimentan los selectores de Dominio y Frameworks. Un valor por línea.'
                : 'These lists feed the Domain and Frameworks selectors. One value per line.'}
            </p>
          </div>
          <button className="ev-drawer-close" onClick={onClose} aria-label={isEs ? 'Cerrar' : 'Close'}>×</button>
        </header>

        <div className="ev-modal-body">
          {(localError || error) && <div className="r360-error" role="alert">{localError || error}</div>}
          <div className="ev-modal-grid">
            <label className="r360-field">
              <span>{isEs ? 'Dominios' : 'Domains'}</span>
              <textarea
                rows={12}
                value={domainText}
                onChange={(event) => setDomainText(event.target.value)}
              />
              <span className="r360-muted">
                {isEs ? `${splitLines(domainText).length} dominios` : `${splitLines(domainText).length} domains`}
              </span>
            </label>
            <label className="r360-field">
              <span>{isEs ? 'Frameworks' : 'Frameworks'}</span>
              <textarea
                rows={12}
                value={frameworkText}
                onChange={(event) => setFrameworkText(event.target.value)}
              />
              <span className="r360-muted">
                {isEs ? `${splitLines(frameworkText).length} frameworks` : `${splitLines(frameworkText).length} frameworks`}
              </span>
            </label>
          </div>
        </div>

        <footer className="ev-modal-foot">
          <button className="r360-btn" onClick={onClose}>{isEs ? 'Cancelar' : 'Cancel'}</button>
          <button className="r360-btn r360-btn-primary" disabled={saving} onClick={submit}>
            {saving ? (isEs ? 'Guardando…' : 'Saving…') : (isEs ? 'Guardar criterios' : 'Save criteria')}
          </button>
        </footer>
      </div>
    </div>
  );
}
