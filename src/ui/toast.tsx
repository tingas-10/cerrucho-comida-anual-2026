import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

interface Toast {
  id: number
  text: string
  kind: 'ok' | 'error' | 'info'
}

interface ToastApi {
  toast: (text: string, kind?: Toast['kind']) => void
  ok: (text: string) => void
  error: (text: string) => void
}

const Ctx = createContext<ToastApi | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([])
  const toast = useCallback((text: string, kind: Toast['kind'] = 'info') => {
    const id = Date.now() + Math.random()
    setItems((l) => [...l, { id, text, kind }])
    setTimeout(() => setItems((l) => l.filter((t) => t.id !== id)), kind === 'error' ? 6000 : 3500)
  }, [])
  const api = useMemo<ToastApi>(
    () => ({ toast, ok: (t) => toast(t, 'ok'), error: (t) => toast(t, 'error') }),
    [toast],
  )
  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="fixed left-1/2 -translate-x-1/2 bottom-20 md:bottom-6 z-50 flex flex-col gap-2 w-[calc(100%-32px)] max-w-md pointer-events-none" role="status" aria-live="polite">
        {items.map((t) => (
          <div
            key={t.id}
            className={`pop-in px-4 py-3 rounded-xl shadow-lg text-sm font-semibold border ${
              t.kind === 'ok' ? 'bg-ok-soft text-ok border-ok/30' : t.kind === 'error' ? 'bg-danger-soft text-danger border-danger/30' : 'bg-card text-ink border-line'
            }`}
          >
            {t.text}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}

export function useToast(): ToastApi {
  const api = useContext(Ctx)
  if (!api) throw new Error('useToast fuera de ToastProvider')
  return api
}
