import { createContext, Fragment, useCallback, useContext, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from './Icon'

// crumbs: [{ label, to }] shown above the title on sub-pages; list pages show "Step N of 5" instead
export function PageHeader({ title, subtitle, actions, crumbs = [] }) {
  return (
    <div className="page-header">
      <div>
        {crumbs.length > 0 && (
          <nav className="crumbs" aria-label="Breadcrumb">
            {crumbs.map((c) => (
              <Fragment key={c.to}><Link to={c.to}>{c.label}</Link><Icon name="chevronRight" size={14} /></Fragment>
            ))}
            <span>{title}</span>
          </nav>
        )}
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  )
}

export function Card({ title, subtitle, actions, children, flush, className = '' }) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <header className="card-header">
          <div>
            {title && <h2>{title}</h2>}
            {subtitle && <p>{subtitle}</p>}
          </div>
          {actions}
        </header>
      )}
      {flush ? children : <div className="card-body">{children}</div>}
    </section>
  )
}

const btnClass = (variant, size, className) => `btn btn-${variant} ${size ? `btn-${size}` : ''} ${className}`

// variant: primary | secondary | soft | ghost | danger
export function Button({ variant = 'primary', size, icon, loading, children, className = '', ...rest }) {
  return (
    <button type="button" {...rest} className={btnClass(variant, size, className)} disabled={loading || rest.disabled}>
      {loading ? <span className="spinner" /> : icon && <Icon name={icon} size={16} />}
      {children}
    </button>
  )
}

export function ButtonLink({ to, variant = 'primary', size, icon, children, className = '', ...rest }) {
  return (
    <Link to={to} className={btnClass(variant, size, className)} {...rest}>
      {icon && <Icon name={icon} size={16} />}
      {children}
    </Link>
  )
}

export function IconButton({ icon, label, danger, className = '', ...rest }) {
  return (
    <button type="button" className={`btn-icon ${danger ? 'danger' : ''} ${className}`} title={label} aria-label={label} {...rest}>
      <Icon name={icon} size={16} />
    </button>
  )
}

export function Badge({ tone = 'gray', dot, children, className = '' }) {
  return <span className={`badge tone-${tone} ${className}`}>{dot && <i />}{children}</span>
}

export function Alert({ type = 'error', children }) {
  if (!children) return null
  const icon = { error: 'alert', warning: 'alert', success: 'checkCircle', info: 'info' }[type]
  return <div className={`alert alert-${type}`} role="alert"><Icon name={icon} size={16} /><div>{children}</div></div>
}

export function EmptyState({ icon = 'box', title, text, action }) {
  return (
    <div className="empty">
      <div className="empty-icon tone-indigo"><Icon name={icon} size={24} /></div>
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action}
    </div>
  )
}

export function StatCard({ label, value, sub, icon, tone = 'indigo' }) {
  return (
    <div className="card stat">
      <div className={`stat-icon tone-${tone}`}><Icon name={icon} size={20} /></div>
      <div>
        <div className="stat-label">{label}</div>
        <div className="stat-value num">{value}</div>
        {sub && <div className="stat-sub">{sub}</div>}
      </div>
    </div>
  )
}

export function Progress({ value, color }) {
  return <div className="progress"><span style={{ width: `${Math.min(value, 100)}%`, background: color }} /></div>
}

export function Loader() {
  return <div className="loader"><span className="spinner lg" /></div>
}

// Side panel that slides in from the right; closes on Escape or a click on the backdrop
export function Drawer({ open, title, subtitle, onClose, children, footer, width = 460, className = '' }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="drawer-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className={`drawer ${className}`} style={{ maxWidth: width }} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined}>
        <header className="drawer-header">
          <div className="min-w-0">
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <IconButton icon="x" label="Close" onClick={onClose} />
        </header>
        <div className="drawer-body">{children}</div>
        {footer && <footer className="drawer-footer">{footer}</footer>}
      </aside>
    </div>
  )
}

export function Modal({ open, title, subtitle, onClose, children, footer, width = 520 }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: width }} role="dialog" aria-modal="true" aria-label={title}>
        <header className="modal-header">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <IconButton icon="x" label="Close" onClick={onClose} />
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-footer">{footer}</footer>}
      </div>
    </div>
  )
}

export function ConfirmDialog({ open, title, message, confirmLabel = 'Delete', onConfirm, onClose, loading, error }) {
  return (
    <Modal open={open} title={title} onClose={onClose} width={440}
      footer={<>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="danger" loading={loading} onClick={onConfirm}>{confirmLabel}</Button>
      </>}>
      <div className="stack">
        <p className="muted">{message}</p>
        <Alert>{error}</Alert>
      </div>
    </Modal>
  )
}

const ToastContext = createContext(() => {})

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const push = useCallback((message, type = 'success') => {
    const id = Math.random()
    setToasts((t) => [...t, { id, message, type }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500)
  }, [])
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="toast-stack" role="status">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            <Icon name={t.type === 'error' ? 'alert' : 'check'} size={16} />
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
