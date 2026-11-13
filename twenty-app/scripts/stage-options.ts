// Plans, and with --apply makes, the Opportunity.stage option change described in
// src/stage/plan-stage-options.ts, through Twenty's metadata REST API.
//
//   TWENTY_API_URL=... TWENTY_API_KEY=... node scripts/stage-options.ts           # dry run: reads only
//   TWENTY_API_URL=... TWENTY_API_KEY=... node scripts/stage-options.ts --apply   # writes
//
// The key is read from the environment and never printed.
import { planStageOptions, type StageOption } from '../src/stage/plan-stage-options.ts';

const apply = process.argv.includes('--apply');
const base = (process.env.TWENTY_API_URL ?? '').replace(/\/+$/, '');
const key = process.env.TWENTY_API_KEY ?? '';
if (!base || !key) {
  console.error('stage-options: set TWENTY_API_URL and TWENTY_API_KEY');
  process.exit(2);
}

async function call(method: string, path: string, body?: unknown): Promise<any> {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : {};
}

const objects = await call('GET', '/rest/metadata/objects');
const list: any[] = objects?.data?.objects ?? objects?.data ?? [];
const opportunity = list.find((o) => o?.nameSingular === 'opportunity');
if (!opportunity?.id) throw new Error('no opportunity object in this workspace');
const full = await call('GET', `/rest/metadata/objects/${opportunity.id}`);
const fields: any[] = full?.data?.object?.fields ?? full?.data?.fields ?? full?.fields ?? [];
const stage = fields.find((f) => f?.name === 'stage');
if (!stage?.id || stage.type !== 'SELECT') throw new Error('opportunity.stage is missing or not a SELECT');

const current: StageOption[] = stage.options ?? [];
const plan = planStageOptions(current);

console.log(`opportunity.stage: ${current.length} options now, ${plan.options.length} after`);
for (const o of plan.options) console.log(`  ${o.position}  ${o.value.padEnd(18)} ${o.label.padEnd(18)} ${o.id ?? '(new id)'}`);
if (plan.changes.length === 0) {
  console.log('no change');
  process.exit(0);
}
for (const c of plan.changes) {
  if (c.kind === 'relabel') console.log(`  relabel ${c.value}: "${c.from}" -> "${c.to}"`);
  if (c.kind === 'move') console.log(`  move    ${c.value}: position ${c.from} -> ${c.to}`);
  if (c.kind === 'add') console.log(`  add     ${c.value} "${c.label}" at position ${c.position}`);
}
if (!apply) {
  console.log('dry run: nothing written (pass --apply to write)');
  process.exit(0);
}
await call('PATCH', `/rest/metadata/fields/${stage.id}`, { options: plan.options });
console.log('applied');
