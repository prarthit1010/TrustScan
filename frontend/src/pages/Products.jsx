import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api, { useAction, useFetch } from '../api'
import { CellTitle, TableCard } from '../components/table'
import { ButtonLink, ConfirmDialog, EmptyState, IconButton, PageHeader, useToast } from '../components/ui'
import { fmtDate } from '../format'

export default function Products() {
  const { data: products, error, reload } = useFetch('/products')
  const navigate = useNavigate()
  const toast = useToast()
  const [toDelete, setToDelete] = useState(null)

  const remove = useAction(async () => {
    await api.delete(`/products/${toDelete.id}`)
    toast('Product deleted')
    setToDelete(null)
    reload()
  })

  const addButton = <ButtonLink to="/products/new" icon="plus">Add product</ButtonLink>

  const columns = [
    { key: 'name', header: 'Product', render: (p) => <CellTitle title={p.name} sub={p.description} avatar={p.name.slice(0, 2).toUpperCase()} /> },
    { key: 'sku', header: 'SKU', render: (p) => (p.sku ? <span className="mono">{p.sku}</span> : <span className="subtle">—</span>) },
    { key: 'category', header: 'Category' },
    { key: 'campaign_count', header: 'Campaigns', render: (p) => <span className="num">{p.campaign_count}</span> },
    { key: 'created_at', header: 'Created', render: (p) => <span className="subtle nowrap">{fmtDate(p.created_at)}</span> },
    {
      key: 'actions', header: '', align: 'end', render: (p) => (
        <div className="actions">
          <IconButton icon="edit" label="Edit" onClick={() => navigate(`/products/${p.id}/edit`)} />
          <IconButton icon="trash" label="Delete" danger onClick={() => { remove.setError(''); setToDelete(p) }} />
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader title="Products"
        subtitle="Add the products you want to run campaigns for. Every campaign is linked to one product." actions={addButton} />
      <TableCard columns={columns} rows={products} error={error}
        empty={<EmptyState icon="box" title="No products yet" text="Create your first product to start building a campaign." action={addButton} />} />
      <ConfirmDialog open={!!toDelete} onClose={() => setToDelete(null)} title="Delete product?"
        message={`"${toDelete?.name}" will be permanently removed.`}
        onConfirm={remove.run} loading={remove.loading} error={remove.error} />
    </>
  )
}
