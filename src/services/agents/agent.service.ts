import { Agent, IAgent } from '../../db/mongo/models/agent';

// Obtener todos los agents activos
export async function getActiveAgents(): Promise<IAgent[]> {
  return Agent.find({ isActive: true }).sort({ name: 1 }).lean();
}

// Obtener agente por nombre
export async function getAgentByName(name: string): Promise<IAgent | null> {
  return Agent.findOne({ name, isActive: true }).lean();
}

// Obtener agente por ID
export async function getAgentById(id: string): Promise<IAgent | null> {
  return Agent.findById(id).lean();
}

// Crear nuevo agente (NO system)
export async function createAgent(data: {
  name: string;
  displayName: string;
  description?: string;
  instructions: string;
}): Promise<IAgent> {
  if (data.name === 'Standard' || data.name === 'InfoSec') {
    throw new Error('Cannot create system agents');
  }
  
  const exists = await Agent.findOne({ name: data.name });
  if (exists) {
    throw new Error(`Agent "${data.name}" already exists`);
  }
  
  return Agent.create({
    name: data.name,
    displayName: data.displayName,
    description: data.description || '',
    instructions: data.instructions,
    isSystem: false,
    isActive: true,
  });
}

// Actualizar agente (NO system)
export async function updateAgent(id: string, data: Partial<{
  displayName?: string;
  description?: string;
  instructions?: string;
}>): Promise<IAgent | null> {
  const agent = await Agent.findById(id);
  if (!agent) throw new Error('Agent not found');
  if (agent.isSystem) throw new Error('Cannot modify system agents');
  
  return Agent.findByIdAndUpdate(
    id, 
    { ...data, updatedAt: new Date() }, 
    { new: true }
  );
}

// Eliminar agente (soft delete, NO system)
export async function deleteAgent(id: string): Promise<IAgent | null> {
  const agent = await Agent.findById(id);
  if (!agent) throw new Error('Agent not found');
  if (agent.isSystem) throw new Error('Cannot delete system agents');
  
  return Agent.findByIdAndUpdate(
    id, 
    { isActive: false, updatedAt: new Date() }, 
    { new: true }
  );
}

// Inicializar agents del sistema si no existen
export async function initializeSystemAgents(): Promise<void> {
  const systemAgents = [
    {
      name: 'Standard',
      displayName: 'Standard Assistant',
      description: 'General purpose assistant',
      instructions: `You are a helpful assistant. Provide clear and concise answers.\n\nQuery: {{query}}\n\nSession summary: {{sessionSummary}}\n\nResponse format: Clear explanation with examples if needed.\n\nRules:\n{{rules}}\n\nRecovered passages:\n{{passages}}\n\nMetrics: {{metrics}}`,
      isSystem: true,
    },
    {
      name: 'InfoSec',
      displayName: 'InfoSec Specialist',
      description: 'InfoSec knowledge base assistant',
      instructions: `You are an InfoSec assistant. Respond with evidence and avoid unsupported claims.\n\nTask profile: InfoSec Specialist\n\nQuery: {{query}}\n\nSession summary: {{sessionSummary}}\n\nResponse format: Short answer + evidence bullets.\n\nRules:\n1. All answers must include at least one citation.\n2. If coverage is weak, suggest creating a Q&A.\n{{rules}}\n\nRecovered passages:\n{{passages}}\n\nMetrics: {{metrics}}`,
      isSystem: true,
    },
    {
      name: 'Gap Analysis',
      displayName: 'Gap Analysis Specialist',
      description: 'Analyzes coverage gaps and provides recommendations',
      instructions: `You are a Gap Analysis Specialist for InfoSec.\n\nQuery: {{query}}\n\n## Executive Summary\n[Brief overview of the query topic coverage]\n\n## Gap Details\n- **Gap 1**: [Description] (Severity: High/Medium/Low)\n- **Gap 2**: ...\n\n## Recommendations\n1. [Actionable suggestion with priority]\n2. ...\n\nSession summary: {{sessionSummary}}\n\nMetrics: {{metrics}}\n\nRules:\n{{rules}}\n\nRecovered passages:\n{{passages}}`,
      isSystem: false,  // SE PUEDE modificar
    },
    {
      name: 'Compliance',
      displayName: 'Compliance Specialist',
      description: 'Regulatory compliance and audit specialist',
      instructions: `You are a Compliance Specialist.\n\nQuery: {{query}}\n\nFocus: Regulatory requirements, audit checklists, and compliance gaps.\n\n## Regulatory Mapping\n[Map query to relevant regulations]\n\n## Compliance Gaps\n[Identify missing controls]\n\n## Audit Checklist\n[Items to verify]\n\nSession summary: {{sessionSummary}}\n\nRules:\n{{rules}}\n\nRecovered passages:\n{{passages}}\n\nMetrics: {{metrics}}`,
      isSystem: false,
    },
    {
      name: 'IT',
      displayName: 'IT Security Specialist',
      description: 'IT security and technical controls specialist',
      instructions: `You are an IT Security Specialist.\n\nQuery: {{query}}\n\nFocus: Technical details, configuration examples, and security tools.\n\n## Technical Analysis\n[Detailed technical response]\n\n## Configuration Examples\n[Specific configs and code samples]\n\n## Recommended Tools\n[Relevant security tools]\n\nSession summary: {{sessionSummary}}\n\nRules:\n{{rules}}\n\nRecovered passages:\n{{passages}}\n\nMetrics: {{metrics}}`,
      isSystem: false,
    },
    {
      name: 'Cloud',
      displayName: 'Cloud Security Specialist',
      description: 'Cloud infrastructure and services security',
      instructions: `You are a Cloud Security Specialist.\n\nQuery: {{query}}\n\nFocus: Cloud controls, provider comparison, and best practices.\n\n## Cloud Controls\n[Relevant cloud security controls]\n\n## Provider Comparison\n[AWS vs Azure vs GCP if relevant]\n\n## Best Practices\n[Actionable cloud security recommendations]\n\nSession summary: {{sessionSummary}}\n\nRules:\n{{rules}}\n\nRecovered passages:\n{{passages}}\n\nMetrics: {{metrics}}`,
      isSystem: false,
    },
    {
      name: 'Legal',
      displayName: 'Legal Specialist',
      description: 'Legal and contractual security specialist',
      instructions: `You are a Legal Specialist.\n\nQuery: {{query}}\n\nFocus: Contract clauses, liability, and legal risks.\n\n## Contract Analysis\n[Relevant contract clauses]\n\n## Legal Risks\n[Identified legal and compliance risks]\n\n## Recommendations\n[Legal safeguards and protections]\n\nSession summary: {{sessionSummary}}\n\nRules:\n{{rules}}\n\nRecovered passages:\n{{passages}}\n\nMetrics: {{metrics}}`,
      isSystem: false,
    },
    {
      name: 'Dev',
      displayName: 'DevSecOps Specialist',
      description: 'Secure development and SDLC specialist',
      instructions: `You are a DevSecOps Specialist.\n\nQuery: {{query}}\n\nFocus: SDLC, secure coding, and testing approaches.\n\n## Secure Development\n[SDLC best practices]\n\n## Code Security\n[Secure coding examples]\n\n## Testing Approaches\n[Security testing methodologies]\n\nSession summary: {{sessionSummary}}\n\nRules:\n{{rules}}\n\nRecovered passages:\n{{passages}}\n\nMetrics: {{metrics}}`,
      isSystem: false,
    },
  ];

  for (const agentData of systemAgents) {
    const exists = await Agent.findOne({ name: agentData.name });
    if (!exists) {
      await Agent.create(agentData);
      console.log(`✅ Created system agent: ${agentData.name}`);
    }
  }
}
