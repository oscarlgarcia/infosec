#!/bin/bash
# Create sample rules via API

# Get token
TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)

echo "Token obtained"

# Create rules
create_rule() {
  curl -s -X POST http://localhost:3000/rules \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "$1"
}

# Rule 1: citation-required (all agents)
create_rule '{"name":"citation-required","content":"1. All answers must include at least one citation from the knowledge base.\n2. If coverage is weak (below 50%), suggest creating a Q&A entry.\n3. Never make claims without evidence from the knowledge base.","domain":"general","appliesTo":[],"enabled":true}'
echo "Rule 1 created"

# Rule 2: infosec-evidence
create_rule '{"name":"infosec-evidence","content":"1. All security answers must include specific evidence (CVE, standard reference, etc.).\n2. If no evidence found, explicitly state \"No specific evidence found in knowledge base\".\n3. Prefer official standards (ISO 27001, NIST) over general advice.","domain":"security","appliesTo":["InfoSec","Compliance"],"enabled":true}'
echo "Rule 2 created"

# Rule 3: gap-analysis-format
create_rule '{"name":"gap-analysis-format","content":"1. Always structure Gap Analysis responses with: Executive Summary, Gap Details (with severity), Recommendations.\n2. Include coverage scores when available.\n3. Rate gaps as High/Medium/Low severity.","domain":"analysis","appliesTo":["Gap Analysis"],"enabled":true}'
echo "Rule 3 created"

# Rule 4: compliance-regulatory
create_rule '{"name":"compliance-regulatory","content":"1. Map all compliance queries to specific regulations (GDPR, ISO 27001, SOX, etc.).\n2. Include regulatory citation when available.\n3. Flag non-compliant findings with specific remediation steps.","domain":"compliance","appliesTo":["Compliance"],"enabled":true}'
echo "Rule 4 created"

# Rule 5: it-security-tools
create_rule '{"name":"it-security-tools","content":"1. When suggesting security tools, include version numbers and compatibility notes.\n2. Prefer open-source tools when possible with links.\n3. Always include configuration examples with code blocks.","domain":"it-security","appliesTo":["IT"],"enabled":true}'
echo "Rule 5 created"

# Rule 6: cloud-provider-neutral
create_rule '{"name":"cloud-provider-neutral","content":"1. When comparing cloud providers (AWS/Azure/GCP), maintain neutrality.\n2. Include pricing comparison when relevant.\n3. Mention compliance certifications for each provider (ISO 27001, SOC 2, etc.).","domain":"cloud","appliesTo":["Cloud"],"enabled":true}'
echo "Rule 6 created"

# Rule 7: legal-contract-focus
create_rule '{"name":"legal-contract-focus","content":"1. Focus on contract clauses, liability limitations, and indemnification.\n2. Always flag high-risk contract terms.\n3. Cross-reference with local regulations when applicable.","domain":"legal","appliesTo":["Legal"],"enabled":true}'
echo "Rule 7 created"

# Rule 8: devsecops-best-practices
create_rule '{"name":"devsecops-best-practices","content":"1. Always mention security testing in CI/CD pipeline.\n2. Include OWASP Top 10 references for web security.\n3. Suggest specific tools: Snyk, SonarQube, Checkmarx with configuration examples.","domain":"devsecops","appliesTo":["Dev"],"enabled":true}'
echo "Rule 8 created"

# Rule 9: no-hallucination
create_rule '{"name":"no-hallucination","content":"1. Never invent statistics, dates, or specific document references.\n2. If unsure, state \"I don'\''t have specific data on this\" instead of guessing.\n3. Always qualify estimates with \"approximately\" or \"based on available data\".","domain":"general","appliesTo":[],"enabled":true}'
echo "Rule 9 created"

# Rule 10: session-context
create_rule '{"name":"session-context","content":"1. Reference previous conversation context when relevant.\n2. If user asks follow-up, check session summary before answering.\n3. Maintain consistency with previous answers in the same session.","domain":"general","appliesTo":[],"enabled":true}'
echo "Rule 10 created"

# Rule 11: metric-reporting
create_rule '{"name":"metric-reporting","content":"1. When providing metrics, explain what they mean in business terms.\n2. Include confidence scores when available.\n3. Flag low-confidence answers (< 0.6) for human review.","domain":"general","appliesTo":["Gap Analysis","Compliance"],"enabled":true}'
echo "Rule 11 created"

# Rule 12: language-tone
create_rule '{"name":"language-tone","content":"1. Use professional, clear language suitable for business stakeholders.\n2. Avoid excessive jargon unless user is technical (IT/Dev agents).\n3. Use bullet points and numbered lists for readability.","domain":"general","appliesTo":[],"enabled":true}'
echo "Rule 12 created"

echo "All 12 rules created successfully!"
