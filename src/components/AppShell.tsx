'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Plus, Bell } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Sidebar } from './Sidebar'

export function AppShell({children}:{children:React.ReactNode}) {
  const router = useRouter()
  const [ready,setReady]=useState(false)
  const [workspace,setWorkspace]=useState('Lumo CRM')
  useEffect(()=>{(async()=>{
    const {data:{user}}=await supabase.auth.getUser()
    if(!user){router.replace('/login');return}
    const {data}=await supabase.from('workspace_members').select('workspace_id, workspaces(name)').eq('user_id',user.id).eq('status','active').limit(1)
    const row:any=data?.[0]
    if(!row){router.replace('/setup');return}
    if(row?.workspaces?.name)setWorkspace(row.workspaces.name)
    setReady(true)
  })()},[router])
  if(!ready) return <div className="loading">Cargando Lumo…</div>
  return <div className="app"><Sidebar/><main className="main"><header className="topbar"><div className="search"><Search size={17}/><input placeholder="Buscar clientes, oportunidades..."/></div><div className="top-actions"><button className="create"><Plus size={17}/> Crear</button><button className="iconbtn"><Bell size={18}/></button><div className="workspace">{workspace}</div></div></header>{children}</main></div>
}
