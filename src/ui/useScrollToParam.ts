// Si la dirección trae ?ver=<algo>, baja hasta el bloque con id "ver-<algo>" (ej. desde "El plan" en Inicio).
import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'

export function useScrollToParam(ready: boolean) {
  const [params] = useSearchParams()
  const target = params.get('ver')
  useEffect(() => {
    if (!ready || !target) return
    // Después del "arrancá arriba" del Shell y de que se dibujen las opciones.
    const t = window.setTimeout(() => document.getElementById(`ver-${target}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 250)
    return () => window.clearTimeout(t)
  }, [ready, target])
}
