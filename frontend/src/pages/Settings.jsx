import { useEffect, useRef, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import api, { useAction } from '../api'
import { FormCard, FormFooter, FormSection, InfoStrip, SelectField, TextField } from '../components/form'
import Icon from '../components/Icon'
import { Badge, Button, IconButton, Loader, PageHeader, useToast } from '../components/ui'

const MAX_LOGO_BYTES = 200 * 1024
const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
const TYPE_OPTIONS = [
  { value: 'text', label: 'Text' },
  { value: 'date', label: 'Date' },
  { value: 'number', label: 'Number' },
]
const typeLabel = (type) => TYPE_OPTIONS.find((t) => t.value === type)?.label

const readAsDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(reader.result)
  reader.onerror = () => reject(reader.error)
  reader.readAsDataURL(file)
})

export default function Settings() {
  const { settings, reloadSettings } = useOutletContext()
  const toast = useToast()
  const fileInput = useRef(null)
  const [form, setForm] = useState(null)
  const [logoError, setLogoError] = useState('')

  useEffect(() => { if (settings && !form) setForm(settings) }, [settings, form])

  const save = useAction(async () => {
    const res = await api.put('/settings', form)
    setForm(res.data) // picks up the keys the server gave new custom fields
    await reloadSettings()
    toast('Settings saved')
  })

  const header = <PageHeader title="Settings" subtitle="Your app name and logo, and what must be entered when you assign a verification program." />
  if (!form) return <>{header}<Loader /></>

  const fields = form.verification_fields
  const setFields = (fn) => setForm((f) => ({ ...f, verification_fields: fn(f.verification_fields) }))
  const setField = (i, patch) => setFields((fs) => fs.map((x, j) => (j === i ? { ...x, ...patch } : x)))
  const enabledCount = fields.filter((f) => f.enabled).length

  const pickLogo = async (e) => {
    const file = e.target.files[0]
    e.target.value = ''
    if (!file) return
    if (!LOGO_TYPES.includes(file.type)) return setLogoError('Use a PNG, JPG, WebP or SVG image')
    if (file.size > MAX_LOGO_BYTES) return setLogoError('Logo must be under 200 KB')
    setLogoError('')
    const logo = await readAsDataUrl(file)
    setForm((f) => ({ ...f, logo }))
  }

  const problem = !form.app_name.trim() ? 'Enter an app name'
    : !enabledCount ? 'Turn on at least one verification field'
    : fields.some((f) => !f.label.trim()) ? 'Every verification field needs a name'
    : ''

  return (
    <>
      {header}
      <FormCard error={save.error} onSubmit={save.run}
        footer={
          <FormFooter status={problem ? <span className="text-danger">{problem}</span> : <span>Changes apply to new assignments</span>}>
            <Button type="submit" icon="check" loading={save.loading} disabled={!!problem}>Save settings</Button>
          </FormFooter>
        }>
        <FormSection title="Branding" description="Shown in the dashboard sidebar and to customers when they scan your QR codes.">
          <TextField label="App name" required maxLength={40} showCount placeholder="e.g. Acme Verify"
            value={form.app_name} onChange={(e) => setForm((f) => ({ ...f, app_name: e.target.value }))} />
          <div className="field">
            <div className="field-head"><span className="field-label">Logo</span><span className="field-meta">Optional</span></div>
            <div className="logo-row">
              <span className="logo-preview">{form.logo ? <img src={form.logo} alt="Logo preview" /> : <Icon name="shieldCheck" size={24} />}</span>
              <input ref={fileInput} type="file" accept={LOGO_TYPES.join(',')} hidden onChange={pickLogo} />
              <Button variant="secondary" icon="upload" onClick={() => fileInput.current.click()}>
                {form.logo ? 'Change logo' : 'Upload logo'}
              </Button>
              {form.logo && <Button variant="ghost" onClick={() => setForm((f) => ({ ...f, logo: null }))}>Remove</Button>}
            </div>
            {logoError
              ? <span className="field-error"><Icon name="alert" size={13} />{logoError}</span>
              : <span className="field-hint">PNG, JPG, WebP or SVG, under 200 KB. A square image looks best.</span>}
          </div>
        </FormSection>

        <FormSection title="Verification fields"
          description="Turn on the details that must be entered when you assign Verification or Verification + Cashback. Customers see them after scanning, so they can match them with the pack. At least one is required.">
          <div className="vf-list">
            {fields.map((f, i) => (
              <div key={f.key || i} className={`vf-row ${f.enabled ? '' : 'off'}`}>
                <input type="checkbox" className="vf-toggle" checked={f.enabled} aria-label={`Use ${f.label || 'this field'}`}
                  onChange={(e) => setField(i, { enabled: e.target.checked })} />
                <TextField maxLength={60} placeholder="Field name, e.g. Shade code" value={f.label}
                  aria-label="Field name" onChange={(e) => setField(i, { label: e.target.value })} />
                {f.built_in
                  ? <span className="vf-type">{typeLabel(f.type)}</span>
                  : <SelectField options={TYPE_OPTIONS} value={f.type} aria-label="Field type"
                    onChange={(e) => setField(i, { type: e.target.value })} />}
                {f.built_in
                  ? <Badge tone="gray">Built-in</Badge>
                  : <IconButton icon="trash" label="Remove field" danger onClick={() => setFields((fs) => fs.filter((_, j) => j !== i))} />}
              </div>
            ))}
          </div>
          <div>
            <Button variant="secondary" size="sm" icon="plus"
              onClick={() => setFields((fs) => [...fs, { key: '', label: '', type: 'text', enabled: true, built_in: false }])}>
              Add custom field
            </Button>
          </div>
          <InfoStrip tone={enabledCount ? 'ok' : 'bad'}>
            <span>Required at assignment</span>
            <Badge tone={enabledCount ? 'green' : 'red'}>{enabledCount} of {fields.length} fields</Badge>
          </InfoStrip>
        </FormSection>
      </FormCard>
    </>
  )
}
