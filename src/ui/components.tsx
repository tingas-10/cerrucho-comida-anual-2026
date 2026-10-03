// Componentes básicos reutilizados en todas las pantallas.
import { X } from 'lucide-react'
import { useEffect, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { colorFor, initials } from '../domain/format'

type BtnVariant = 'solid' | 'gold' | 'line' | 'ghost' | 'danger'

export function Button({
  variant = 'solid',
  size,
  loading,
  className = '',
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: 'sm'; loading?: boolean }) {
  const v = variant === 'solid' ? '' : `btn-${variant}`
  return (
    <button type="button" className={`btn ${v} ${size === 'sm' ? 'btn-sm' : ''} ${className}`} disabled={rest.disabled || loading} {...rest}>
      {loading ? <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" aria-hidden /> : null}
      {children}
    </button>
  )
}

export function Card({ children, className = '', ...rest }: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`card p-5 ${className}`} {...rest}>
      {children}
    </div>
  )
}

export function Pill({ children, tone = 'accent', className = '' }: { children: ReactNode; tone?: 'accent' | 'muted' | 'ok' | 'warn' | 'danger'; className?: string }) {
  const t = tone === 'accent' ? '' : `pill-${tone}`
  return <span className={`pill ${t} ${className}`}>{children}</span>
}

export function Avatar({ id, alias, size = 32, color }: { id: string; alias: string; size?: number; color?: string }) {
  const bg = color ?? colorFor(id)
  return (
    <span
      className="inline-flex items-center justify-center rounded-full font-extrabold shrink-0"
      style={{ width: size, height: size, background: bg, color: '#191409', fontSize: Math.max(10, size * 0.36) }}
      aria-hidden
    >
      {initials(alias)}
    </span>
  )
}

export function PersonChip({ id, alias, size = 28 }: { id: string; alias: string; size?: number }) {
  return (
    <span className="inline-flex items-center gap-2">
      <Avatar id={id} alias={alias} size={size} />
      <span className="font-semibold">{alias}</span>
    </span>
  )
}

export function Empty({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="card p-8 text-center">
      <p className="h3">{title}</p>
      {text ? <p className="muted small mt-1">{text}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  )
}

export function Loading({ text = 'Cargando…' }: { text?: string }) {
  return (
    <div className="flex items-center gap-3 muted small py-6" role="status">
      <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" aria-hidden />
      {text}
    </div>
  )
}

export function ErrorBox({ text, retry }: { text: string; retry?: () => void }) {
  return (
    <div className="rounded-xl border border-danger/30 bg-danger-soft text-danger p-4 text-sm flex items-center justify-between gap-3" role="alert">
      <span>{text}</span>
      {retry ? (
        <Button size="sm" variant="line" onClick={retry}>
          Reintentar
        </Button>
      ) : null}
    </div>
  )
}

export function Notice({ children, tone = 'accent' }: { children: ReactNode; tone?: 'accent' | 'warn' | 'danger' | 'ok' }) {
  const cls =
    tone === 'warn'
      ? 'bg-warn-soft text-warn'
      : tone === 'danger'
        ? 'bg-danger-soft text-danger'
        : tone === 'ok'
          ? 'bg-ok-soft text-ok'
          : 'bg-soft text-accent'
  return <div className={`rounded-xl px-4 py-3 text-sm ${cls}`}>{children}</div>
}

export function PageHeader({ eyebrow, title, intro, actions }: { eyebrow?: string; title: string; intro?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-5">
      <div>
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1 className="h1 mt-1">{title}</h1>
        {intro ? <p className="muted mt-2 max-w-2xl">{intro}</p> : null}
      </div>
      {actions ? <div className="flex gap-2 flex-wrap">{actions}</div> : null}
    </div>
  )
}

export function Section({ title, children, aside, className = '' }: { title?: string; children: ReactNode; aside?: ReactNode; className?: string }) {
  return (
    <section className={`mt-8 ${className}`}>
      {title ? (
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="h2">{title}</h2>
          {aside}
        </div>
      ) : null}
      {children}
    </section>
  )
}

export function Field({ label, hint, children, id }: { label: string; hint?: string; children: ReactNode; id?: string }) {
  return (
    <div className="mb-4">
      <label className="label" htmlFor={id}>
        {label}
      </label>
      {children}
      {hint ? <p className="tiny muted mt-1">{hint}</p> : null}
    </div>
  )
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className="input" {...props} />
}
export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className="input" {...props} />
}
export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className="input" {...props} />
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const prev = document.activeElement as HTMLElement | null
    ref.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      prev?.focus()
    }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center p-0 sm:p-4" role="presentation">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative card w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} max-h-[92dvh] overflow-y-auto p-5 rounded-b-none sm:rounded-b-[16px] pop-in`}
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <h2 className="h2">{title}</h2>
          <button type="button" className="btn btn-line btn-sm" onClick={onClose} aria-label="Cerrar">
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  text,
  confirmLabel = 'Confirmar',
  danger,
  requireReason,
  loading,
}: {
  open: boolean
  onClose: () => void
  onConfirm: (reason: string) => void | Promise<void>
  title: string
  text?: ReactNode
  confirmLabel?: string
  danger?: boolean
  requireReason?: boolean
  loading?: boolean
}) {
  const reasonRef = useRef<HTMLTextAreaElement>(null)
  return (
    <Modal open={open} onClose={onClose} title={title}>
      {text ? <div className="muted small mb-4">{text}</div> : null}
      {requireReason ? (
        <Field label="Motivo (queda registrado)" id="confirm-reason">
          <textarea id="confirm-reason" className="input" ref={reasonRef} placeholder="Explicá por qué" />
        </Field>
      ) : null}
      <div className="flex gap-2 justify-end">
        <Button variant="line" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          variant={danger ? 'danger' : 'gold'}
          loading={loading}
          onClick={() => {
            const reason = reasonRef.current?.value.trim() ?? ''
            if (requireReason && !reason) {
              reasonRef.current?.focus()
              return
            }
            void onConfirm(reason)
          }}
        >
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  )
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="card p-4">
      <p className="tiny muted">{label}</p>
      <p className="text-3xl font-extrabold tracking-tight mt-1">{value}</p>
      {hint ? <p className="tiny muted mt-1">{hint}</p> : null}
    </div>
  )
}

export function Progress({ value, max, label }: { value: number; max: number; label?: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  return (
    <div>
      {label ? (
        <div className="flex justify-between tiny muted mb-1">
          <span>{label}</span>
          <span>
            {value} de {max}
          </span>
        </div>
      ) : null}
      <div className="bar" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}>
        <span style={{ width: pct + '%' }} />
      </div>
    </div>
  )
}

export function Segmented<T extends string>({ value, onChange, options, ariaLabel }: { value: T; onChange: (v: T) => void; options: Array<{ value: T; label: string }>; ariaLabel: string }) {
  return (
    <div className="inline-flex rounded-xl border border-line p-1 gap-1 bg-bg" role="group" aria-label={ariaLabel}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`px-3 min-h-[36px] rounded-lg text-sm font-semibold ${value === o.value ? 'bg-soft text-accent' : 'muted'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
