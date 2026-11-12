import { Alert, Card, Loader } from './ui'

const cellClass = (c) => `${c.align === 'end' ? 'end' : ''} ${c.className || ''}`

// columns: [{ key, header, render?(row), align?: 'end', className? }]; rowClass?(row) adds a class to a <tr>
export function DataTable({ columns, rows, rowKey = 'id', rowClass }) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>{columns.map((c) => <th key={c.key} className={c.align === 'end' ? 'end' : ''}>{c.header}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row[rowKey]} className={rowClass?.(row)}>
              {columns.map((c) => (
                <td key={c.key} className={cellClass(c)}>
                  {c.render ? c.render(row) : row[c.key] ?? <span className="subtle">—</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Card + table with loading / error / empty states. rows === null means still loading.
export function TableCard({ title, subtitle, actions, columns, rows, error, empty, toolbar, footer, rowKey, rowClass }) {
  return (
    <Card title={title} subtitle={subtitle} actions={actions} flush>
      {toolbar}
      {error ? <div className="card-body"><Alert>{error}</Alert></div>
        : !rows ? <Loader />
        : !rows.length ? empty
        : <DataTable columns={columns} rows={rows} rowKey={rowKey} rowClass={rowClass} />}
      {rows?.length > 0 && footer}
    </Card>
  )
}

// Standard "title over subtitle" cell, optionally with an initials avatar
export function CellTitle({ title, sub, avatar }) {
  return (
    <div className="cell">
      {avatar && <span className="cell-avatar">{avatar}</span>}
      <div className="min-w-0">
        <div className="cell-title">{title}</div>
        {sub && <div className="cell-sub" title={sub}>{sub}</div>}
      </div>
    </div>
  )
}
