const http = require('http');

const token = process.env.TOKEN;
const rules = [
  {
    name: 'citation-required',
    content: '1. All answers must include at least one citation from the knowledge base.\n2. If coverage is weak (below 50%), suggest creating a Q&A entry.\n3. Never make claims without evidence from the knowledge base.',
    domain: 'general',
    appliesTo: [],
    enabled: true
  },
  {
    name: 'infosec-evidence',
    content: '1. All security answers must include specific evidence (CVE, standard reference, etc.).\n2. If no evidence found, explicitly state "No specific evidence found in knowledge base".\n3. Prefer official standards (ISO 27001, NIST) over general advice.',
    domain: 'security',
    appliesTo: ['InfoSec', 'Compliance'],
    enabled: true
  },
  {
    name: 'gap-analysis-format',
    content: '1. Always structure Gap Analysis responses with: Executive Summary, Gap Details (with severity), Recommendations.\n2. Include coverage scores when available.\n3. Rate gaps as High/Medium/Low severity.',
    domain: 'analysis',
    appliesTo: ['Gap Analysis'],
    enabled: true
  },
  {
    name: 'compliance-regulatory',
    content: '1. Map all compliance queries to specific regulations (GDPR, ISO 27001, SOX, etc.).\n2. Include regulatory citation when available.\n3. Flag non-compliant findings with specific remediation steps.',
    domain: 'compliance',
    appliesTo: ['Compliance'],
    enabled: true
  },
  {
    name: 'it-security-tools',
    content: '1. When suggesting security tools, include version numbers and compatibility notes.\n2. Prefer open-source tools when possible with links.\n3. Always include configuration examples with code blocks.',
    domain: 'it-security',
    appliesTo: ['IT'],
    enabled: true
  },
  {
    name: 'cloud-provider-neutral',
    content: '1. When comparing cloud providers (AWS/Azure/GCP), maintain neutrality.\n2. Include pricing comparison when relevant.\n3. Mention compliance certifications for each provider (ISO 27001, SOC 2, etc.).',
    domain: 'cloud',
    appliesTo: ['Cloud'],
    enabled: true
  },
  {
    name: 'legal-contract-focus',
    content: '1. Focus on contract clauses, liability limitations, and indemnification.\n2. Always flag high-risk contract terms.\n3. Cross-reference with local regulations when applicable.',
    domain: 'legal',
    appliesTo: ['Legal'],
    enabled: true
  },
  {
    name: 'devsecops-best-practices',
    content: '1. Always mention security testing in CI/CD pipeline.\n2. Include OWASP Top 10 references for web security.\n3. Suggest specific tools: Snyk, SonarQube, Checkmarx with configuration examples.',
    domain: 'devsecops',
    appliesTo: ['Dev'],
    enabled: true
  },
  {
    name: 'no-hallucination',
    content: '1. Never invent statistics, dates, or specific document references.\n2. If unsure, state "I don\'t have specific data on this" instead of guessing.\n3. Always qualify estimates with "approximately" or "based on available data".',
    domain: 'general',
    appliesTo: [],
    enabled: true
  },
  {
    name: 'session-context',
    content: '1. Reference previous conversation context when relevant.\n2. If user asks follow-up, check session summary before answering.\n3. Maintain consistency with previous answers in the same session.',
    domain: 'general',
    appliesTo: [],
    enabled: true
  },
  {
    name: 'metric-reporting',
    content: '1. When providing metrics, explain what they mean in business terms.\n2. Include confidence scores when available.\n3. Flag low-confidence answers (< 0.6) for human review.',
    domain: 'general',
    appliesTo: ['Gap Analysis', 'Compliance'],
    enabled: true
  },
  {
    name: 'language-tone',
    content: '1. Use professional, clear language suitable for business stakeholders.\n2. Avoid excessive jargon unless user is technical (IT/Dev agents).\n3. Use bullet points and numbered lists for readability.',
    domain: 'general',
    appliesTo: [],
    enabled: true
  }
];

let completed = 0;
rules.forEach((rule, index) => {
  const data = JSON.stringify(rule);
  const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/rules',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'Content-Length': data.length
    }
  };

  const req = http.request(options, (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
      console.log(`Rule ${index + 1}/${rules.length}: ${rule.name} - ${res.statusCode}`);
      if (body) console.log(`  Response: ${body.substring(0, 100)}`);
      completed++;
      if (completed === rules.length) {
        console.log('\nAll rules created!');
      }
    });
  });

  req.on('error', (err) => {
    console.error(`Error creating rule ${rule.name}:`, err.message);
    completed++;
  });

  req.write(data);
  req.end();
});
