import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { EDICION_ACTUAL } from './content/config'
import { useSession } from './data/DataContext'
import { Admin } from './pages/admin/Admin'
import { Agenda } from './pages/Agenda'
import { AmigoInvisible } from './pages/AmigoInvisible'
import { Archivo } from './pages/Archivo'
import { Bebidas } from './pages/Bebidas'
import { Comida } from './pages/Comida'
import { Cuenta } from './pages/Cuenta'
import { Fecha } from './pages/Fecha'
import { Galeria } from './pages/Galeria'
import { Inicio } from './pages/Inicio'
import { Login } from './pages/Login'
import { Miembros } from './pages/Miembros'
import { Premios } from './pages/Premios'
import { Tareas } from './pages/Tareas'
import { Loading } from './ui/components'
import { Shell } from './ui/Shell'

function Gate() {
  const { status, error, signOut, user, demo } = useSession()
  const location = useLocation()
  if (status === 'loading') {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <Loading text="Entrando…" />
      </div>
    )
  }
  if (status === 'anon') {
    return <Login returnTo={location.pathname} />
  }
  if (status === 'not-member' || status === 'suspended') {
    return (
      <div className="min-h-dvh flex items-center justify-center p-6">
        <div className="card p-6 max-w-md w-full text-center">
          <p className="h2">{status === 'suspended' ? 'Tu acceso está pausado' : 'Ese mail no tiene invitación activa'}</p>
          <p className="muted small mt-2">
            {status === 'suspended'
              ? 'Hablá con Agus para reactivarlo.'
              : `Entraste con ${user?.email ?? 'ese mail'}. Si te invitaron con otro, cerrá sesión y probá con ese. Si no, pedile a Agus que te sume.`}
          </p>
          {error && demo ? <p className="tiny text-danger mt-2">{error}</p> : null}
          <button type="button" className="btn mt-4" onClick={() => void signOut()}>
            Cerrar sesión
          </button>
        </div>
      </div>
    )
  }
  return (
    <Shell>
      <Routes>
              <Route path="/" element={<Navigate to={`/e/${EDICION_ACTUAL.slug}`} replace />} />
              <Route path="/entrar" element={<Navigate to={`/e/${EDICION_ACTUAL.slug}`} replace />} />
              <Route path="/e/:slug" element={<Inicio />} />
              <Route path="/e/:slug/fecha" element={<Fecha />} />
              <Route path="/e/:slug/comida" element={<Comida />} />
              <Route path="/e/:slug/bebidas" element={<Bebidas />} />
              <Route path="/e/:slug/amigo-invisible" element={<AmigoInvisible />} />
              <Route path="/e/:slug/premios" element={<Premios />} />
              <Route path="/e/:slug/agenda" element={<Agenda />} />
              <Route path="/e/:slug/tareas" element={<Tareas />} />
              <Route path="/miembros" element={<Miembros />} />
              <Route path="/galeria" element={<Galeria />} />
              <Route path="/archivo" element={<Archivo />} />
              <Route path="/cuenta" element={<Cuenta />} />
              <Route path="/admin/*" element={<Admin />} />
              <Route path="*" element={<Navigate to={`/e/${EDICION_ACTUAL.slug}`} replace />} />
      </Routes>
    </Shell>
  )
}

export default function App() {
  return <Gate />
}
