import React, { useState } from 'react';
import type { Message } from '../types';

interface MessageMetadataProps {
  metadata: NonNullable<Message['metadata']>;
}

// Descripciones mixtas para flags (predefinidas + contexto)
const FLAG_DESCRIPTIONS: Record<string, { title: string; description: string; icon: string }> = {
  low_evidence: {
    title: 'Evidencia Baja',
    description: 'La respuesta tiene pocas fuentes que la respaldan. El score de confianza puede verse afectado.',
    icon: '⚠️'
  },
  contradiction: {
    title: 'Contradicción Detectada',
    description: 'Se encontraron fuentes con información contradictoria. Se recomienda verificar la respuesta.',
    icon: '🚫'
  },
  stale_evidence: {
    title: 'Evidencia Desactualizada',
    description: 'Las fuentes utilizadas podrían no estar actualizadas. Considere buscar información más reciente.',
    icon: '📅'
  },
  legal_review: {
    title: 'Requiere Revisión Legal',
    description: 'El tema de la consulta requiere supervisión por parte del equipo legal.',
    icon: '⚖️'
  },
};

interface FlagBadgeProps {
  flag: string;
  citations?: Message['metadata']['citations'];
}

function FlagBadge({ flag, citations }: FlagBadgeProps) {
  const [showDetail, setShowDetail] = useState(false);
  const flagInfo = FLAG_DESCRIPTIONS[flag] || {
    title: flag,
    description: 'Flag personalizado detectado en el sistema.',
    icon: '🏷️'
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <span 
        className={`flag-badge flag-badge-${flag}`}
        onClick={() => setShowDetail(!showDetail)}
        title="Click para ver detalles"
      >
        {flagInfo.icon} {flag.replace(/_/g, ' ')}
      </span>
      
      {showDetail && (
        <div className="flag-detail-tooltip">
          <div className="flag-detail-header">
            {flagInfo.icon} {flagInfo.title}
          </div>
          <p className="flag-detail-desc">{flagInfo.description}</p>
          {citations && citations.length > 0 && (
            <div className="flag-detail-sources">
              <strong>Fuentes relacionadas:</strong>
              {citations.slice(0, 3).map((cit, i) => (
                <div key={i} className="flag-source-item">
                  [{i + 1}] {cit.filename || cit.fileId || 'Fuente'}
                  {cit.score && <span className="source-score">({Math.round(cit.score * 100)}%)</span>}
                </div>
              ))}
            </div>
          )}
          <button 
            className="flag-detail-close"
            onClick={(e) => { e.stopPropagation(); setShowDetail(false); }}
          >
            Cerrar
          </button>
        </div>
      )}
    </div>
  );
}

interface ConfidenceBarProps {
  confidence?: number;
}

function ConfidenceBar({ confidence }: ConfidenceBarProps) {
  if (confidence === undefined) return null;
  
  const percentage = Math.round(confidence * 100);
  const getConfidenceClass = () => {
    if (confidence >= 0.7) return 'high';
    if (confidence >= 0.4) return 'medium';
    return 'low';
  };

  return (
    <div className="confidence-bar">
      <div className="confidence-label">Confianza:</div>
      <div className="confidence-track">
        <div 
          className={`confidence-fill ${getConfidenceClass()}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="confidence-text">{percentage}%</span>
    </div>
  );
}

interface CoverageBadgeProps {
  coverage_status?: MessageMetadataProps['metadata']['coverage_status'];
}

function CoverageBadge({ coverage_status }: CoverageBadgeProps) {
  if (!coverage_status) return null;

  const coverageConfig: Record<string, { icon: string; text: string }> = {
    'covered': { icon: '✅', text: 'Coberto' },
    'partial': { icon: '🟡', text: 'Parcial' },
    'uncovered': { icon: '❌', text: 'No coberto' },
    'weak': { icon: '⚠️', text: 'Débil' },
    'contradictory': { icon: '🚫', text: 'Contradictorio' },
    'human_review': { icon: '👁‍⚖️', text: 'Revisión humana' },
  };

  const config = coverageConfig[coverage_status] || { icon: '❓', text: coverage_status };

  return (
    <div className={`coverage-badge coverage-badge-${coverage_status}`}>
      {config.icon} {config.text}
    </div>
  );
}

interface SourceChipProps {
  source: NonNullable<MessageMetadataProps['metadata']['used_sources']>[number];
  onClick?: () => void;
}

function SourceChip({ source, onClick }: SourceChipProps) {
  const [expanded, setExpanded] = useState(false);

  const handleClick = () => {
    setExpanded(!expanded);
    if (onClick) onClick();
  };

  return (
    <div 
      className={`source-chip source-type-${source.sourceType}`}
      onClick={handleClick}
    >
      <span className="source-type-badge">{source.sourceType.toUpperCase()}</span>
      <span className="source-title">{source.title}</span>
      <span className="source-score">{Math.round(source.score * 100)}%</span>
      
      {expanded && (
        <div className="source-details">
          <div><strong>ID:</strong> {source.itemId}</div>
          <div><strong>Tipo:</strong> {source.sourceType}</div>
          <div><strong>Score:</strong> {Math.round(source.score * 100)}%</div>
          <button 
            className="source-view-btn"
            onClick={(e) => { 
              e.stopPropagation(); 
              alert(`Ver fuente: ${source.title}\nID: ${source.itemId}\nTipo: ${source.sourceType}`);
            }}
          >
            Ver fuente completa
          </button>
        </div>
      )}
    </div>
  );
}

export function MessageMetadata({ metadata }: MessageMetadataProps) {
  const [sourcesExpanded, setSourcesExpanded] = useState(false);

  return (
    <div className="message-metadata">
      {/* Barra de Confianza */}
      <ConfidenceBar confidence={metadata.confidence} />

      {/* Estado de Cobertura */}
      <div className="metadata-row">
        <CoverageBadge coverage_status={metadata.coverage_status} />
      </div>

      {/* Badges de Flags (Clickeables) */}
      {metadata.flags && metadata.flags.length > 0 && (
        <div className="metadata-row">
          <div className="flags-label">Banderas detectadas:</div>
          <div className="flag-badges">
            {metadata.flags.map((flag, idx) => (
              <FlagBadge key={idx} flag={flag} citations={metadata.citations} />
            ))}
          </div>
        </div>
      )}

      {/* Fuentes como Chips Expandibles */}
      {metadata.used_sources && metadata.used_sources.length > 0 && (
        <div className="sources-list">
          <div 
            className="sources-header"
            onClick={() => setSourcesExpanded(!sourcesExpanded)}
          >
            <span>📚 Fuentes utilizadas ({metadata.used_sources.length})</span>
            <span className={`expand-icon ${sourcesExpanded ? 'expanded' : ''}`}>▼</span>
          </div>
          
          {sourcesExpanded && (
            <div className="sources-chips">
              {metadata.used_sources.map((source, idx) => (
                <SourceChip key={idx} source={source} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
