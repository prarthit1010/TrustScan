import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import api, { errMsg, useAction } from '../api'
import { FormCard, FormFooter, FormSection, RequiredNote, SelectField, TextAreaField, TextField } from '../components/form'
import { Alert, Button, Loader, PageHeader, useToast } from '../components/ui'

const EMPTY = { name: '', sku: '', category: '', description: '', about: '' }
const CATEGORIES = ['Beverages', 'Food & Snacks', 'Personal Care', 'Health & Pharma', 'Electronics', 'Apparel', 'Home Care', 'Auto Parts']
const OTHER = '__other'
const CATEGORY_OPTIONS = [...CATEGORIES.map((c) => ({ value: c, label: c })), { value: OTHER, label: 'Other…' }]

export default function ProductEdit() {
  const { id } = useParams()
  const isEdit = !!id
  const navigate = useNavigate()
  const toast = useToast()
  const [form, setForm] = useState(isEdit ? null : EMPTY)
  const [customCategory, setCustomCategory] = useState(false)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    if (!isEdit) return
    api.get(`/products/${id}`)
      .then(({ data: p }) => {
        setForm({ name: p.name, sku: p.sku || '', category: p.category || '', description: p.description || '', about: p.about || '' })
        setCustomCategory(!!p.category && !CATEGORIES.includes(p.category))
      })
      .catch((e) => setLoadError(errMsg(e)))
  }, [id, isEdit])

  const set = (key, transform = (v) => v) => (e) => setForm((f) => ({ ...f, [key]: transform(e.target.value) }))
  const pickCategory = (e) => {
    const other = e.target.value === OTHER
    setCustomCategory(other)
    setForm((f) => ({ ...f, category: other ? '' : e.target.value }))
  }

  const save = useAction(async () => {
    if (isEdit) await api.put(`/products/${id}`, form)
    else await api.post('/products', form)
    toast(isEdit ? 'Product updated' : 'Product created')
    navigate('/products')
  })

  const header = <PageHeader title={isEdit ? 'Edit product' : 'Add product'} crumbs={[{ label: 'Products', to: '/products' }]}
    subtitle={isEdit ? 'Update the details customers see when they verify this product.' : 'Create a new product and set up the details so customers can verify it with QR scans.'} />
  if (loadError) return <>{header}<Alert>{loadError}</Alert></>
  if (!form) return <>{header}<Loader /></>
  const canSave = form.name.trim().length > 0

  return (
    <>
      {header}
      <FormCard error={save.error} onSubmit={() => save.run()}
        footer={
          <FormFooter status={<RequiredNote />} cancelTo="/products">
            <Button type="submit" icon="check" loading={save.loading} disabled={!canSave}>
              {isEdit ? 'Save changes' : 'Save product'}
            </Button>
          </FormFooter>
        }>
        <FormSection title="Product information" description="The name and code that identify this product.">
          <div className="form-grid-3">
            <TextField label="Product name" required autoFocus maxLength={120} showCount
              placeholder="e.g. Organic Green Tea 250g" value={form.name} onChange={set('name')} />
            <TextField label="SKU" optional maxLength={40} inputClassName="mono" placeholder="e.g. GT-250"
              hint="Your internal product code" value={form.sku} onChange={set('sku', (v) => v.toUpperCase().replace(/\s/g, '-'))} />
            <div className="field-stack">
              <SelectField label="Category" optional placeholder="No category" options={CATEGORY_OPTIONS}
                value={customCategory ? OTHER : form.category} onChange={pickCategory} />
              {customCategory && (
                <TextField maxLength={60} placeholder="Type a category" autoFocus value={form.category} onChange={set('category')} />
              )}
            </div>
          </div>
        </FormSection>

        <FormSection title="Description" description="Shown to customers on the verification page when they scan this product's QR code.">
          <TextAreaField aria-label="Description" maxLength={500} showCount rows={4}
            placeholder="e.g. Premium quality green tea with natural ingredients…"
            value={form.description} onChange={set('description')} />
        </FormSection>

        <FormSection title="About this product" description="Share key details like ingredients, size, origin, etc. to help customers recognise the genuine product.">
          <TextAreaField aria-label="About this product" maxLength={500} showCount rows={4}
            placeholder="e.g. Ingredients: green tea leaves, natural flavour. Size: 250g. Origin: India…"
            value={form.about} onChange={set('about')} />
        </FormSection>
      </FormCard>
    </>
  )
}
