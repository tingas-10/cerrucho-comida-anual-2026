// Carcasa: sidebar en escritorio, barra inferior en el celular, topbar y tema.
import {
  Archive,
  Beer,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Gift,
  Goal,
  Home,
  Image as ImageIcon,
  ListChecks,
  LogOut,
  Medal,
  Moon,
  MoreHorizontal,
  Settings,
  Sun,
  Swords,
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
  const fmo: NavItem[] = [
    { to: '/fmo', label: 'Partidos', icon: <Goal size={18} />, end: true },
    { to: '/fmo/ranking', label: 'Ranking', icon: <Medal size={18} /> },
    { to: '/fmo/jugadores', label: 'Jugadores', icon: <UserRound size={18} /> },
    { to: '/fmo/versus', label: '1 vs 1', icon: <Swords size={18} /> },
  ]
  const admin: NavItem[] = isAdmin ? [{ to: '/admin', label: 'Administración', icon: <Settings size={18} /> }] : []
  return { edicion, organizacion, fmo, banda, admin, e }
}

function Item({ item, collapsed, onClick }: { item: NavItem; collapsed?: boolean; onClick?: () => void }) {
  return (
    <NavLink to={item.to} end={item.end} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} title={collapsed ? item.label : undefined} onClick={onClick}>
      <span className="shrink-0">{item.icon}</span>
      {!collapsed ? <span>{item.label}</span> : <span className="sr-only">{item.label}</span>}
    </NavLink>
  )
}

/** Sección del menú: el título es un botón que pliega o despliega sus subsecciones. */
function Group({ title, items, collapsed, open = true, onToggle, onClick }: { title: string; items: NavItem[]; collapsed?: boolean; open?: boolean; onToggle?: () => void; onClick?: () => void }) {
  if (collapsed) {
    return (
      <div className="mb-2">
        <div className="border-t border-line my-2" />
        {items.map((i) => (
          <Item key={i.to} item={i} collapsed onClick={onClick} />
        ))}
      </div>
    )
  }
  return (
    <div className="mb-2">
      <button type="button" className="w-full flex items-center justify-between gap-2 px-3 min-h-[40px] rounded-lg eyebrow text-[10px] hover:bg-soft/60" aria-expanded={open} onClick={onToggle}>
        <span className="text-left">{title}</span>
        <ChevronDown size={14} className={`shrink-0 transition-transform ${open ? '' : '-rotate-90'}`} aria-hidden />
      </button>
      {open
        ? items.map((i) => <Item key={i.to} item={i} onClick={onClick} />)
        : null}
    </div>
  )
}

const NAV_OPEN_KEY = 'cerrucho-nav-open'
function loadOpenGroups(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(NAV_OPEN_KEY) ?? '{}') as Record<string, boolean>
  } catch {
    return {}
  }
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
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(loadOpenGroups)
  const isOpen = (id: string) => openGroups[id] !== false
  const toggleGroup = (id: string) =>
    setOpenGroups((cur) => {
      const next = { ...cur, [id]: cur[id] === false }
      try {
        localStorage.setItem(NAV_OPEN_KEY, JSON.stringify(next))
      } catch {
        /* nada */
      }
      return next
    })
  const [sheet, setSheet] = useState<'organizar' | 'mas' | null>(null)
  const location = useLocation()
  useEffect(() => {
    setSheet(null)
    window.scrollTo(0, 0) // cada pantalla arranca arriba (clave en celular)
  }, [location.pathname])

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
              <p className="font-extrabold leading-tight text-base">{GRUPO.nombre}</p>
            </div>
          ) : (
            <img src={LOGO} alt={GRUPO.nombre} className="w-10 h-10 rounded-full object-cover mx-auto" />
          )}
        </div>
        <nav className="flex-1">
          <Group title={edition?.title ?? 'Comida anual'} items={[...nav.edicion, ...nav.organizacion]} collapsed={collapsed} open={isOpen('edicion')} onToggle={() => toggleGroup('edicion')} />
          <Group title="FMO" items={nav.fmo} collapsed={collapsed} open={isOpen('fmo')} onToggle={() => toggleGroup('fmo')} />
          <Group title="La banda" items={nav.banda} collapsed={collapsed} open={isOpen('banda')} onToggle={() => toggleGroup('banda')} />
          {nav.admin.length ? <Group title="Más" items={nav.admin} collapsed={collapsed} open={isOpen('mas')} onToggle={() => toggleGroup('mas')} /> : null}
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
            <div className="text-sm min-w-0 flex items-center gap-2">
              <img src={LOGO} alt="" className="w-8 h-8 rounded-full object-cover md:hidden shrink-0" />
              <span className="font-bold truncate md:hidden">{GRUPO.nombre}</span>
              <span className="muted hidden md:inline">{GRUPO.nombreCorto}</span>
              <span className="muted hidden md:inline"> / </span>
              <span className="font-semibold truncate hidden md:inline">{edition?.title ?? '…'}</span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
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
                <b>Modo demostración.</b> Datos de prueba: nada se guarda en un servidor.
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
        <NavLink to="/fmo" className={({ isActive }) => `flex-1 flex flex-col items-center gap-0.5 py-2 rounded-lg text-[11px] ${isActive ? 'text-accent font-bold bg-soft' : 'muted'}`}>
          <Goal size={20} />
          FMO
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
              <p className="h3">{sheet === 'organizar' ? (edition?.title ?? 'Comida anual') : 'Más'}</p>
              <button type="button" className="btn btn-line btn-sm" onClick={() => setSheet(null)} aria-label="Cerrar">
                <X size={16} />
              </button>
            </div>
            {sheet === 'organizar' ? (
              <div className="grid grid-cols-2 gap-1">
                {[...nav.edicion.slice(1), ...nav.organizacion].map((i) => (
                  <Item key={i.to} item={i} onClick={() => setSheet(null)} />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-1">
                {[...nav.banda, ...nav.admin].map((i) => (
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
