import { describe, expect, it } from 'vitest';
import {
  buildNvdQuery,
  extractCpes,
  mapKevEntry,
  mapNvdCve,
  nvdDelayMs,
  parseCpe,
  pickCvss,
  scoreToSeverity,
  splitDateWindows,
  toNvdDate,
  normalizeSeverity,
} from '../src/services/cve/mappers';
import {
  compareVersions,
  matchClient,
  matchRecord,
  nameSimilarity,
  normalizeToken,
  versionSatisfies,
} from '../src/services/cve/matcher';

const nvdItem = {
  id: 'CVE-2026-12345',
  published: '2026-02-01T10:00:00.000',
  lastModified: '2026-02-02T10:00:00.000',
  vulnStatus: 'Analyzed',
  descriptions: [
    { lang: 'en', value: 'A remote code execution issue in Example Server.' },
    { lang: 'es', value: 'Un problema de ejecución remota de código.' },
  ],
  metrics: {
    cvssMetricV31: [
      {
        cvssData: {
          version: '3.1',
          vectorString: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H',
          baseScore: 9.8,
          baseSeverity: 'CRITICAL',
        },
      },
    ],
    cvssMetricV2: [{ cvssData: { version: '2.0', baseScore: 7.5 }, baseSeverity: 'HIGH' }],
  },
  weaknesses: [{ description: [{ lang: 'en', value: 'CWE-78' }] }],
  configurations: [
    {
      nodes: [
        {
          cpeMatch: [
            {
              vulnerable: true,
              criteria: 'cpe:2.3:a:example:example_server:2.0:*:*:*:*:*:*:*',
              versionStartIncluding: '1.0',
              versionEndExcluding: '2.4',
            },
            {
              vulnerable: false,
              criteria: 'cpe:2.3:o:example:example_os:1.0:*:*:*:*:*:*:*',
            },
          ],
        },
      ],
    },
  ],
  references: [{ url: 'https://example.com/advisory' }, { url: 'https://example.com/advisory' }],
};

describe('CVE mappers', () => {
  it('normalizes NVD severities including NONE', () => {
    expect(normalizeSeverity('NONE')).toBe('info');
    expect(normalizeSeverity('critical')).toBe('critical');
    expect(normalizeSeverity('unexpected', 'low')).toBe('low');
    expect(normalizeSeverity(undefined)).toBe('medium');
  });

  it('maps a CVSS score to a severity band', () => {
    expect(scoreToSeverity(9.8)).toBe('critical');
    expect(scoreToSeverity(7.1)).toBe('high');
    expect(scoreToSeverity(5)).toBe('medium');
    expect(scoreToSeverity(0.1)).toBe('low');
    expect(scoreToSeverity(0)).toBe('info');
  });

  it('prefers CVSS v3.1 over v2 metrics', () => {
    const cvss = pickCvss(nvdItem.metrics);
    expect(cvss.score).toBe(9.8);
    expect(cvss.severity).toBe('critical');
    expect(cvss.version).toBe('3.1');
  });

  it('parses CPE 2.3 and CPE 2.2 strings', () => {
    expect(parseCpe('cpe:2.3:a:microsoftexchange:exchange_server:2019:*:*:*:*:*:*:*')).toMatchObject({
      vendor: 'microsoftexchange',
      product: 'exchange server',
      version: '2019',
    });
    expect(parseCpe('cpe:/a:apache:log4j:2.14.1')).toMatchObject({
      vendor: 'apache',
      product: 'log4j',
      version: '2.14.1',
    });
    expect(parseCpe('not-a-cpe')).toBeNull();
  });

  it('extracts only vulnerable CPE matches and deduplicates them', () => {
    const cpes = extractCpes(nvdItem.configurations);
    expect(cpes).toHaveLength(1);
    expect(cpes[0]).toMatchObject({
      vendor: 'example',
      product: 'example server',
      version: '2.0',
      versionStartIncluding: '1.0',
      versionEndExcluding: '2.4',
    });
  });

  it('maps an NVD item to the catalog shape', () => {
    const mapped = mapNvdCve(nvdItem)!;
    expect(mapped.cveId).toBe('CVE-2026-12345');
    expect(mapped.severity).toBe('critical');
    expect(mapped.cvssScore).toBe(9.8);
    expect(mapped.cwe).toEqual(['CWE-78']);
    expect(mapped.references).toEqual(['https://example.com/advisory']);
    expect(mapped.summaryEs).toContain('ejecución');
    expect(mapped.vendors).toContain('Example');
    expect(mapped.products).toContain('Example Server');
    expect(mapped.title).toBe('Example Server');
    expect(mapped.publishedAt?.toISOString()).toBe('2026-02-01T10:00:00.000Z');
    expect(mapped.sourceUrl).toBe('https://nvd.nist.gov/vuln/detail/CVE-2026-12345');
  });

  it('unwraps the NVD API 2.0 `{ cve }` envelope', () => {
    // The real endpoint returns `vulnerabilities: [{ cve: { ... } }]`.
    const wrapped = mapNvdCve({ cve: nvdItem })!;
    const flat = mapNvdCve(nvdItem)!;
    expect(wrapped).toEqual(flat);
  });

  it('skips rejected and malformed CVEs', () => {
    expect(mapNvdCve({ ...nvdItem, vulnStatus: 'Rejected' })).toBeNull();
    expect(mapNvdCve({ ...nvdItem, id: 'not-a-cve' })).toBeNull();
    expect(mapNvdCve({ ...nvdItem, vulnStatus: 'Rejected' }, { ingestRejected: true })).not.toBeNull();
  });

  it('uses NVD KEV fields when present', () => {
    const mapped = mapNvdCve({
      ...nvdItem,
      cisaExploitAdd: '2026-02-03',
      cisaActionDue: '2026-03-03',
      cisaRequiredAction: 'Apply the vendor update.',
      cisaVulnerabilityName: 'Example RCE',
    })!;
    expect(mapped.kev).toMatchObject({
      listed: true,
      requiredAction: 'Apply the vendor update.',
      vulnerabilityName: 'Example RCE',
    });
    expect(mapped.title).toBe('Example RCE');
  });

  it('maps a CISA KEV entry', () => {
    const mapped = mapKevEntry({
      cveID: 'CVE-2026-0001',
      vendorProject: 'Example',
      product: 'Gateway',
      name: 'Example Gateway Authentication Bypass',
      dateAdded: '2026-01-10',
      shortDescription: 'Authentication bypass.',
      requiredAction: 'Apply updates.',
      dueDate: '2026-01-31',
      knownRansomwareCampaignUse: 'Known',
    })!;
    expect(mapped.cveId).toBe('CVE-2026-0001');
    expect(mapped.vendors).toEqual(['Example']);
    expect(mapped.products).toContain('Example Gateway');
    expect(mapped.kev.listed).toBe(true);
    expect(mapped.kev.knownRansomwareCampaignUse).toBe('Known');
    expect(mapKevEntry({ cveID: 'bad' })).toBeNull();
  });
});

describe('NVD query helpers', () => {
  it('splits ranges into windows of at most 120 days', () => {
    const windows = splitDateWindows(new Date('2026-01-01T00:00:00Z'), new Date('2026-10-30T00:00:00Z'));
    expect(windows).toHaveLength(3);
    expect(windows[0].start.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(windows[windows.length - 1].end.toISOString()).toBe('2026-10-30T00:00:00.000Z');
    for (const window of windows) {
      const days = (window.end.getTime() - window.start.getTime()) / 86_400_000;
      expect(days).toBeLessThanOrEqual(120);
    }
  });

  it('builds lastMod and published queries', () => {
    const from = new Date('2026-01-01T00:00:00Z');
    const to = new Date('2026-01-02T00:00:00Z');
    expect(buildNvdQuery({ from, to, startIndex: 0 })).toContain('lastModStartDate=2026-01-01T00%3A00%3A00.000Z');
    expect(buildNvdQuery({ from, to, usePublishedDates: true })).toContain('pubStartDate=');
    expect(buildNvdQuery({ cveId: 'CVE-2026-1' })).toContain('cveId=CVE-2026-1');
    expect(buildNvdQuery({ from, to, startIndex: 4000, resultsPerPage: 2000 })).toContain('startIndex=4000');
  });

  it('formats NVD dates with an explicit UTC marker', () => {
    expect(toNvdDate(new Date('2026-01-01T00:00:00.123Z'))).toBe('2026-01-01T00:00:00.000Z');
  });

  it('uses the documented rate limits', () => {
    expect(nvdDelayMs(true)).toBeLessThan(nvdDelayMs(false));
  });
});

describe('version ranges', () => {
  it('compares versions numerically', () => {
    expect(compareVersions('1.2.10', '1.2.9')).toBe(1);
    expect(compareVersions('2.0', '2.0.0')).toBe(0);
    expect(compareVersions('2019', '2021')).toBe(-1);
  });

  it('evaluates CPE range operators', () => {
    const range = { versionStartIncluding: '1.0', versionEndExcluding: '2.4' };
    expect(versionSatisfies('1.0', range)).toBe(true);
    expect(versionSatisfies('2.3.9', range)).toBe(true);
    expect(versionSatisfies('2.4', range)).toBe(false);
    expect(versionSatisfies('0.9', range)).toBe(false);
    expect(versionSatisfies('1.0', {})).toBeUndefined();
    expect(versionSatisfies(undefined, range)).toBeUndefined();
  });
});

describe('client matching', () => {
  const client = {
    _id: 'client-1',
    name: 'Acme',
    tags: ['gateway'],
    technologyInventory: [
      { vendor: 'Example', product: 'Example Server', version: '2.2', cpe: 'cpe:2.3:a:example:example_server' },
    ],
  };

  it('normalizes accents and punctuation', () => {
    expect(normalizeToken('Ejecución Remota')).toBe('ejecucion remota');
    expect(nameSimilarity('exchange_server', 'Exchange Server')).toBe(1);
  });

  it('matches by CPE and affected version range', () => {
    const record = {
      vendors: ['Example'],
      products: ['Example Server'],
      cpes: [
        {
          criteria: 'cpe:2.3:a:example:example_server:2.0:*:*:*:*:*:*:*',
          vendor: 'example',
          product: 'example server',
          versionStartIncluding: '1.0',
          versionEndExcluding: '2.4',
        },
      ],
    };
    const match = matchClient(record, client)!;
    expect(match).toBeDefined();
    expect(match.confidence).toBeGreaterThanOrEqual(0.98);
    expect(match.matchedProduct).toBe('example server');
    expect(match.reasons.join(' ')).toContain('within affected range');
  });

  it('rejects versions outside the affected range', () => {
    const record = {
      vendors: ['Example'],
      products: ['Example Server'],
      cpes: [
        {
          criteria: 'cpe:2.3:a:example:example_server:3.0:*:*:*:*:*:*:*',
          vendor: 'example',
          product: 'example server',
          versionStartIncluding: '3.0',
          versionEndExcluding: '3.5',
        },
      ],
    };
    expect(matchClient(record, client)).toBeNull();
  });

  it('falls back to inventory names when there are no CPEs', () => {
    const match = matchClient({ vendors: ['Apache'], products: ['Apache Log4j'] }, {
      _id: 'client-2',
      technologyInventory: [{ vendor: 'Apache', product: 'Log4j' }],
    })!;
    expect(match).toBeDefined();
    expect(match.confidence).toBeGreaterThan(0.5);
  });

  it('matches client tags with lower confidence', () => {
    const match = matchClient({ products: ['Example Gateway'] }, { _id: 'client-3', tags: ['gateway'] })!;
    expect(match).toBeDefined();
    expect(match.confidence).toBeCloseTo(0.5);
  });

  it('does not match generic-only product names', () => {
    expect(
      matchClient({ products: ['Windows Server'] }, {
        _id: 'client-4',
        technologyInventory: [{ vendor: 'Microsoft', product: 'Windows Server' }],
      })
    ).toBeNull();
  });

  it('sorts matches by confidence', () => {
    const matches = matchRecord(
      {
        vendors: ['Example'],
        products: ['Example Server'],
        cpes: [{ criteria: 'cpe:2.3:a:example:example_server:2.0', vendor: 'example', product: 'example server' }],
      },
      [
        { _id: 'low', tags: ['example'] },
        client,
      ]
    );
    expect(matches).toHaveLength(2);
    expect(matches[0].confidence).toBeGreaterThan(matches[1].confidence);
  });
});
