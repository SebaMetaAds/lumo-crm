'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AppShell } from '@/components/AppShell'
import { supabase } from '@/lib/supabase'
import { Search,ChevronRight } from 'lucide-react'

type Stage={id:string;name:string;position:number;is_won:boolean;is_lost:boolean}
type Contact={id:string;first_name:string;last_name:string|null}
type Opportunity={id:string;name:string;amount:number|null;currency:string;source_channel:string|null;expected_close_date:string|null;created_at:string;stage_id:string|null;contacts:Contact|null;sales_stages:Stage|null}

export default function Opportunities(){
 const [workspaceId,setWorkspaceId]=useState<string|null>(null)
 const [rows,setRows]=useState<Opportunity[]>([])
 const [q,setQ]=useState('')
 const [stageFilter,setStageFilter]=useState('all')
 const [stages,setStages]=useState<Stage[]>([])
 const [error,setError]=useState('')
 useEffect(()=>{bootstrap()},[])
 async function bootstrap(){
  const {data:{user}}=await supabase.auth.getUser();if(!user)return
  const {data:mem,error:me}=await supabase.from('workspace_members').select('workspace_id').eq('user_id',user.id).eq('status','active').limit(1).single()
  if(me||!mem){setError(me?.message||'No encontramos tu espacio de trabajo.');return}
  setWorkspaceId(mem.workspace_id)
  const [{data:ss},{data:ops,error:oe}]=await Promise.all([
   supabase.from('sales_stages').select('id,name,position,is_won,is_lost').eq('workspace_id',mem.workspace_id).order('position'),
   supabase.from('opportunities').select('id,name,amount,currency,source_channel,expected_close_date,created_at,stage_id,contacts(id,first_name,last_name),sales_stages(id,name,position,is_won,is_lost)').eq('workspace_id',mem.workspace_id).order('created_at',{ascending:false})
  ])
  setStages((ss||[]) as Stage[]);if(oe)setError(oe.message);else setRows((ops||[]) as unknown as Opportunity[])
 }
 const filtered=useMemo(()=>rows.filter(o=>{
  const contact=o.contacts?`${o.contacts.first_name} ${o.contacts.last_name||''}`:''
  const text=`${o.name} ${contact} ${o.source_channel||''}`.toLowerCase()
  return text.includes(q.toLowerCase())&&(stageFilter==='all'||o.stage_id===stageFilter)
 }),[rows,q,stageFilter])
 const total=filtered.reduce((s,o)=>s+Number(o.amount||0),0)
 return <AppShell><div className="page"><div className="page-head"><div><h1>Oportunidades</h1><p>Ventas en seguimiento desde conversaciones y contactos.</p></div></div>
 {error&&<div className="error-banner">{error}</div>}
 <div className="stats-grid"><div className="stat-card"><span>Oportunidades</span><strong>{filtered.length}</strong></div><div className="stat-card"><span>Valor abierto</span><strong>{new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(total)}</strong></div></div>
 <section className="panel"><div className="inbox-list-head"><div className="search local"><Search size={16}/><input placeholder="Buscar oportunidades..." value={q} onChange={e=>setQ(e.target.value)}/></div><select value={stageFilter} onChange={e=>setStageFilter(e.target.value)}><option value="all">Todas las etapas</option>{stages.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
 <div className="conversation-list">{filtered.length===0?<div className="mini-empty">Todavía no hay oportunidades.</div>:filtered.map(o=><Link href={`/opportunities/${o.id}`} key={o.id} className="conversation-item" style={{textDecoration:'none'}}><div className="conversation-copy"><div><strong>{o.name}</strong><small>{o.expected_close_date?new Date(o.expected_close_date+'T12:00:00').toLocaleDateString('es-AR'):''}</small></div><span>{o.sales_stages?.name||'Sin etapa'} · {o.source_channel||'Sin canal'}</span><p>{o.contacts?`${o.contacts.first_name} ${o.contacts.last_name||''}`:'Sin contacto'} · {o.amount?new Intl.NumberFormat('es-AR',{style:'currency',currency:o.currency||'ARS',maximumFractionDigits:0}).format(Number(o.amount)):'Monto a definir'}</p></div><ChevronRight size={17} className="row-arrow"/></Link>)}</div>
 </section></div></AppShell>
}
