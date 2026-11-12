import { useId } from 'react'
import { Link } from 'react-router-dom'
import Icon from './Icon'
import { Alert } from './ui'

// Label row + hint/error line shared by every field
function FieldShell({ id, label, required, optional, hint, error, count, max, children, className = '' }) {
  const showMeta = optional || max != null
  return (
    <div className={`field ${className}`}>
      {(label || showMeta) && (
        <div className="field-head">
          {label && <label className="field-label" htmlFor={id}>{label}{required && <span className="req">*</span>}</label>}
          {showMeta && (
            <span className={`field-meta ${max != null && count > max * 0.9 ? 'warn' : ''}`}>
              {[optional && 'Optional', max != null && `${count}/${max}`].filter(Boolean).join(' · ')}
            </span>
          )}
        </div>
      )}
      {children}
      {error
        ? <span className="field-error"><Icon name="alert" size={13} />{error}</span>
        : hint && <span className="field-hint">{hint}</span>}
    </div>
  )
}

// prefix: text ("₹") or an icon element shown inside the input; suffix: a .btn-icon placed on the right
function InputWrap({ prefix, suffix, children }) {
  if (prefix) return <div className={`input-prefix ${typeof prefix === 'string' ? '' : 'has-icon'}`}><span>{prefix}</span>{children}</div>
  if (suffix) return <div className="input-group">{children}{suffix}</div>
  return children
}

export function TextField({ label, required, optional, hint, error, prefix, suffix, showCount, className, inputClassName = '', value, ...rest }) {
  const id = useId()
  return (
    <FieldShell id={id} label={label} required={required} optional={optional} hint={hint} error={error}
      count={String(value ?? '').length} max={showCount ? rest.maxLength : undefined} className={className}>
      <InputWrap prefix={prefix} suffix={suffix}>
        <input id={id} className={`input ${error ? 'invalid' : ''} ${inputClassName}`} value={value ?? ''} required={required} {...rest} />
      </InputWrap>
    </FieldShell>
  )
}

export function TextAreaField({ label, required, optional, hint, error, showCount, className, rows = 4, value, ...rest }) {
  const id = useId()
  return (
    <FieldShell id={id} label={label} required={required} optional={optional} hint={hint} error={error}
      count={String(value ?? '').length} max={showCount ? rest.maxLength : undefined} className={className}>
      <textarea id={id} className={`textarea ${error ? 'invalid' : ''}`} rows={rows} value={value ?? ''} required={required} {...rest} />
    </FieldShell>
  )
}

// options: [{ value, label, disabled }]. The placeholder is selectable unless the field is required.
export function SelectField({ label, required, optional, hint, error, options, placeholder, className, ...rest }) {
  const id = useId()
  return (
    <FieldShell id={id} label={label} required={required} optional={optional} hint={hint} error={error} className={className}>
      <select id={id} className={`select ${error ? 'invalid' : ''}`} required={required} {...rest}>
        {placeholder != null && <option value="" disabled={required}>{placeholder}</option>}
        {options.map((o) => <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>)}
      </select>
    </FieldShell>
  )
}

// Large selectable cards. options: [{ value, label, text, icon, tone }]
export function ChoiceCards({ options, value, onChange }) {
  return (
    <div className="choice-grid">
      {options.map((o) => (
        <button key={o.value} type="button" className={`choice ${value === o.value ? 'selected' : ''}`}
          onClick={() => onChange(o.value)} aria-pressed={value === o.value}>
          {value === o.value && <span className="choice-check"><Icon name="check" size={12} /></span>}
          <span className={`choice-icon tone-${o.tone}`}><Icon name={o.icon} size={18} /></span>
          <b>{o.label}</b>
          <span>{o.text}</span>
        </button>
      ))}
    </div>
  )
}

// A whole create/edit page form: a stack of section cards and a sticky action bar
export function FormCard({ error, onSubmit, footer, children }) {
  return (
    <form className="form-stack" onSubmit={(e) => { e.preventDefault(); onSubmit() }}>
      {error && <Alert>{error}</Alert>}
      {children}
      {footer && <div className="card form-footer">{footer}</div>}
    </form>
  )
}

export function FormSection({ title, description, children }) {
  return (
    <section className="card form-section">
      <header>
        <h2 className="form-section-title">{title}</h2>
        {description && <p className="form-section-desc">{description}</p>}
      </header>
      <div className="form-fields">{children}</div>
    </section>
  )
}

// Contents of the action bar: status on the left, Cancel + actions on the right
export function FormFooter({ status, cancelTo, children }) {
  return (
    <>
      <div className="form-status">{status}</div>
      {cancelTo && <Link to={cancelTo} className="btn btn-secondary">Cancel</Link>}
      {children}
    </>
  )
}

export const RequiredNote = () => <span><span className="text-danger">*</span> Required fields</span>

// Highlighted line for computed info inside a section. tone: 'ok' | 'bad'
export function InfoStrip({ tone, children }) {
  return <div className={`info-strip ${tone || ''}`}>{children}</div>
}
