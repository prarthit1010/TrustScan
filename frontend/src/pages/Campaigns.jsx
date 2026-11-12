import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api, { useAction, useFetch } from '../api'
import { CellTitle, TableCard } from '../components/table'
import { Badge, ButtonLink, ConfirmDialog, EmptyState, IconButton, PageHeader, useToast } from '../components/ui'
import { CAMPAIGN_STATUS, fmtDate, fmtNum } from '../format'

export default function Campaigns() {
  const { data: campaigns, error, reload } = useFetch('/campaigns')
  const { data: products } = useFetch('/products')
  const navigate = useNavigate()
  const toast = useToast()
  const [toDelete, setToDelete] = useState(null)

  const remove = useAction(async () => {
    await api.delete(`/campaigns/${toDelete.id}`)
    toast('Campaign deleted')
    setToDelete(null)
    reload()
  })

  const noProducts = products && !products.length
  const addButton = <ButtonLink to="/campaigns/new" icon="plus">Add campaign</ButtonLink>

  const columns = [
    { key: 'name', header: 'Campaign', render: (c) => <CellTitle title={c.name} sub={c.description} /> },
    { key: 'product_name', header: 'Product' },
    { key: 'schedule', header: 'Schedule', render: (c) => <span className="nowrap">{fmtDate(c.start_date)} – {fmtDate(c.end_date)}</span> },
    { key: 'status', header: 'Status', render: (c) => <Badge tone={CAMPAIGN_STATUS[c.status].tone} dot>{CAMPAIGN_STATUS[c.status].label}</Badge> },
    { key: 'batch_count', header: 'Batches' },
    { key: 'qr_count', header: 'QR codes', render: (c) => fmtNum(c.qr_count) },
    {
      key: 'actions', header: '', align: 'end', render: (c) => (
        <div className="actions">
          <IconButton icon="edit" label="Edit" onClick={() => navigate(`/campaigns/${c.id}/edit`)} />
          <IconButton icon="trash" label="Delete" danger onClick={() => { remove.setError(''); setToDelete(c) }} />
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader title="Campaigns"
        subtitle="Set the campaign name, choose the product, and pick when the campaign starts and ends."
        actions={!noProducts && addButton} />
      <TableCard columns={columns} rows={campaigns && products ? campaigns : null} error={error}
        empty={noProducts
          ? <EmptyState icon="box" title="Create a product first" text="Every campaign belongs to a product."
            action={<ButtonLink to="/products/new" icon="plus">Add product</ButtonLink>} />
          : <EmptyState icon="campaign" title="No campaigns yet" text="Create a campaign to start generating QR codes." action={addButton} />} />
      <ConfirmDialog open={!!toDelete} onClose={() => setToDelete(null)} title="Delete campaign?"
        message={`"${toDelete?.name}" will be permanently removed.`}
        onConfirm={remove.run} loading={remove.loading} error={remove.error} />
    </>
  )
}
