import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import api, { useAction, useFetch } from '../api'
import { CellTitle, TableCard } from '../components/table'
import Icon from '../components/Icon'
import { Alert, ButtonLink, ConfirmDialog, EmptyState, IconButton, PageHeader, Progress, useToast } from '../components/ui'
import { batchLabel, batchPdfUrl, fmtDate, fmtNum, pct } from '../format'

export default function QrGeneration() {
  const { data: campaigns } = useFetch('/campaigns')
  const { data: batches, error, reload } = useFetch('/batches')
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const justGenerated = batches?.find((b) => String(b.id) === params.get('generated'))
  const [toDelete, setToDelete] = useState(null)

  const remove = useAction(async () => {
    await api.delete(`/batches/${toDelete.id}`)
    toast('Batch deleted')
    setToDelete(null)
    reload()
  })

  const noCampaigns = campaigns && !campaigns.length
  const addButton = <ButtonLink to="/qr-generation/new" icon="qr">Generate QR codes</ButtonLink>

  const columns = [
    { key: 'name', header: 'Batch', render: (b) => <CellTitle title={batchLabel(b)} sub={`${b.campaign_name} · ${b.product_name}`} /> },
    { key: 'validity', header: 'Valid', render: (b) => <span className="subtle nowrap">{fmtDate(b.activation_date)} – {fmtDate(b.expiry_date)}</span> },
    { key: 'quantity', header: 'QR codes', render: (b) => <span className="num">{fmtNum(b.quantity)}</span> },
    {
      key: 'assigned', header: 'Assigned', render: (b) => (
        <div style={{ minWidth: 150 }}>
          <div className="bar-head"><span className="subtle">{fmtNum(b.assigned_count)} of {fmtNum(b.quantity)}</span></div>
          <Progress value={pct(b.assigned_count, b.quantity)} color={b.unassigned_count ? undefined : 'var(--success)'} />
        </div>
      ),
    },
    {
      key: 'actions', header: '', align: 'end', render: (b) => (
        <div className="actions">
          <a className="btn btn-ghost btn-sm" href={batchPdfUrl(b.id)}><Icon name="download" size={16} />PDF</a>
          <ButtonLink to={`/qr-codes?batch_id=${b.id}`} variant="ghost" size="sm">View codes</ButtonLink>
          <IconButton icon="trash" label={b.assigned_count ? 'Batch has assigned codes' : 'Delete'} danger
            disabled={b.assigned_count > 0} onClick={() => { remove.setError(''); setToDelete(b) }} />
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader title="QR Generation"
        subtitle="Generate batches of unique QR codes for a campaign, each with its own activation and expiry date."
        actions={!noCampaigns && addButton} />
      {justGenerated && (
        <div className="generated-banner">
          <Alert type="success">
            <b>{fmtNum(justGenerated.quantity)} QR codes generated</b> for {justGenerated.campaign_name}. Download the print-ready PDF
            (A4, 5″ × 2.5″ labels, 6 per page).
          </Alert>
          <a className="btn btn-primary" href={batchPdfUrl(justGenerated.id)}><Icon name="download" size={16} />Download PDF</a>
          <IconButton icon="x" label="Dismiss" onClick={() => setParams({}, { replace: true })} />
        </div>
      )}
      <TableCard columns={columns} rows={campaigns ? batches : null} error={error}
        empty={noCampaigns
          ? <EmptyState icon="campaign" title="Create a campaign first" text="QR codes are generated for a campaign."
            action={<ButtonLink to="/campaigns/new" icon="plus">Add campaign</ButtonLink>} />
          : <EmptyState icon="qr" title="No QR batches yet" text="Generate your first batch of QR codes." action={addButton} />} />
      <ConfirmDialog open={!!toDelete} onClose={() => setToDelete(null)} title="Delete batch?"
        message={toDelete && `${batchLabel(toDelete)} and its ${fmtNum(toDelete.quantity)} QR codes will stop working. They stay listed as Deleted in QR Details.`}
        onConfirm={remove.run} loading={remove.loading} error={remove.error} />
    </>
  )
}
