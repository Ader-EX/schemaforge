import { GenCase } from './generate';

const shq = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;

export function toCurl(cases: { label: string; payload: any }[], url: string): string {
  return cases
    .map((c) => `# ${c.label}\ncurl -X POST ${shq(url)} \\\n  -H 'Content-Type: application/json' \\\n  -d ${shq(JSON.stringify(c.payload))}`)
    .join('\n\n');
}

export function toPostman(name: string, cases: { label: string; payload: any }[], url: string) {
  return {
    info: { name, schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' },
    variable: [{ key: 'gatewayUrl', value: url }],
    item: cases.map((c) => ({
      name: c.label,
      request: {
        method: 'POST',
        header: [{ key: 'Content-Type', value: 'application/json' }],
        body: { mode: 'raw', raw: JSON.stringify(c.payload, null, 2), options: { raw: { language: 'json' } } },
        url: { raw: '{{gatewayUrl}}', host: ['{{gatewayUrl}}'] },
      },
    })),
  };
}

export type { GenCase };
