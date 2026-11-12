import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import api, { errMsg, useAction, useFetch } from '../api'
import { FormCard, FormFooter, FormSection, InfoStrip, RequiredNote, SelectField, TextAreaField, TextField } from '../components/form'
import Icon from '../components/Icon'
import { Alert, Badge, Button, ButtonLink, Card, EmptyState, Loader, PageHeader, useToast } from '../components/ui'
import { CAMPAIGN_STATUS, today } from '../format'

const EMPTY = { name: '', product_id: '', start_date: '', end_date: '', description: '' }

const statusFor = (start, end) => (today() < start ? 'upcoming' : today() > end ? 'ended' : 'active')
const daysBetween = (start, end) => Math.round((new Date(`${end}T00:00:00`) - new Date(`${start}T00:00:00`)) / 86400000) + 1

export default function CampaignEdit() {
  const { id } = useParams()
  const isEdit = !!id
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { data: products } = useFetch('/products')
  const [form, setForm] = useState(isEdit ? null : { ...EMPTY, start_date: today(), product_id: params.get('product_id') || '' })
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    if (!isEdit) return
    api.get(`/campaigns/${id}`)
      .then(({ data: c }) => setForm({ name: c.name, product_id: String(c.product_id), start_date: c.start_date, end_date: c.end_date, description: c.description || '' }))
      .catch((e) => setLoadError(errMsg(e)))
  }, [id, isEdit])

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  // next: 'list' returns to campaigns, 'qr' continues to step 3 with this campaign selected
  const save = useAction(async (next) => {
    const res = isEdit ? await api.put(`/campaigns/${id}`, form) : await api.post('/campaigns', form)
    toast(isEdit ? 'Campaign updated' : 'Campaign created')
    navigate(next === 'qr' ? `/qr-generation/new?campaign_id=${res.data.id}` : '/campaigns')
  })

  const header = <PageHeader title={isEdit ? 'Edit campaign' : 'Add campaign'} crumbs={[{ label: 'Campaigns', to: '/campaigns' }]}
    subtitle="A campaign runs for one product. You'll generate its QR codes in the next step." />
  if (loadError) return <>{header}<Alert>{loadError}</Alert></>
  if (!form || !products) return <>{header}<Loader /></>
  if (!products.length) {
    return <>{header}<Card><EmptyState icon="box" title="Create a product first" text="Every campaign belongs to a product."
      action={<ButtonLink to="/products/new" icon="plus">Add product</ButtonLink>} /></Card></>
  }

  const datesSet = form.start_date && form.end_date
  const dateError = datesSet && form.end_date < form.start_date ? 'End date must be on or after the start date' : ''
  const canSave = form.name.trim() && form.product_id && datesSet && !dateError
  const status = datesSet && !dateError && CAMPAIGN_STATUS[statusFor(form.start_date, form.end_date)]

  return (
    <>
      {header}
      <FormCard error={save.error} onSubmit={() => save.run('list')}
        footer={
          <FormFooter status={<RequiredNote />} cancelTo="/campaigns">
            {!isEdit && (
              <Button variant="soft" loading={save.loading} disabled={!canSave} onClick={() => save.run('qr')}>
                Save &amp; generate QR <Icon name="arrowRight" size={16} />
              </Button>
            )}
            <Button type="submit" icon="check" loading={save.loading} disabled={!canSave}>
              {isEdit ? 'Save changes' : 'Save campaign'}
            </Button>
          </FormFooter>
        }>
        <FormSection title="Campaign information" description="Give the campaign a name and choose the product it's for.">
          <TextField label="Campaign name" required autoFocus maxLength={120} showCount
            placeholder="e.g. Diwali Cashback 2026" value={form.name} onChange={set('name')} />
          <SelectField label="Product" required placeholder="Select a product" value={form.product_id} onChange={set('product_id')}
            options={products.map((p) => ({ value: String(p.id), label: p.sku ? `${p.name} (${p.sku})` : p.name }))}
            hint={<>Not listed? <Link to="/products/new">Add a new product</Link></>} />
        </FormSection>

        <FormSection title="Schedule" description="When the campaign starts and ends.">
          <div className="form-grid">
            <TextField type="date" label="Start date" required value={form.start_date} onChange={set('start_date')} />
            <TextField type="date" label="End date" required min={form.start_date || undefined}
              value={form.end_date} onChange={set('end_date')} error={dateError} />
          </div>
          {status && (
            <InfoStrip>
              <Icon name="calendar" size={16} />
              <span>Runs for <b className="text-body">{daysBetween(form.start_date, form.end_date)} days</b></span>
              <Badge tone={status.tone} dot className="push">{status.label}</Badge>
            </InfoStrip>
          )}
        </FormSection>

        <FormSection title="Description" description="An internal note about what this campaign is for.">
          <TextAreaField label="About this campaign" optional maxLength={500} showCount
            placeholder="e.g. Festive cashback on every pack sold in November."
            value={form.description} onChange={set('description')} />
        </FormSection>
      </FormCard>
    </>
  )
}
