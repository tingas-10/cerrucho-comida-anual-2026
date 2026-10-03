// Carcasa: sidebar en escritorio, barra inferior en el celular, topbar y tema.
import {
  Archive,
  Beer,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Gift,
  Home,
  Image as ImageIcon,
  ListChecks,
  LogOut,
  Moon,
  MoreHorizontal,
  Settings,
  Sun,
  Trophy,
  UserRound,
  Users,
  UtensilsCrossed,
  X,
} from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { GRUPO } from '../content/config'
import { useSession } from '../data/DataContext'
import { useCollection, useEdition } from '../data/hooks'
import { P } from '../data/paths'
import type { Rsvp } from '../data/types'
import { useTheme } from './theme'

const LOGO = import.meta.env.BASE_URL + 'logo.webp'

interface NavItem {
  to: string
  label: string
  icon: ReactNode
  end?: boolean
}

function useNav() {
  const { slug, isAdmin } = useSession()
  const e = `/e/${slug}`
  const edicion: NavItem[] = [
    { to: e, label: 'Inicio', icon: <Home size={18} />, end: true },
    { to: `${e}/fecha`, label: 'Fecha y asistencia', icon: <CalendarDays size={18} /> },
    { to: `${e}/comida`, label: 'Comida y lugar', icon: <UtensilsCrossed size={18} /> },
    { to: `${e}/bebidas`, label: 'Bebidas', icon: <Beer size={18} /> },
    { to: `${e}/amigo-invisible`, label: 'Amigo invisible', icon: <Gift size={18} /> },
    { to: `${e}/premios`, label: 'Premios', icon: <Trophy size={18} /> },
    { to: `${e}/agenda`, label: 'Agenda y salida', icon: <Clock size={18} /> },
  ]
  const organizacion: NavItem[] = [{ to: `${e}/tareas`, label: 'Tareas y compras', icon: <ListChecks size={18} /> }]
  const banda: NavItem[] = [
    { to: '/miembros', label: 'Miembros', icon: <Users size={18} /> },
    { to: '/galeria', label: 'Galería', icon: <ImageIcon size={18} /> },
    { to: '/archivo', label: 'Archivo', icon: <Archive size={18} /> },
  ]
  const admin: NavItem[] = isAdmin ? [{ to: '/admin', label: 'Administración', icon: <Settings size={18} /> }] : []
  return { edicion, organizacion, banda, admin, e }
}

function Item({ item, collapsed, onClick }: { item: NavItem; collapsed?: boolean; onClick?: () => void }) {
  return (
    <NavLink to={item.to} end={item.end} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} title={collapsed ? item.label : undefined} onClick={onClick}>
      <span className="shrink-0">{item.icon}</span>
      {!collapsed ? <span>{item.label}</span> : <span className="sr-only">{item.label}</span>}
    </NavLink>
  )
}

function Group({ title, items, collapsed, onClick }: { title: string; items: NavItem[]; collapsed?: boolean; onClick?: () => void }) {
  return (
    <div className="mb-4">
      {!collapsed ? <p className="eyebrow px-3 mb-1 text-[10px]">{title}</p> : <div className="border-t border-line my-2" />}
      {items.map((i) => (
        <Item key={i.to} item={i} collapsed={collapsed} onClick={onClick} />
      ))}
    </div>
  )
}

export function Shell({ children }: { children: ReactNode }) {
  const { member, slug, demo, signOut, resetDemo } = useSession()
  const nav = useNav()
  const [theme, toggleTheme] = useTheme()
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('cerrucho-sidebar') === '1'
    } catch {
      return false
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem('cerrucho-sidebar', collapsed ? '1' : '0')
    } catch {
      /* nada */
    }
  }, [collapsed])
  const [sheet, setSheet] = useState<'organizar' | 'mas' | null>(null)
  const location = useLocation()
  useEffect(() => setSheet(null), [location.pathname])

  const { data: edition } = useEdition()
  const { rows: rsvps } = useCollection<Rsvp>(P.rsvps(slug))
  const confirmed = rsvps.filter((r) => r.status === 'YES' && r.planVersion === (edition?.planVersion ?? 1)).length

  const sideWidth = collapsed ? 64 : 248

  return (
    <div className="min-h-dvh bg-bg">
      {/* Sidebar escritorio */}
      <aside
        className="hidden md:flex fixed top-0 bottom-0 left-0 flex-col bg-side border-r border-line p-3 overflow-y-auto"
        style={{ width: sideWidth }}
        aria-label="Navegación principal"
      >
        <div className={`px-2 pt-2 pb-5 ${collapsed ? 'text-center' : ''}`}>
          {!collapsed ? (
            <div className="flex items-center gap-3">
              <img src={LOGO} alt="" className="w-12 h-12 rounded-full object-cover shrink-0" />
              <div>
                <p className="font-extrabold leading-tight text-base">{GRUPO.nombre}</p>
                <p className="eyebrow mt-1 text-[10px]">{edition?.title ?? 'Comida anual'}</p>
              </div>
            </div>
          ) : (
            <img src={LOGO} alt={GRUPO.nombre} className="w-10 h-10 rounded-full object-cover mx-auto" />
          )}
        </div>
        <nav className="flex-1">
          <Group title="Esta edición" items={nav.edicion} collapsed={collapsed} />
          <Group title="Organización" items={nav.organizacion} collapsed={collapsed} />
          <Group title="La banda" items={nav.banda} collapsed={collapsed} />
          {nav.admin.length ? <Group title="Más" items={nav.admin} collapsed={collapsed} /> : null}
        </nav>
        <button type="button" className="nav-link mt-2" onClick={() => setCollapsed((c) => !c)} aria-label={collapsed ? 'Expandir menú' : 'Contraer menú'}>
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          {!collapsed ? <span>Contraer</span> : null}
        </button>
      </aside>

      <div className="md:transition-[margin]" style={{ marginLeft: undefined }}>
        <div className="md:ml-[var(--side-w)]" style={{ ['--side-w' as string]: sideWidth + 'px' }}>
          {/* Topbar */}
          <header className="sticky top-0 z-30 h-14 bg-card/90 backdrop-blur border-b border-line flex items-center justify-between px-4 sm:px-6 gap-3">
            <div className="text-sm truncate flex items-center gap-2">
              <img src={LOGO} alt="" className="w-7 h-7 rounded-full object-cover md:hidden" />
              <span className="muted">{GRUPO.nombreCorto}</span>
              <span className="muted"> / </span>
              <span className="font-semibold">{edition?.title ?? '…'}</span>
            </div>
            <div className="flex items-center gap-1">
              <NavLink to={`${nav.e}/fecha`} className="btn btn-line btn-sm" title="Asistentes confirmados">
                <Users size={16} />
                <span>{confirmed}</span>
              </NavLink>
              <button type="button" className="btn btn-line btn-sm" onClick={toggleTheme} aria-label={theme === 'dark' ? 'Tema claro' : 'Tema oscuro'}>
                {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
              </button>
              <NavLink to="/cuenta" className="btn btn-line btn-sm hidden sm:inline-flex" title="Mi cuenta">
                <UserRound size={16} />
                <span className="max-w-[90px] truncate">{member?.alias ?? 'Cuenta'}</span>
              </NavLink>
            </div>
          </header>

          {demo ? (
            <div className="bg-warn-soft text-warn text-xs px-4 py-2 flex items-center justify-between gap-2">
              <span>
                <b>Modo demostración.</b> Nada se guarda en un servidor: falta conectar Firebase.
              </span>
              <button type="button" className="underline font-semibold" onClick={resetDemo}>
                Reiniciar demo
              </button>
            </div>
          ) : null}

          <main className="max-w-[1200px] mx-auto px-4 sm:px-6 py-5 pb-28 md:pb-10">{children}</main>
        </div>
      </div>

      {/* Barra inferior móvil */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-card border-t border-line flex safe-bottom px-1 pt-1" aria-label="Navegación móvil">
        <NavLink to={nav.e} end className={({ isActive }) => `flex-1 flex flex-col items-center gap-0.5 py-2 rounded-lg text-[11px] ${isActive ? 'text-accent font-bold bg-soft' : 'muted'}`}>
          <Home size={20} />
          Inicio
        </NavLink>
        <button type="button" onClick={() => setSheet('organizar')} className={`flex-1 flex flex-col items-center gap-0.5 py-2 rounded-lg text-[11px] ${sheet === 'organizar' ? 'text-accent font-bold bg-soft' : 'muted'}`}>
          <ListChecks size={20} />
          Organizar
        </button>
        <NavLink to={`${nav.e}/premios`} className={({ isActive }) => `flex-1 flex flex-col items-center gap-0.5 py-2 rounded-lg text-[11px] ${isActive ? 'text-accent font-bold bg-soft' : 'muted'}`}>
          <Trophy size={20} />
          Premios
        </NavLink>
        <NavLink to="/galeria" className={({ isActive }) => `flex-1 flex flex-col items-center gap-0.5 py-2 rounded-lg text-[11px] ${isActive ? 'text-accent font-bold bg-soft' : 'muted'}`}>
          <ImageIcon size={20} />
          Fotos
        </NavLink>
        <button type="button" onClick={() => setSheet('mas')} className={`flex-1 flex flex-col items-center gap-0.5 py-2 rounded-lg text-[11px] ${sheet === 'mas' ? 'text-accent font-bold bg-soft' : 'muted'}`}>
          <MoreHorizontal size={20} />
          Más
        </button>
      </nav>

      {sheet ? (
        <div className="md:hidden fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label={sheet === 'organizar' ? 'Organizar' : 'Más'}>
          <div className="absolute inset-0 bg-black/50" onClick={() => setSheet(null)} aria-hidden />
          <div className="absolute bottom-0 left-0 right-0 card rounded-b-none p-4 safe-bottom pop-in">
            <div className="flex items-center justify-between mb-2">
              <p className="h3">{sheet === 'organizar' ? 'Organizar' : 'Más'}</p>
              <button type="button" className="btn btn-line btn-sm" onClick={() => setSheet(null)} aria-label="Cerrar">
                <X size={16} />
              </button>
            </div>
            {sheet === 'organizar' ? (
              <div className="grid grid-cols-2 gap-1">
                {[...nav.edicion.slice(1, 5), ...nav.organizacion].map((i) => (
                  <Item key={i.to} item={i} onClick={() => setSheet(null)} />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-1">
                {[...nav.banda, nav.edicion[6], ...nav.admin].map((i) => (
                  <Item key={i.to} item={i} onClick={() => setSheet(null)} />
                ))}
                <NavLink to="/cuenta" className="nav-link" onClick={() => setSheet(null)}>
                  <UserRound size={18} /> Mi cuenta
                </NavLink>
                <button type="button" className="nav-link" onClick={() => void signOut()}>
                  <LogOut size={18} /> Cerrar sesión
                </button>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
