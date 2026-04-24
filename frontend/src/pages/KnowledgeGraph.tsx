import { useState, useEffect, useRef, useCallback } from 'react';
import ForceGraph2D, { ForceGraphMethods } from 'react-force-graph-2d';
import { Layout } from '../components/Layout';
import { useApi, API_URL } from '../contexts/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';

interface GraphNode {
  id: string;
  label: string;
  type: 'cms' | 'faq' | 'qanda' | 'document';
  title?: string;
  category?: string;
  department?: string;
}

interface GraphLink {
  source: string;
  target: string;
  similarity: number;
}

interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

interface GraphStats {
  totalNodes: number;
  cmsNodes: number;
  qandaNodes: number;
  documentNodes: number;
  totalLinks: number;
}

const TYPE_COLORS: Record<string, string> = {
  cms: '#2765C8',
  faq: '#78E0B0',
  qanda: '#6A3CE8',
  document: '#F39325'
};

export function KnowledgeGraphPage() {
  const { language } = useLanguage();
  const apiFetch = useApi();
  const graphRef = useRef<ForceGraphMethods>();
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
  const [stats, setStats] = useState<GraphStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  useEffect(() => {
    if (containerRef.current) {
      setDimensions({
        width: containerRef.current.clientWidth,
        height: Math.max(500, window.innerHeight - 200)
      });
    }
  }, []);

  useEffect(() => {
    async function loadGraph() {
      try {
        setLoading(true);
        
        const [graphRes, statsRes] = await Promise.all([
          apiFetch('/knowledge-graph'),
          apiFetch('/knowledge-graph/stats')
        ]);
        
        if (graphRes.ok) {
          const graphData = await graphRes.json();
          setGraphData(graphData);
        }
        
        if (statsRes.ok) {
          const statsData = await statsRes.json();
          setStats(statsData);
        }
      } catch (error) {
        console.error('Error loading knowledge graph:', error);
      } finally {
        setLoading(false);
      }
    }
    
    loadGraph();
  }, [apiFetch]);

  const handleNodeClick = useCallback((node: GraphNode) => {
    setSelectedNode(node);
    
    if (graphRef.current) {
      graphRef.current.centerAt(0, 0, 1000);
      graphRef.current.zoom(1.5, 1000);
    }
  }, []);

  const handleZoomIn = () => {
    graphRef.current?.zoom(graphRef.current.zoom() * 1.5, 300);
  };

  const handleZoomOut = () => {
    graphRef.current?.zoom(graphRef.current.zoom() / 1.5, 300);
  };

  const handleReset = () => {
    graphRef.current?.zoomToFit(500);
  };

  const t = (es: string, en: string) => language === 'es' ? es : en;

  return (
    <Layout>
      <div className="knowledge-graph-page">
        <div className="kg-header">
          <h1>{t('Knowledge Graph', 'Grafo de Conocimiento')}</h1>
          <p>{t('Interactive visualization of your knowledge base', 'Visualización interactiva de tu base de conocimiento')}</p>
        </div>

        {stats && (
          <div className="kg-stats">
            <div className="kg-stat">
              <span className="kg-stat-value">{stats.totalNodes}</span>
              <span className="kg-stat-label">{t('Total Nodes', 'Total Nodos')}</span>
            </div>
            <div className="kg-stat">
              <span className="kg-stat-value">{stats.cmsNodes}</span>
              <span className="kg-stat-label">CMS</span>
            </div>
            <div className="kg-stat">
              <span className="kg-stat-value">{stats.qandaNodes}</span>
              <span className="kg-stat-label">Q&A</span>
            </div>
            <div className="kg-stat">
              <span className="kg-stat-value">{stats.documentNodes}</span>
              <span className="kg-stat-label">{t('Documents', 'Documentos')}</span>
            </div>
            <div className="kg-stat">
              <span className="kg-stat-value">{stats.totalLinks}</span>
              <span className="kg-stat-label">{t('Links', 'Enlaces')}</span>
            </div>
          </div>
        )}

        <div className="kg-legend">
          {Object.entries(TYPE_COLORS).map(([type, color]) => (
            <div key={type} className="kg-legend-item">
              <span className="kg-legend-dot" style={{ backgroundColor: color }}></span>
              <span>{type.toUpperCase()}</span>
            </div>
          ))}
        </div>

        <div className="kg-controls">
          <button onClick={handleZoomIn} className="kg-btn">+</button>
          <button onClick={handleZoomOut} className="kg-btn">-</button>
          <button onClick={handleReset} className="kg-btn">{t('Reset', 'Reiniciar')}</button>
        </div>

        <div className="kg-graph-container" ref={containerRef}>
          {loading ? (
            <div className="kg-loading">{t('Loading graph...', 'Cargando grafo...')}</div>
          ) : (
            <ForceGraph2D
              ref={graphRef}
              graphData={graphData}
              width={dimensions.width}
              height={dimensions.height}
              nodeLabel={(node: any) => `${node.label} (${node.type})`}
              nodeColor={(node: any) => TYPE_COLORS[node.type] || '#999'}
              nodeRelSize={6}
              linkColor={() => '#ccc'}
              linkWidth={1}
              linkDirectionalArrowLength={3}
              linkDirectionalArrowRelPos={1}
              onNodeClick={handleNodeClick}
              cooldownTicks={100}
              backgroundColor="#f7f9fc"
            />
          )}
        </div>

        {selectedNode && (
          <div className="kg-node-panel">
            <div className="kg-node-header">
              <h3>{selectedNode.title || selectedNode.id}</h3>
              <button onClick={() => setSelectedNode(null)}>×</button>
            </div>
            <div className="kg-node-details">
              <div className="kg-node-field">
                <label>{t('Type', 'Tipo')}:</label>
                <span>{selectedNode.type}</span>
              </div>
              {selectedNode.category && (
                <div className="kg-node-field">
                  <label>{t('Category', 'Categoría')}:</label>
                  <span>{selectedNode.category}</span>
                </div>
              )}
              {selectedNode.department && (
                <div className="kg-node-field">
                  <label>{t('Department', 'Departamento')}:</label>
                  <span>{selectedNode.department}</span>
                </div>
              )}
              <div className="kg-node-field">
                <label>ID:</label>
                <span>{selectedNode.id}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}