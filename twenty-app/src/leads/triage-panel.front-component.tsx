import { useCallback, useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import { RestApiClient } from 'twenty-client-sdk/rest';
import { defineFrontComponent, PageLayoutType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';
import { enqueueSnackbar, useSelectedRecordIds } from 'twenty-sdk/front-component';

import { TRIAGE_PANEL_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from '../constants/universal-identifiers';
import { TRIAGE_VERDICTS } from '../lead-record.ts';
import { FULL_SCOPES, floorRate, isBeforeEngaged, TRIAGE_CHECKS, type TriageCheck, type TriageOpportunity } from './triage';

// The triage panel on a lead: the five checks as yes/no, the Brand's floor rate for
// the lead's Type, and the verdict with its pass reason, saved together by the
// triage route. It also starts a full scope. Every rule is in the routes.

type Answers = Partial<Record<TriageCheck, boolean>>;

const field: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 };
const row: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: 13 };
const control: CSSProperties = { font: 'inherit', color: 'inherit', background: 'transparent', padding: '6px 8px', border: '1px solid currentColor', borderRadius: 4, opacity: 0.9 };
const hint: CSSProperties = { fontSize: 12, opacity: 0.7 };

const answersFrom = (o: TriageOpportunity): Answers =>
  o.triageVerdict ? Object.fromEntries(TRIAGE_CHECKS.map((c) => [c.value, (o.triageChecks ?? []).includes(c.value)])) : {};

const TriagePanel = () => {
  const recordId = useSelectedRecordIds()[0] ?? null;
  const [lead, setLead] = useState<TriageOpportunity | null>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [verdict, setVerdict] = useState('');
  const [passReason, setPassReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!recordId) return;
    try {
      const res = await new RestApiClient().get<{ data?: { opportunity?: TriageOpportunity } }>(`/rest/opportunities/${recordId}`, { query: { depth: 1 } });
      const o = res.data?.opportunity;
      if (!o) throw new Error('no record');
      setLead(o);
      setAnswers(answersFrom(o));
      setVerdict(o.triageVerdict ?? '');
      setPassReason(o.passReason ?? '');
    } catch {
      setFailure('Could not load this lead.');
    }
  }, [recordId]);

  useEffect(() => {
    void load();
  }, [load]);

  const answer = (check: TriageCheck, yes: boolean) => {
    const next = { ...answers, [check]: yes };
    setAnswers(next);
    // A no to any one check is normally a pass, so offer it; the person still decides.
    if (!yes && !verdict) setVerdict('PASS');
  };

  const post = async <T,>(path: string, body: Record<string, unknown>): Promise<T | null> => {
    setBusy(true);
    setFailure(null);
    try {
      return await new RestApiClient().post<T>(path, body);
    } catch {
      setFailure('Not saved. Try again.');
      return null;
    } finally {
      setBusy(false);
    }
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!lead) return;
    const result = await post<{ status: string; errors?: string[] }>('/s/leads/triage', { opportunityId: lead.id, checks: answers, verdict, passReason });
    if (result?.status === 'triaged') {
      await enqueueSnackbar({ message: 'Triage saved', variant: 'success' });
      await load();
    } else if (result?.errors) setFailure(`${result.errors.join('. ')}.`);
  };

  const scope = async () => {
    if (!lead) return;
    const result = await post<{ status: string }>('/s/leads/scope', { opportunityId: lead.id });
    if (result) await load();
  };

  if (!recordId) return <div style={{ padding: 16, fontSize: 13 }}>Open a lead to triage it.</div>;
  if (!lead) return <div style={{ padding: 16, fontSize: 13 }}>{failure ?? 'Loading…'}</div>;

  const floor = floorRate(lead);
  const answered = TRIAGE_CHECKS.every((c) => typeof answers[c.value] === 'boolean');
  const ready = answered && !!verdict && (verdict !== 'PASS' || !!passReason.trim());
  const scoped = FULL_SCOPES.find((s) => s.value === lead.fullScope);

  return (
    <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16 }}>
      <div style={field}>
        Floor rate
        <strong>{'rate' in floor ? floor.rate : floor.missing}</strong>
      </div>
      {TRIAGE_CHECKS.map((c) => (
        <div key={c.value} style={row}>
          <span>
            {c.label}
            <br />
            <span style={hint}>{c.question}</span>
          </span>
          <span style={{ display: 'flex', gap: 8 }}>
            {[true, false].map((yes) => (
              <label key={String(yes)}>
                <input type="radio" name={`check-${c.value}`} checked={answers[c.value] === yes} onChange={() => answer(c.value, yes)} />{' '}
                {yes ? 'Yes' : 'No'}
              </label>
            ))}
          </span>
        </div>
      ))}
      <label style={field}>
        Verdict
        <select style={control} value={verdict} onChange={(e) => setVerdict(e.target.value)}>
          <option value="">Choose a verdict</option>
          {TRIAGE_VERDICTS.map((v) => (
            <option key={v.value} value={v.value}>{v.label}</option>
          ))}
        </select>
      </label>
      {verdict === 'PASS' && (
        <label style={field}>
          Pass reason
          <textarea style={control} rows={2} value={passReason} onChange={(e) => setPassReason(e.target.value)} />
        </label>
      )}
      <button style={control} type="submit" disabled={busy || !ready}>
        {busy ? 'Saving…' : 'Save triage'}
      </button>
      <div style={row}>
        <span>
          Full scope: {scoped ? scoped.label : 'not started'}
          {!scoped && isBeforeEngaged(lead.stage) && (
            <>
              <br />
              <span style={hint}>Allowed, but this lead is not Engaged yet, so the scope is marked cold.</span>
            </>
          )}
        </span>
        {!scoped && (
          <button style={control} type="button" disabled={busy} onClick={scope}>
            Start full scope
          </button>
        )}
      </div>
      {failure && <div role="alert" style={{ fontSize: 13 }}>{failure}</div>}
    </form>
  );
};

export default defineFrontComponent({
  universalIdentifier: TRIAGE_PANEL_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'triage-panel',
  description: "Triages a lead: the five checks, the Brand's floor rate for its Type, and the verdict with its pass reason in one save.",
  component: TriagePanel,
  widgetAvailability: {
    pageLayoutType: PageLayoutType.RECORD_PAGE,
    objectUniversalIdentifiers: [STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.opportunity.universalIdentifier],
  },
});
