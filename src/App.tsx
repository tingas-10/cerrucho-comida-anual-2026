import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useSession } from './data/DataContext'
import { Admin } from './pages/admin/Admin'
import { Agenda } from './pages/Agenda'
import { AmigoInvisible } from './pages/AmigoInvisible'
import { Archivo } from './pages/Archivo'
import { BandaHome } from './pages/BandaHome'
import { Bebidas } from './pages/Bebidas'
import { Comida } from './pages/Comida'
import { Cumpleanos } from './pages/Cumpleanos'
import { Fecha } from './pages/Fecha'
import { FmoJugadores } from './pages/fmo/FmoJugadores'
import { FmoPartido } from './pages/fmo/FmoPartido'
import { FmoPartidos } from './pages/fmo/FmoPartidos'
import { FmoRanking } from './pages/fmo/FmoRanking'
import { FmoVersus } from './pages/fmo/FmoVersus'
import { Galeria } from './pages/Galeria'
import { Inicio } from './pages/Inicio'
import { Login } from './pages/Login'
import { Miembros } from './pages/Miembros'
import { Onboarding, Perfil } from './pages/Perfil'
import { Premios } from './pages/Premios'
import { Tareas } from './pages/Tareas'
import { Loading } from './ui/components'
import { Shell } from './ui/Shell'

export default function App() {
  const { status, isMember, member } = useSession()
  const location = useLocation()
  if (status === 'loading') {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <Loading text="Cargando…" />
      </div>
    )
  }
  // Primer ingreso: cumpleaños, foto y contraseña propia antes de seguir.
  const needsOnboarding = isMember && member && member.profileDone !== true && location.pathname !== '/entrar'
  return (
    <Shell>
      {needsOnboarding ? (
        <Onboarding />
      ) : (
        <Routes>
          <Route path="/" element={<BandaHome />} />
          <Route path="/entrar" element={<Login />} />
          <Route path="/cumples" element={<Cumpleanos />} />
          <Route path="/perfil" element={<Perfil />} />
          <Route path="/cuenta" element={<Navigate to="/perfil" replace />} />
          <Route path="/e/:slug" element={<Inicio />} />
          <Route path="/e/:slug/fecha" element={<Fecha />} />
          <Route path="/e/:slug/comida" element={<Comida />} />
          <Route path="/e/:slug/bebidas" element={<Bebidas />} />
          <Route path="/e/:slug/amigo-invisible" element={<AmigoInvisible />} />
          <Route path="/e/:slug/premios" element={<Premios />} />
          <Route path="/e/:slug/agenda" element={<Agenda />} />
          <Route path="/e/:slug/tareas" element={<Tareas />} />
          <Route path="/fmo" element={<FmoPartidos />} />
          <Route path="/fmo/partido/:id" element={<FmoPartido />} />
          <Route path="/fmo/ranking" element={<FmoRanking />} />
          <Route path="/fmo/jugadores" element={<FmoJugadores />} />
          <Route path="/fmo/versus" element={<FmoVersus />} />
          <Route path="/miembros" element={<Miembros />} />
          <Route path="/galeria" element={<Galeria />} />
          <Route path="/archivo" element={<Archivo />} />
          <Route path="/admin/*" element={<Admin />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      )}
    </Shell>
  )
}
