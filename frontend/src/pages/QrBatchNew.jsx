import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api, { useAction, useFetch } from '../api'
import { FormCard, FormFooter, FormSection, RequiredNote, SelectField, TextField } from '../components/form'
import Icon from '../components/Icon'
import { Button, ButtonLink, Card, EmptyState, Loader, PageHeader, useToast } from '../components/ui'
import { fmtDate, fmtNum, today } from '../format'

const MAX_BATCH = 10000
const EMPTY = { campaign_id: '', name: '', quantity: '', activation_date: '', expiry_date: '' }

// Suggest dates from the campaign for any date not filled in yet; QR validity itself is independent of the campaign
function defaultDates(c, f) {
  const activation = f.activation_date || (c.start_date > today() ? c.start_date : today())
  const expiry = f.expiry_date || (c.end_date >= activation ? c.end_date : '')
  return { activation_date: activation, expiry_date: expiry }
}

export default function QrBatchNew() {
  const { data: campaigns } = useFetch('/campaigns')
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const toast = useToast()
  const [form, setForm] = useState(EMPTY)

  const findCampaign = (id) => campaigns?.find((c) => String(c.id) === String(id))
  const campaign = findCampaign(form.campaign_id)
  const selectCampaign = (id) => {
    const c = findCampaign(id)
    setForm((f) => ({ ...f, campaign_id: id, ...(c && defaultDates(c, f)) }))
  }

  // Preselect from ?campaign_id=
  const preset = params.get('campaign_id')
  useEffect(() => {
    const c = preset && campaigns?.find((x) => String(x.id) === preset)
    if (c) setForm((f) => ({ ...f, campaign_id: preset, ...defaultDates(c, f) }))
  }, [preset, campaigns])

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))
  const qty = Number(form.quantity)
  const errors = {
    quantity: form.quantity && !(Number.isInteger(qty) && qty >= 1 && qty <= MAX_BATCH) ? `Enter a whole number from 1 to ${fmtNum(MAX_BATCH)}` : '',
    expiry_date: form.expiry_date && form.activation_date && form.expiry_date < form.activation_date ? 'Must be on or after the activation date' : '',
  }
  const canSave = campaign && qty && form.activation_date && form.expiry_date && !Object.values(errors).some(Boolean)

  // next: 'list' returns to batches, 'assign' continues to step 4 with this batch selected
  const generate = useAction(async (next) => {
    const res = await api.post('/batches', form)
    toast(`${fmtNum(qty)} QR codes generated`)
    navigate(next === 'assign' ? `/assign/new?batch_id=${res.data.id}` : `/qr-generation?generated=${res.data.id}`)
  })

  const header = <PageHeader title="Generate QR codes" crumbs={[{ label: 'QR Generation', to: '/qr-generation' }]}
    subtitle="Generate a set of unique, unguessable QR codes for a campaign." />
  if (!campaigns) return <>{header}<Loader /></>
  if (!campaigns.length) {
    return <>{header}<Card><EmptyState icon="campaign" title="Create a campaign first" text="QR codes are generated for a campaign."
      action={<ButtonLink to="/campaigns/new" icon="plus">Add campaign</ButtonLink>} /></Card></>
  }

  return (
    <>
      {header}
      <FormCard error={generate.error} onSubmit={() => generate.run('list')}
        footer={
          <FormFooter status={canSave ? <span>Ready to generate <b className="text-body">{fmtNum(qty)}</b> QR codes</span> : <RequiredNote />}
            cancelTo="/qr-generation">
            <Button variant="soft" loading={generate.loading} disabled={!canSave} onClick={() => generate.run('assign')}>
              Generate &amp; assign program <Icon name="arrowRight" size={16} />
            </Button>
            <Button type="submit" icon="qr" loading={generate.loading} disabled={!canSave}>Generate QR codes</Button>
          </FormFooter>
        }>
        <FormSection title="Campaign" description="The campaign these QR codes belong to.">
          <SelectField label="Campaign" required placeholder="Select a campaign" value={form.campaign_id}
            onChange={(e) => selectCampaign(e.target.value)}
            options={campaigns.map((c) => ({ value: String(c.id), label: `${c.name} — ${c.product_name}` }))}
            hint={campaign && `Runs ${fmtDate(campaign.start_date)} – ${fmtDate(campaign.end_date)}`} />
        </FormSection>

        <FormSection title="Batch details" description="How many codes to create. Every code is unique and can't be guessed.">
          <div className="form-grid">
            <TextField type="number" label="Number of QR codes" required min="1" max={MAX_BATCH} step="1"
              placeholder="e.g. 10" value={form.quantity} onChange={set('quantity')} error={errors.quantity}
              hint={`Up to ${fmtNum(MAX_BATCH)} per batch`} />
            <TextField label="Batch name" optional maxLength={80}
              placeholder="e.g. Mumbai stores – Nov" value={form.name} onChange={set('name')} />
          </div>
        </FormSection>

        <FormSection title="Validity" description="Codes can only be scanned between these dates. They can stay valid after the campaign ends.">
          <div className="form-grid">
            <TextField type="date" label="Activation date" required value={form.activation_date} onChange={set('activation_date')} />
            <TextField type="date" label="Expiry date" required min={form.activation_date || undefined} value={form.expiry_date}
              onChange={set('expiry_date')} error={errors.expiry_date} />
          </div>
        </FormSection>
      </FormCard>
    </>
  )
}
