import { useEffect, useState } from 'react'
import { Link, useNavigate, useOutletContext, useSearchParams } from 'react-router-dom'
import api, { useAction, useFetch } from '../api'
import { ChoiceCards, FormCard, FormFooter, FormSection, InfoStrip, SelectField, TextField } from '../components/form'
import Icon from '../components/Icon'
import { Badge, Button, ButtonLink, Card, EmptyState, IconButton, Loader, PageHeader, useToast } from '../components/ui'
import { batchLabel, fmtMoney, fmtNum, PROGRAMS } from '../format'

const NEW_TIER = { count: '', amount: '' }
const PROGRAM_OPTIONS = Object.entries(PROGRAMS).map(([value, p]) => ({ value, ...p }))

// Rows of "N codes × ₹amount" with add / remove
function TierEditor({ tiers, setTiers, remaining }) {
  const setTier = (i, key) => (e) => setTiers((ts) => ts.map((t, j) => (j === i ? { ...t, [key]: e.target.value } : t)))
  return (
    <div className="stack">
      <div className="tiers">
        {tiers.map((t, i) => (
          <div className="tier" key={i}>
            <span className="tier-index">#{i + 1}</span>
            <TextField type="number" label={i === 0 ? 'QR codes' : undefined} min="1" step="1" required
              placeholder="5" value={t.count} onChange={setTier(i, 'count')} />
            <TextField type="number" label={i === 0 ? 'Cashback per code' : undefined} min="0.01" step="0.01" required
              prefix="₹" placeholder="5" value={t.amount} onChange={setTier(i, 'amount')} />
            <IconButton icon="trash" label="Remove tier" danger disabled={tiers.length === 1}
              onClick={() => setTiers((ts) => ts.filter((_, j) => j !== i))} />
          </div>
        ))}
      </div>
      <div>
        <Button variant="secondary" size="sm" icon="plus"
          onClick={() => setTiers((ts) => [...ts, { ...NEW_TIER, count: remaining > 0 ? String(remaining) : '' }])}>
          Add tier
        </Button>
      </div>
    </div>
  )
}

// One required input per verification field turned on in Settings
function VerificationFields({ fields, values, setValues }) {
  return (
    <div className="form-grid">
      {fields.map((f) => (
        <TextField key={f.key} label={f.label} required type={f.type} min={f.type === 'number' ? '0' : undefined}
          step={f.type === 'number' ? 'any' : undefined} maxLength={f.type === 'text' ? 200 : undefined}
          value={values[f.key] || ''} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))} />
      ))}
    </div>
  )
}

export default function AssignNew() {
  const { data: campaigns } = useFetch('/campaigns')
  const { data: batches, reload: reloadBatches } = useFetch('/batches')
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { settings } = useOutletContext()

  const [campaignId, setCampaignId] = useState('')
  const [batchId, setBatchId] = useState('')
  const [qrCount, setQrCount] = useState('')
  const [program, setProgram] = useState('verification')
  const [tiers, setTiers] = useState([{ ...NEW_TIER }])
  const [details, setDetails] = useState({})

  // Preselect from ?batch_id= ("Assign" on the QR generation page)
  const preset = params.get('batch_id')
  useEffect(() => {
    const b = preset && batches?.find((x) => String(x.id) === preset)
    if (b) { setCampaignId(String(b.campaign_id)); setBatchId(preset) }
  }, [preset, batches])

  const campaignBatches = batches?.filter((b) => String(b.campaign_id) === campaignId) || []
  const batch = campaignBatches.find((b) => String(b.id) === batchId)
  const available = batch?.unassigned_count ?? 0
  const count = Number(qrCount)
  const hasCashback = program === 'cashback' || program === 'both'
  const hasVerification = program === 'verification' || program === 'both'
  const verifyFields = settings?.verification_fields.filter((f) => f.enabled) || []
  const missingDetail = hasVerification && verifyFields.find((f) => !String(details[f.key] || '').trim())

  const tierTotal = tiers.reduce((s, t) => s + (Number(t.count) || 0), 0)
  const cashbackTotal = tiers.reduce((s, t) => s + (Number(t.count) || 0) * (Number(t.amount) || 0), 0)
  const tiersValid = tiers.every((t) => Number.isInteger(Number(t.count)) && Number(t.count) >= 1 && Number(t.amount) > 0)
  const countValid = Number.isInteger(count) && count >= 1 && count <= available
  const totalsMatch = tierTotal === count

  // First thing still missing, shown in the action bar
  const problem = !batch ? 'Select a QR batch'
    : !countValid ? `Enter how many codes to assign (1–${fmtNum(available)})`
    : hasCashback && !tiersValid ? 'Fill in every cashback tier'
    : hasCashback && !totalsMatch ? `Cashback tiers add up to ${fmtNum(tierTotal)}, but you are assigning ${fmtNum(count)}`
    : missingDetail ? `Enter the ${missingDetail.label.toLowerCase()}`
    : ''

  // next: 'list' returns to history, 'more' stays here to assign the remaining codes
  const assign = useAction(async (next) => {
    await api.post('/assignments', {
      batch_id: batchId,
      program,
      qr_count: count,
      tiers: hasCashback ? tiers.map((t) => ({ count: Number(t.count), amount: Number(t.amount) })) : [],
      verification_details: hasVerification ? details : {},
    })
    toast(`${fmtNum(count)} QR codes assigned to ${PROGRAMS[program].label}`)
    if (next === 'list') return navigate('/assign')
    setQrCount('')
    setTiers([{ ...NEW_TIER }])
    reloadBatches()
  })

  const header = <PageHeader title="Assign program" crumbs={[{ label: 'Assign Program', to: '/assign' }]}
    subtitle="The next unassigned codes are picked in serial order. Cashback amounts are shuffled across them, so nobody can tell which code carries which reward." />
  if (!batches || !campaigns || !settings) return <>{header}<Loader /></>
  if (!batches.length) {
    return <>{header}<Card><EmptyState icon="qr" title="Generate QR codes first" text="Programs are assigned to codes inside a QR batch."
      action={<ButtonLink to="/qr-generation/new" icon="qr">Generate QR codes</ButtonLink>} /></Card></>
  }

  const campaignOptions = campaigns.filter((c) => batches.some((b) => b.campaign_id === c.id))
    .map((c) => ({ value: String(c.id), label: c.name }))
  const batchOptions = campaignBatches.map((b) => ({
    value: String(b.id), label: `${batchLabel(b)} — ${fmtNum(b.unassigned_count)} available`, disabled: !b.unassigned_count,
  }))
  const status = problem
    ? <span className={batch ? 'text-danger' : ''}>{problem}</span>
    : <>
      <Icon name="checkCircle" size={16} className="text-success" />
      <span className="text-body"><b>{fmtNum(count)}</b> codes · {PROGRAMS[program].label}{hasCashback && <> · <b>{fmtMoney(cashbackTotal)}</b> cashback</>}</span>
    </>

  return (
    <>
      {header}
      <FormCard error={assign.error} onSubmit={() => assign.run('list')}
        footer={
          <FormFooter status={status} cancelTo="/assign">
            <Button variant="soft" loading={assign.loading} disabled={!!problem} onClick={() => assign.run('more')}>
              Assign &amp; add another
            </Button>
            <Button type="submit" icon="assign" loading={assign.loading} disabled={!!problem}>Assign program</Button>
          </FormFooter>
        }>
        <FormSection title="QR batch" description="Pick the batch whose codes you want to activate.">
          <div className="form-grid">
            <SelectField label="Campaign" required placeholder="Select a campaign" options={campaignOptions}
              value={campaignId} onChange={(e) => { setCampaignId(e.target.value); setBatchId('') }} />
            <SelectField label="Batch" required placeholder="Select a batch" options={batchOptions}
              value={batchId} onChange={(e) => setBatchId(e.target.value)} disabled={!campaignId}
              hint={batch && `${fmtNum(available)} of ${fmtNum(batch.quantity)} codes still unassigned`} />
          </div>
        </FormSection>

        <FormSection title="Quantity" description="How many of the unassigned codes to activate with this program.">
          <TextField type="number" label="Number of QR codes" required min="1" max={available || undefined} step="1"
            placeholder="e.g. 10" value={qrCount} onChange={(e) => setQrCount(e.target.value)} disabled={!batch}
            error={qrCount && !countValid ? `Enter a whole number from 1 to ${fmtNum(available)}` : ''}
            hint={batch ? `Maximum ${fmtNum(available)}` : 'Select a batch first'} />
        </FormSection>

        <FormSection title="Program" description="What happens when a customer scans one of these codes.">
          <ChoiceCards options={PROGRAM_OPTIONS} value={program} onChange={setProgram} />
        </FormSection>

        {hasVerification && (
          <FormSection title="Verification details"
            description="Customers see these after scanning, so they can check them against what's printed on the pack.">
            <VerificationFields fields={verifyFields} values={details} setValues={setDetails} />
            <span className="field-hint">Choose which details are asked for in <Link to="/settings">Settings</Link>.</span>
          </FormSection>
        )}

        {hasCashback && (
          <FormSection title="Cashback tiers"
            description="Split the codes into reward amounts, e.g. 5 × ₹5, 3 × ₹7, 2 × ₹10. The tier total must equal the number of QR codes.">
            <TierEditor tiers={tiers} setTiers={setTiers} remaining={count - tierTotal} />
            <InfoStrip tone={count ? (totalsMatch ? 'ok' : 'bad') : undefined}>
              <span>Tier total</span>
              <Badge tone={count && totalsMatch ? 'green' : 'red'}>{fmtNum(tierTotal)} / {fmtNum(count)} codes</Badge>
              <span className="push">Total cashback <b className="text-body">{fmtMoney(cashbackTotal)}</b></span>
            </InfoStrip>
          </FormSection>
        )}
      </FormCard>
    </>
  )
}
