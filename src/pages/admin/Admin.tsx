// Panel privado de Agus. Pestañas por módulo; cada una es un archivo en esta carpeta.
import { Navigate, NavLink, Route, Routes } from 'react-router-dom'
import { useSession } from '../../data/DataContext'
import { Notice, PageHeader } from '../../ui/components'
import { AdminAuditoria } from './AdminAuditoria'
import { AdminBebidas } from './AdminBebidas'
import { AdminDecisiones } from './AdminDecisiones'
import { AdminEdicion } from './AdminEdicion'
import { AdminGastos } from './AdminGastos'
import { AdminMiembros } from './AdminMiembros'
import { AdminPremios } from './AdminPremios'
import { AdminRegalos } from './AdminRegalos'
import { AdminTareas } from './AdminTareas'

const TABS = [
  { path: 'edicion', label: 'Edición' },
  { path: 'miembros', label: 'Miembros' },
  { path: 'decisiones', label: 'Decisiones y comida' },
  { path: 'bebidas', label: 'Bebidas y compras' },
  { path: 'regalos', label: 'Regalos' },
  { path: 'premios', label: 'Premios' },
  { path: 'tareas', label: 'Tareas' },
  { path: 'gastos', label: 'Gastos' },
  { path: 'auditoria', label: 'Auditoría' },
]

export function Admin() {
  const { isAdmin } = useSession()
  if (!isAdmin) return <Notice tone="danger">Esta sección es sólo para el administrador.</Notice>
  return (
    <div>
      <PageHeader eyebrow="Vista de Agus" title="Administración" intro="Todo lo organizativo se edita acá, sin tocar código. Las acciones sensibles piden motivo y quedan registradas." />
      <nav className="flex gap-1 overflow-x-auto pb-2 mb-4 -mx-1 px-1" aria-label="Secciones de administración">
        {TABS.map((t) => (
          <NavLink key={t.path} to={`/admin/${t.path}`} className={({ isActive }) => `nav-link whitespace-nowrap ${isActive ? 'active' : ''}`}>
            {t.label}
          </NavLink>
        ))}
      </nav>
      <Routes>
        <Route index element={<Navigate to="/admin/edicion" replace />} />
        <Route path="edicion" element={<AdminEdicion />} />
        <Route path="miembros" element={<AdminMiembros />} />
        <Route path="decisiones" element={<AdminDecisiones />} />
        <Route path="bebidas" element={<AdminBebidas />} />
        <Route path="regalos" element={<AdminRegalos />} />
        <Route path="premios" element={<AdminPremios />} />
        <Route path="tareas" element={<AdminTareas />} />
        <Route path="gastos" element={<AdminGastos />} />
        <Route path="auditoria" element={<AdminAuditoria />} />
        <Route path="*" element={<Navigate to="/admin/edicion" replace />} />
      </Routes>
    </div>
  )
}
