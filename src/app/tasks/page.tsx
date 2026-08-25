'use client'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import { AppShell } from '@/components/AppShell'
import { supabase } from '@/lib/supabase'
import { Check, Clock3, Plus, Search, AlertTriangle } from 'lucide-react'
import './tasks.css'

type Contact={id:string;first_name:string;last_name:string|null}
type Opportunity={id:string;name:string;contact_id:string|null;contacts:Contact|null}
type Member={user_id:string;role:string;profiles:{full_name:string|null}|null}
type Task={id:string;title:string;description:string|null;assigned_to:string|null;contact_id:string|null;opportunity_id:string|null;conversation_id:string|null;due_at:string|null;priority:string;status:string;completed_at:string|null;created_at:string;contacts:Contact|null;opportunities:{id:string;name:string}|null}

export default function Tasks(){
 const [workspaceId,setWorkspaceId]=useState<string|null>(null)
 const [userId,setUserId]=useState<string|null>(null)
 const [tasks,setTasks]=useState<Task[]>([])
 const [opportunities,setOpportunities]=useState<Opportunity[]>([])
 const [members,setMembers]=useState<Member[]>([])
 const [q,setQ]=useState('')
 const [filter,setFilter]=useState('open')
 const [openNew,setOpenNew]=useState(false)
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState('')
 const [form,setForm]=useState({title:'',description:'',opportunity_id:'',assigned_to:'',due_at:'',priority:'normal'})
 useEffect(()=>{bootstrap()},[])
 async function bootstrap(){
  const {data:{user}}=await supabase.auth.getUser();if(!user)return;setUserId(user.id)
  const {data:mem,error:me}=await supabase.from('workspace_members').select('workspace_id').eq('user_id',user.id).eq('status','active').limit(1).single()
  if(me||!mem){setError(me?.message||'No encontramos tu espacio de trabajo.');return}
  setWorkspaceId(mem.workspace_id)
  const [{data:tt,error:te},{data:oo},{data:mm}]=await Promise.all([
   supabase.from('tasks').select('id,title,description,assigned_to,contact_id,opportunity_id,conversation_id,due_at,priority,status,completed_at,created_at,contacts(id,first_name,last_name),opportunities(id,name)').eq('workspace_id',mem.workspace_id).order('due_at',{ascending:true,nullsFirst:false}).order('created_at',{ascending:false}),
   supabase.from('opportunities').select('id,name,contact_id,contacts(id,first_name,last_name)').eq('workspace_id',mem.workspace_id).order('created_at',{ascending:false}),
   supabase.from('workspace_members').select('user_id,role,profiles(full_name)').eq('workspace_id',mem.workspace_id).eq('status','active')
  ])
  if(te)setError(te.message);else setTasks((tt||[]) as unknown as Task[])
  setOpportunities((oo||[]) as unknown as Opportunity[]);setMembers((mm||[]) as unknown as Member[])
  setForm(v=>({...v,assigned_to:user.id}))
 }
 const memberNames=useMemo(()=>Object.fromEntries(members.map(m=>[m.user_id,m.profiles?.full_name||'Usuario'])),[members])
 const filtered=useMemo(()=>tasks.filter(t=>{
  const text=`${t.title} ${t.description||''} ${t.opportunities?.name||''} ${t.contacts?`${t.contacts.first_name} ${t.contacts.last_name||''}`:''}`.toLowerCase()
  const matchesText=text.includes(q.toLowerCase())
  const matchesFilter=filter==='all'||(filter==='open'&&['open','in_progress'].includes(t.status))||t.status===filter
  return matchesText&&matchesFilter
 }),[tasks,q,filter])
 const now=new Date()
 const startToday=new Date(now.getFullYear(),now.getMonth(),now.getDate())
 const endToday=new Date(now.getFullYear(),now.getMonth(),now.getDate()+1)
 const openTasks=tasks.filter(t=>['open','in_progress'].includes(t.status))
 const overdue=openTasks.filter(t=>t.due_at&&new Date(t.due_at)<startToday).length
 const today=openTasks.filter(t=>t.due_at&&new Date(t.due_at)>=startToday&&new Date(t.due_at)<endToday).length
 const upcoming=openTasks.filter(t=>t.due_at&&new Date(t.due_at)>=endToday).length
 async function createTask(e:FormEvent){
  e.preventDefault();if(!workspaceId||!userId||!form.title.trim())return;setBusy(true);setError('')
  const opp=opportunities.find(o=>o.id===form.opportunity_id)||null
  const payload={workspace_id:workspaceId,title:form.title.trim(),description:form.description.trim()||null,assigned_to:form.assigned_to||null,opportunity_id:form.opportunity_id||null,contact_id:opp?.contact_id||null,due_at:form.due_at?new Date(form.due_at).toISOString():null,priority:form.priority,status:'open',created_by:userId}
  const {data,error}=await supabase.from('tasks').insert(payload).select('id,title,description,assigned_to,contact_id,opportunity_id,conversation_id,due_at,priority,status,completed_at,created_at,contacts(id,first_name,last_name),opportunities(id,name)').single()
  if(error)setError(error.message);else{setTasks(v=>[data as unknown as Task,...v]);setOpenNew(false);setForm({title:'',description:'',opportunity_id:'',assigned_to:userId,due_at:'',priority:'normal'})}
  setBusy(false)
 }
 async function updateTask(task:Task,patch:Record<string,any>){
  if(!workspaceId)return;setError('')
  const normalized={...patch}
  if(patch.status==='completed')normalized.completed_at=new Date().toISOString()
  if(patch.status&&patch.status!=='completed')normalized.completed_at=null
  const {error}=await supabase.from('tasks').update(normalized).eq('id',task.id).eq('workspace_id',workspaceId)
  if(error)setError(error.message);else setTasks(v=>v.map(t=>t.id===task.id?{...t,...normalized}:t))
 }
 return <AppShell><div className="page tasks-page"><div className="page-head"><div><h1>Tareas</h1><p>Seguimientos y pendientes comerciales en un solo lugar.</p></div><button className="primary compact" onClick={()=>setOpenNew(true)}><Plus size={17}/> Nueva tarea</button></div>
 {error&&<div className="error-banner">{error}</div>}
 <div className="task-stats"><button onClick={()=>setFilter('open')}><span>Pendientes</span><strong>{openTasks.length}</strong></button><button className="danger-stat" onClick={()=>setFilter('open')}><span>Vencidas</span><strong>{overdue}</strong></button><button onClick={()=>setFilter('open')}><span>Para hoy</span><strong>{today}</strong></button><button onClick={()=>setFilter('open')}><span>Próximas</span><strong>{upcoming}</strong></button></div>
 <section className="panel task-panel"><div className="task-toolbar"><div className="search local"><Search size={16}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Buscar tareas..."/></div><div className="task-tabs"><button className={filter==='open'?'active':''} onClick={()=>setFilter('open')}>Pendientes</button><button className={filter==='in_progress'?'active':''} onClick={()=>setFilter('in_progress')}>En curso</button><button className={filter==='completed'?'active':''} onClick={()=>setFilter('completed')}>Completadas</button><button className={filter==='all'?'active':''} onClick={()=>setFilter('all')}>Todas</button></div></div>
 <div className="task-list">{filtered.length===0?<div className="mini-empty">No hay tareas para este filtro.</div>:filtered.map(t=>{const late=t.due_at&&['open','in_progress'].includes(t.status)&&new Date(t.due_at)<startToday;return <article key={t.id} className={`task-row ${t.status==='completed'?'done':''}`}><button className="task-check" onClick={()=>updateTask(t,{status:t.status==='completed'?'open':'completed'})}>{t.status==='completed'?<Check size={16}/>:null}</button><div className="task-copy"><div className="task-title-line"><strong>{t.title}</strong><span className={`priority-chip ${t.priority}`}>{priorityLabel(t.priority)}</span>{late&&<span className="late-chip"><AlertTriangle size={12}/> Vencida</span>}</div>{t.description&&<p>{t.description}</p>}<div className="task-meta">{t.opportunities&&<span>Oportunidad: {t.opportunities.name}</span>}{t.contacts&&<span>Contacto: {t.contacts.first_name} {t.contacts.last_name||''}</span>}<span>Responsable: {t.assigned_to?memberNames[t.assigned_to]||'Usuario':'Sin asignar'}</span></div></div><div className="task-side"><div className={late?'due late':''}><Clock3 size={14}/>{t.due_at?new Date(t.due_at).toLocaleString('es-AR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'Sin vencimiento'}</div><select value={t.status} onChange={e=>updateTask(t,{status:e.target.value})}><option value="open">Pendiente</option><option value="in_progress">En curso</option><option value="completed">Completada</option><option value="cancelled">Cancelada</option></select></div></article>})}</div></section>
 {openNew&&<div className="modal-backdrop" onClick={()=>setOpenNew(false)}><div className="modal" onClick={e=>e.stopPropagation()}><div><h2>Nueva tarea</h2><p>Creá un seguimiento y vinculalo a una oportunidad.</p></div><form onSubmit={createTask}><label>Título<input required value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Ej: Enviar cotización"/></label><label>Descripción<textarea className="modal-textarea" value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Detalle opcional"/></label><label>Oportunidad<select value={form.opportunity_id} onChange={e=>setForm({...form,opportunity_id:e.target.value})}><option value="">Sin oportunidad</option>{opportunities.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></label><div className="form2"><label>Responsable<select value={form.assigned_to} onChange={e=>setForm({...form,assigned_to:e.target.value})}><option value="">Sin asignar</option>{members.map(m=><option key={m.user_id} value={m.user_id}>{m.profiles?.full_name||'Usuario'}</option>)}</select></label><label>Prioridad<select value={form.priority} onChange={e=>setForm({...form,priority:e.target.value})}><option value="low">Baja</option><option value="normal">Normal</option><option value="high">Alta</option><option value="urgent">Urgente</option></select></label></div><label>Vencimiento<input type="datetime-local" value={form.due_at} onChange={e=>setForm({...form,due_at:e.target.value})}/></label><div className="modal-actions"><button type="button" className="secondary" onClick={()=>setOpenNew(false)}>Cancelar</button><button className="primary" disabled={busy}>{busy?'Creando…':'Crear tarea'}</button></div></form></div></div>}
 </div></AppShell>
}
function priorityLabel(v:string){return ({low:'Baja',normal:'Normal',high:'Alta',urgent:'Urgente'} as Record<string,string>)[v]||v}
