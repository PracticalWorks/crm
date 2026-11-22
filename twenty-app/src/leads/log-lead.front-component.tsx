import { useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import { RestApiClient, RestApiClientError } from 'twenty-client-sdk/rest';
import { defineFrontComponent } from 'twenty-sdk/define';
import { enqueueSnackbar, openSidePanelPage, SidePanelPages } from 'twenty-sdk/front-component';

import { LOG_LEAD_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from '../constants/universal-identifiers';
import { LEAD_SOURCES, LEAD_TYPES } from '../lead-record.ts';
import type { LoggedOpportunity, LogLeadResult } from './log-lead';

// The form behind "Log a lead": paste the posting link, pick Brand, Source and
// Type, and the log-lead route opens the Opportunity or names the one that
// already has the link. It only collects and shows; every rule is in the route.

type Brand = { id: string; name: string };

const field: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 };
const control: CSSProperties = { font: 'inherit', color: 'inherit', background: 'transparent', padding: '6px 8px', border: '1px solid currentColor', borderRadius: 4, opacity: 0.9 };

const openOpportunity = (o: LoggedOpportunity) =>
  openSidePanelPage({ page: SidePanelPages.ViewRecord, objectNameSingular: 'opportunity', recordId: o.id });

const LogLeadForm = () => {
  const [brands, setBrands] = useState<Brand[] | null>(null);
  const [link, setLink] = useState('');
  const [brandId, setBrandId] = useState('');
  const [source, setSource] = useState<string>(LEAD_SOURCES[0].value);
  const [type, setType] = useState<string>(LEAD_TYPES[0].value);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [refusal, setRefusal] = useState<Extract<LogLeadResult, { status: 'duplicate' | 'invalid' }> | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    new RestApiClient()
      .get<{ data?: { brands?: Brand[] } }>('/rest/brands', { query: { limit: 200 } })
      .then((res) => setBrands((res.data?.brands ?? []).slice().sort((a, b) => a.name.localeCompare(b.name))))
      .catch(() => setFailure('Could not load the brands.'));
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setRefusal(null);
    setFailure(null);
    let result: LogLeadResult;
    try {
      result = await new RestApiClient().post<LogLeadResult>('/s/leads/log', { link, brandId, source, type, name });
    } catch (err) {
      const body = err instanceof RestApiClientError ? (err.body as LogLeadResult | undefined) : undefined;
      if (body?.status === 'duplicate' || body?.status === 'invalid') result = body;
      else {
        setFailure('The lead was not logged. Try again, or log it on the Opportunities page.');
        setSaving(false);
        return;
      }
    }
    setSaving(false);
    if (result.status === 'created') {
      await enqueueSnackbar({ message: `Logged "${result.opportunity.name}"`, variant: 'success' });
      await openOpportunity(result.opportunity);
    } else setRefusal(result);
  };

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16 }}>
      <label style={field}>
        Posting link
        <input style={control} type="url" required value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://" />
      </label>
      <label style={field}>
        Brand
        <select style={control} required value={brandId} onChange={(e) => setBrandId(e.target.value)} disabled={!brands}>
          <option value="">{brands ? 'Choose a brand' : 'Loading brands…'}</option>
          {(brands ?? []).map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </label>
      <label style={field}>
        Source
        <select style={control} value={source} onChange={(e) => setSource(e.target.value)}>
          {LEAD_SOURCES.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </label>
      <label style={field}>
        Type
        <select style={control} value={type} onChange={(e) => setType(e.target.value)}>
          {LEAD_TYPES.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </label>
      <label style={field}>
        Name (optional; defaults to the link)
        <input style={control} value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <button style={control} type="submit" disabled={saving || !link || !brandId}>
        {saving ? 'Logging…' : 'Log lead'}
      </button>
      {refusal?.status === 'duplicate' && (
        <div role="alert" style={{ fontSize: 13 }}>
          {refusal.message}{' '}
          <button style={control} type="button" onClick={() => openOpportunity(refusal.existing)}>
            Open it
          </button>
        </div>
      )}
      {refusal?.status === 'invalid' && (
        <div role="alert" style={{ fontSize: 13 }}>{refusal.errors.join('. ')}.</div>
      )}
      {failure && <div role="alert" style={{ fontSize: 13 }}>{failure}</div>}
    </form>
  );
};

export default defineFrontComponent({
  universalIdentifier: LOG_LEAD_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'log-lead-form',
  description: 'Logs a lead from a posting link: Brand, Source and Type, one Opportunity at New.',
  component: LogLeadForm,
});
