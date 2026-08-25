'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AppShell } from '@/components/AppShell'
import { supabase } from '@/lib/supabase'
import { MessageCircle, Target, CheckCircle2, Clock3, AlertCircle, ListTodo, ArrowUpRight } from 'lucide-react'
import './dashboard.css'

type Stage={id:string;name:string;position:number;is_won:boolean;is_lost:boolean}
type Opportunity={id:string;name:string;amount:number|null;currency:string;stage_id:string|null;closed_at:string|null;created_at:string}
type Conversation={id:string;status:string;last_message_at:string|null;unread_count:number;contact_id:string|null;contacts:{first_name:string;last_name:string|null}|null}
type Task={id:string;title:string;status:string;priority:string;due_at:string|null;opportunity_id:string|null;opportunities:{name:string}|null}

export default function Dashboard(){
 const [stages,setStages]=useState<Stage[]>([])
 const [ops,setOps]=useState<Opportunity[]>([])
 const [conversations,setConversations]=useState<Conversation[]>([])
 const [tasks,setTasks]=useState<Task[]>([])
 const [error,setError]=useState('')
 useEffect(()=>{bootstrap()},[])
 async function bootstrap(){
  const {data:{user}}=await supabase.auth.getUser();if(!user)return
  const {data:mem,error:me}=await supabase.from('workspace_members').select('workspace_id').eq('user_id',user.id).eq('status','active').limit(1).single()
  if(me||!mem){setError(me?.message||'No encontramos tu espacio de trabajo.');return}
  const wid=mem.workspace_id
  const [{data:ss,error:se},{data:oo,error:oe},{data:cc,error:ce},{data:tt,error:te}]=await Promise.all([
   supabase.from('sales_stages').select('id,name,position,is_won,is_lost').eq('workspace_id',wid).order('position'),
   supabase.from('opportunities').select('id,name,amount,currency,stage_id,closed_at,created_at').eq('workspace_id',wid).order('created_at',{ascending:false}),
   supabase.from('conversations').select('id,status,last_message_at,unread_count,contact_id,contacts(first_name,last_name)').eq('workspace_id',wid).order('last_message_at',{ascending:false}).limit(8),
   supabase.from('tasks').select('id,title,status,priority,due_at,opportunity_id,opportunities(name)').eq('workspace_id',wid).order('due_at',{ascending:true,nullsFirst:false}).limit(12)
  ])
  if(se||oe||ce||te)setError(se?.message||oe?.message||ce?.message||te?.message||'No pudimos cargar el dashboard')
  setStages((ss||[]) as Stage[]);setOps((oo||[]) as Opportunity[]);setConversations((cc||[]) as unknown as Conversation[]);setTasks((tt||[]) as unknown as Task[])
 }
 const now=new Date();const monthStart=new Date(now.getFullYear(),now.getMonth(),1)
 const stageMap=useMemo(()=>Object.fromEntries(stages.map(s=>[s.id,s])),[stages])
 const openOps=ops.filter(o=>{const s=o.stage_id?stageMap[o.stage_id]:null;return !s?.is_won&&!s?.is_lost})
 const wonMonth=ops.filter(o=>{const s=o.stage_id?stageMap[o.stage_id]:null;return s?.is_won&&o.closed_at&&new Date(o.closed_at)>=monthStart})
 const openConversations=conversations.filter(c=>c.status!=='closed')
 const pendingTasks=tasks.filter(t=>!['completed','cancelled'].includes(t.status))
 const overdueTasks=pendingTasks.filter(t=>t.due_at&&new Date(t.due_at)<now)
 const todayTasks=pendingTasks.filter(t=>t.due_at&&sameDay(new Date(t.due_at),now))
 const focus=[
  ...overdueTasks.slice(0,3).map(t=>({key:'task-'+t.id,icon:'task',title:t.title,subtitle:'Tarea vencida'+(t.opportunities?.name?` · ${t.opportunities.name}`:''),href:'/tasks'})),
  ...openConversations.filter(c=>c.unread_count>0).slice(0,3).map(c=>({key:'conv-'+c.id,icon:'message',title:c.contacts?`${c.contacts.first_name} ${c.contacts.last_name||''}`:'Conversación sin identificar',subtitle:`${c.unread_count} mensaje${c.unread_count===1?'':'s'} sin leer`,href:'/inbox'})),
  ...todayTasks.slice(0,2).map(t=>({key:'today-'+t.id,icon:'today',title:t.title,subtitle:'Vence hoy',href:'/tasks'}))
 ].slice(0,6)
 const maxStage=Math.max(1,...stages.map(s=>ops.filter(o=>o.stage_id===s.id).length))
 const recentConversations=openConversations.slice(0,5)
 const nextTasks=pendingTasks.filter(t=>!overdueTasks.some(o=>o.id===t.id)).slice(0,5)
 return <AppShell><div className="page"><div className="page-head"><div><h1>Buenos días</h1><p>Esto es lo que necesita tu atención hoy.</p></div><Link href="/activity" className="secondary">Ver actividad</Link></div>
 {error&&<div className="error-banner">{error}</div>}
 <div className="stats"><div className="stat"><MessageCircle/><span>Conversaciones abiertas</span><strong>{openConversations.length}</strong><small>{openConversations.reduce((s,c)=>s+c.unread_count,0)} sin leer</small><Link className="stat-link" href="/inbox">Ir al Inbox</Link></div><div className="stat"><Target/><span>Oportunidades abiertas</span><strong>{openOps.length}</strong><small>{money(openOps.reduce((s,o)=>s+Number(o.amount||0),0))} en proceso</small><Link className="stat-link" href="/sales-process">Ver proceso</Link></div><div className="stat success"><CheckCircle2/><span>Ganadas este mes</span><strong>{wonMonth.length}</strong><small>{money(wonMonth.reduce((s,o)=>s+Number(o.amount||0),0))} cerrados</small><Link className="stat-link" href="/opportunities">Ver oportunidades</Link></div><div className={`stat ${overdueTasks.length?'alert':''}`}><Clock3/><span>Tareas pendientes</span><strong>{pendingTasks.length}</strong><small>{overdueTasks.length} vencidas</small><Link className="stat-link" href="/tasks">Ver tareas</Link></div></div>
 <div className="grid2"><section className="panel"><div className="panel-title"><div><h2>Qué necesita tu atención</h2><p>Prioridades comerciales de hoy</p></div><ArrowUpRight size={19}/></div>{focus.length===0?<div className="empty"><strong>Todo bajo control</strong><span>No hay tareas vencidas ni mensajes pendientes.</span></div>:<div className="dashboard-focus">{focus.map(item=><div className="focus-item" key={item.key}><div className="focus-icon">{item.icon==='message'?<MessageCircle size={17}/>:item.icon==='today'?<Clock3 size={17}/>:<AlertCircle size={17}/>}</div><div className="focus-copy"><strong>{item.title}</strong><span>{item.subtitle}</span></div><Link href={item.href}>Resolver</Link></div>)}</div>}</section>
 <section className="panel"><div className="panel-title"><div><h2>Proceso de ventas</h2><p>Oportunidades por etapa</p></div><Link className="inline-link" href="/sales-process">Abrir tablero</Link></div><div className="stage-summary">{stages.map(s=>{const count=ops.filter(o=>o.stage_id===s.id).length;return <div className="stage-row" key={s.id}><span>{s.name}</span><div className="stage-bar"><i style={{width:`${(count/maxStage)*100}%`}}/></div><b>{count}</b></div>})}</div></section></div>
 <div className="dashboard-bottom"><section className="panel"><div className="panel-title"><div><h2>Conversaciones recientes</h2><p>Últimos clientes en contacto</p></div><Link className="inline-link" href="/inbox">Ver todas</Link></div>{recentConversations.length===0?<div className="empty-compact">Todavía no hay conversaciones abiertas.</div>:<div className="mini-list">{recentConversations.map(c=><div className="mini-row" key={c.id}><div><strong>{c.contacts?`${c.contacts.first_name} ${c.contacts.last_name||''}`:'Contacto'}</strong><span>{c.unread_count?`${c.unread_count} sin leer`:'Al día'}</span></div><b>{c.last_message_at?formatDate(c.last_message_at):''}</b></div>)}</div>}</section>
 <section className="panel"><div className="panel-title"><div><h2>Próximas tareas</h2><p>Seguimientos que vienen</p></div><Link className="inline-link" href="/tasks">Ver todas</Link></div>{nextTasks.length===0?<div className="empty-compact">No hay tareas próximas.</div>:<div className="mini-list">{nextTasks.map(t=><div className="mini-row" key={t.id}><div><strong>{t.title}</strong><span>{t.opportunities?.name||labelPriority(t.priority)}</span></div><b>{t.due_at?formatDate(t.due_at):'Sin fecha'}</b></div>)}</div>}</section></div>
 </div></AppShell>
}
function sameDay(a:Date,b:Date){return a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate()}
function formatDate(v:string){return new Date(v).toLocaleString('es-AR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}
function money(v:number){return new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(v)}
function labelPriority(v:string){return ({low:'Prioridad baja',normal:'Prioridad normal',high:'Prioridad alta',urgent:'Prioridad urgente'} as Record<string,string>)[v]||v}
