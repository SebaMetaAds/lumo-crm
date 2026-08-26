'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Inbox, Users, Building2, BadgeDollarSign, KanbanSquare, CheckSquare, Activity, Package, BarChart3, Workflow, Settings } from 'lucide-react'

const items = [
  ['/', 'Dashboard', LayoutDashboard],
  ['/inbox', 'Inbox', Inbox],
  ['/contacts', 'Contactos', Users],
  ['/companies', 'Empresas', Building2],
  ['/opportunities', 'Oportunidades', BadgeDollarSign],
  ['/sales-process', 'Proceso de ventas', KanbanSquare],
  ['/tasks', 'Tareas', CheckSquare],
  ['/activity', 'Actividad', Activity],
  ['/products', 'Productos', Package],
  ['/automations', 'Automatizaciones', Workflow],
  ['/reports', 'Reportes', BarChart3],
  ['/settings', 'Configuración', Settings],
] as const

export function Sidebar() {
  const pathname = usePathname()
  return <aside className="sidebar">
    <div className="brand"><span className="brandmark">L</span><span>Lumo <small>CRM</small></span></div>
    <nav>{items.map(([href,label,Icon]) => <Link key={href} href={href} className={(href==='/'?pathname===href:pathname.startsWith(href))?'navitem active':'navitem'}><Icon size={18}/><span>{label}</span></Link>)}</nav>
    <div className="sidebar-foot"><div className="avatar">DG</div><div><strong>Mi cuenta</strong><span>Administrador</span></div></div>
  </aside>
}
