'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AppShell } from '@/components/AppShell'
import { supabase } from '@/lib/supabase'
import { MessageCircle, Target, CheckCircle2, Clock3, AlertCircle, ArrowUpRight, Wifi, TrendingUp } from 'lucide-react'
import './dashboard.css'

type Stage={id:string;name:string;position:number;is_won:boolean;is_lost:boolean}
type Opportunity={id:string;name:string;amount:number|null;currency:string;stage_id:string|null;closed_at:string|null;created_at:string;source_channel:string|null}
type Conversation={id:string;status:string;last_message_at:string|null;unread_count:number;contact_id:string|null;contacts:{first_name:string;last_name:string|null}|null}
type Task={id:string;title:string;status:string;priority:string;due_at:string|null;opportunity_id:string|null;opportunities:{name:string}|null}

export default function Dashboard(){
 const [workspaceId,setWorkspaceId]=useState<string|null>(null)
 const [stages,setStages]=useState<Stage[]>([])
 const [ops,setOps]=useState<Opportunity[]>([])
 const [conversations,setConversations]=useState<Conversation[]>([])
 const [tasks,setTasks]=useState<Task[]>([])
 const [error,setError]=useState('')
 const [live,setLive]=useState(false)
 const [months,setMonths]=useState(6)
 useEffect(()=>{bootstrap()},[])
 async function bootstrap(){
  const {data:{user}}=await supabase.auth.getUser();if(!user)return
  const {data:mem,error:me}=await supabase.from('workspace_members').select('workspace_id').eq('user_id',user.id).eq('status','active').limit(1).single()
  if(me||!mem){setError(me?.message||'No encontramos tu espacio de trabajo.');return}
  setWorkspaceId(mem.workspace_id);await load(mem.workspace_id)
 }
 async function load(wid=workspaceId){
  if(!wid)return
  const [{data:ss,error:se},{data:oo,error:oe},{data:cc,error:ce},{data:tt,error:te}]=await Promise.all([
   supabase.from('sales_stages').select('id,name,position,is_won,is_lost').eq('workspace_id',wid).order('position'),
   supabase.from('opportunities').select('id,name,amount,currency,stage_id,closed_at,created_at,source_channel').eq('workspace_id',wid).order('created_at',{ascending:false}),
   supabase.from('conversations').select('id,status,last_message_at,unread_count,contact_id,contacts(first_name,last_name)').eq('workspace_id',wid).order('last_message_at',{ascending:false}).limit(8),
   supabase.from('tasks').select('id,title,status,priority,due_at,opportunity_id,opportunities(name)').eq('workspace_id',wid).order('due_at',{ascending:true,nullsFirst:false}).limit(12)
  ])
  if(se||oe||ce||te)setError(se?.message||oe?.message||ce?.message||te?.message||'No pudimos cargar el dashboard')
  setStages((ss||[]) as Stage[]);setOps((oo||[]) as Opportunity[]);setConversations((cc||[]) as unknown as Conversation[]);setTasks((tt||[]) as unknown as Task[])
 }
 useEffect(()=>{if(!workspaceId)return;const channel=supabase.channel(`dashboard-live-${workspaceId}`)
  .on('postgres_changes',{event:'*',schema:'public',table:'conversations',filter:`workspace_id=eq.${workspaceId}`},()=>load(workspaceId))
  .on('postgres_changes',{event:'*',schema:'public',table:'opportunities',filter:`workspace_id=eq.${workspaceId}`},()=>load(workspaceId))
  .on('postgres_changes',{event:'*',schema:'public',table:'tasks',filter:`workspace_id=eq.${workspaceId}`},()=>load(workspaceId))
  .subscribe(s=>setLive(s==='SUBSCRIBED'));return()=>{supabase.removeChannel(channel);setLive(false)}},[workspaceId])
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
 const wonStageIds=new Set(stages.filter(s=>s.is_won).map(s=>s.id))
 const salesSeries=monthSeries(months).map(m=>{const won=ops.filter(o=>o.stage_id&&wonStageIds.has(o.stage_id)&&o.closed_at&&sameMonth(new Date(o.closed_at),m.date));return {...m,count:won.length,value:won.reduce((s,o)=>s+Number(o.amount||0),0)}})
 const maxSales=Math.max(1,...salesSeries.map(x=>x.value))
 const channels=Object.entries(ops.reduce((acc,o)=>{const key=o.source_channel||'manual';acc[key]=(acc[key]||0)+1;return acc},{} as Record<string,number>)).sort((a,b)=>b[1]-a[1])
 const channelTotal=Math.max(1,channels.reduce((s,[,v])=>s+v,0))
 const stageConversion=stages.filter(s=>!s.is_lost).map(s=>({stage:s,count:ops.filter(o=>o.stage_id===s.id).length}))
 const baseCount=Math.max(1,stageConversion[0]?.count||ops.length||1)
 return <AppShell><div className="page"><div className="page-head"><div><h1>Buenos días</h1><p>Esto es lo que necesita tu atención hoy.</p></div><div style={{display:'flex',alignItems:'center',gap:9}}><span className="soft-live"><i className="live-dot"/><Wifi size={13}/>{live?'Actualización en tiempo real':'Conectando…'}</span><Link href="/activity" className="secondary">Ver actividad</Link></div></div>
 {error&&<div className="error-banner">{error}</div>}
 <div className="stats"><Link href="/inbox" className="stat interactive-card" style={{textDecoration:'none',color:'inherit'}}><MessageCircle/><span>Conversaciones abiertas</span><strong>{openConversations.length}</strong><small>{openConversations.reduce((s,c)=>s+c.unread_count,0)} sin leer</small><span className="stat-link">Ir al Inbox</span></Link><Link href="/sales-process" className="stat interactive-card" style={{textDecoration:'none',color:'inherit'}}><Target/><span>Oportunidades abiertas</span><strong>{openOps.length}</strong><small>{money(openOps.reduce((s,o)=>s+Number(o.amount||0),0))} en proceso</small><span className="stat-link">Ver proceso</span></Link><Link href="/opportunities" className="stat success interactive-card" style={{textDecoration:'none',color:'inherit'}}><CheckCircle2/><span>Ganadas este mes</span><strong>{wonMonth.length}</strong><small>{money(wonMonth.reduce((s,o)=>s+Number(o.amount||0),0))} cerrados</small><span className="stat-link">Ver oportunidades</span></Link><Link href="/tasks" className={`stat interactive-card ${overdueTasks.length?'alert':''}`} style={{textDecoration:'none',color:'inherit'}}><Clock3/><span>Tareas pendientes</span><strong>{pendingTasks.length}</strong><small>{overdueTasks.length} vencidas</small><span className="stat-link">Ver tareas</span></Link></div>

 <section className="panel analytics-panel"><div className="panel-title analytics-head"><div><h2><TrendingUp size={17}/> Rendimiento comercial</h2><p>Ventas ganadas y evolución del período</p></div><div className="period-tabs">{[3,6,12].map(n=><button key={n} className={months===n?'active':''} onClick={()=>setMonths(n)}>{n} meses</button>)}</div></div><div className="sales-chart">{salesSeries.map(x=><div className="sales-column" key={x.key} title={`${x.label}: ${money(x.value)} · ${x.count} ganadas`}><div className="sales-value">{x.value?shortMoney(x.value):'—'}</div><div className="sales-track"><i style={{height:`${Math.max(x.value?8:2,(x.value/maxSales)*100)}%`}}/></div><span>{x.short}</span></div>)}</div></section>

 <div className="analytics-grid"><Link href="/sales-process" className="panel analytics-card" style={{textDecoration:'none',color:'inherit'}}><div className="panel-title"><div><h2>Conversión por etapa</h2><p>Proporción respecto de la primera etapa</p></div><ArrowUpRight size={18}/></div><div className="conversion-list">{stageConversion.map(({stage,count})=>{const pct=Math.min(100,Math.round((count/baseCount)*100));return <div className="conversion-row" key={stage.id} title={`${stage.name}: ${count} oportunidades`}><div><span>{stage.name}</span><b>{pct}%</b></div><div className="conversion-track"><i style={{width:`${pct}%`}}/></div></div>})}</div></Link>
 <Link href="/opportunities" className="panel analytics-card" style={{textDecoration:'none',color:'inherit'}}><div className="panel-title"><div><h2>Origen de oportunidades</h2><p>Distribución por canal</p></div><ArrowUpRight size={18}/></div><div className="channel-chart">{channels.length===0?<div className="empty-compact">Todavía no hay datos de origen.</div>:channels.slice(0,6).map(([channel,count])=>{const pct=Math.round((count/channelTotal)*100);return <div className="channel-row-chart" key={channel} title={`${labelChannel(channel)}: ${count} oportunidades`}><span>{labelChannel(channel)}</span><div className="channel-meter"><i style={{width:`${pct}%`}}/></div><b>{pct}%</b></div>})}</div></Link></div>

 <div className="grid2"><section className="panel"><div className="panel-title"><div><h2>Qué necesita tu atención</h2><p>Prioridades comerciales de hoy</p></div><ArrowUpRight size={19}/></div>{focus.length===0?<div className="empty"><strong>Todo bajo control</strong><span>No hay tareas vencidas ni mensajes pendientes.</span></div>:<div className="dashboard-focus">{focus.map(item=><div className="focus-item" key={item.key}><div className="focus-icon">{item.icon==='message'?<MessageCircle size={17}/>:item.icon==='today'?<Clock3 size={17}/>:<AlertCircle size={17}/>}</div><div className="focus-copy"><strong>{item.title}</strong><span>{item.subtitle}</span></div><Link href={item.href}>Resolver</Link></div>)}</div>}</section>
 <section className="panel"><div className="panel-title"><div><h2>Proceso de ventas</h2><p>Oportunidades por etapa</p></div><Link className="inline-link" href="/sales-process">Abrir tablero</Link></div><div className="stage-summary">{stages.map(s=>{const count=ops.filter(o=>o.stage_id===s.id).length;return <div className="stage-row" key={s.id}><span>{s.name}</span><div className="stage-bar"><i style={{width:`${(count/maxStage)*100}%`}}/></div><b>{count}</b></div>})}</div></section></div>
 <div className="dashboard-bottom"><section className="panel"><div className="panel-title"><div><h2>Conversaciones recientes</h2><p>Últimos clientes en contacto</p></div><Link className="inline-link" href="/inbox">Ver todas</Link></div>{recentConversations.length===0?<div className="empty-compact">Todavía no hay conversaciones abiertas.</div>:<div className="mini-list">{recentConversations.map(c=><Link href="/inbox" className="mini-row" style={{textDecoration:'none',color:'inherit'}} key={c.id}><div><strong>{c.contacts?`${c.contacts.first_name} ${c.contacts.last_name||''}`:'Contacto'}</strong><span>{c.unread_count?`${c.unread_count} sin leer`:'Al día'}</span></div><b>{c.last_message_at?formatDate(c.last_message_at):''}</b></Link>)}</div>}</section>
 <section className="panel"><div className="panel-title"><div><h2>Próximas tareas</h2><p>Seguimientos que vienen</p></div><Link className="inline-link" href="/tasks">Ver todas</Link></div>{nextTasks.length===0?<div className="empty-compact">No hay tareas próximas.</div>:<div className="mini-list">{nextTasks.map(t=><Link href="/tasks" className="mini-row" style={{textDecoration:'none',color:'inherit'}} key={t.id}><div><strong>{t.title}</strong><span>{t.opportunities?.name||labelPriority(t.priority)}</span></div><b>{t.due_at?formatDate(t.due_at):'Sin fecha'}</b></Link>)}</div>}</section></div>
 </div></AppShell>
}
function monthSeries(n:number){const out:{date:Date;key:string;label:string;short:string}[]=[];const now=new Date();for(let i=n-1;i>=0;i--){const d=new Date(now.getFullYear(),now.getMonth()-i,1);out.push({date:d,key:`${d.getFullYear()}-${d.getMonth()}`,label:d.toLocaleDateString('es-AR',{month:'long',year:'numeric'}),short:d.toLocaleDateString('es-AR',{month:'short'}).replace('.','')})}return out}
function sameMonth(a:Date,b:Date){return a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()}
function sameDay(a:Date,b:Date){return a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate()}
function formatDate(v:string){return new Date(v).toLocaleString('es-AR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}
function money(v:number){return new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(v)}
function shortMoney(v:number){return new Intl.NumberFormat('es-AR',{notation:'compact',maximumFractionDigits:1}).format(v)}
function labelPriority(v:string){return ({low:'Prioridad baja',normal:'Prioridad normal',high:'Prioridad alta',urgent:'Prioridad urgente'} as Record<string,string>)[v]||v}
function labelChannel(v:string){return ({instagram:'Instagram',facebook:'Facebook',whatsapp:'WhatsApp',mercadolibre:'Mercado Libre',tiktok:'TikTok',email:'Email',manual:'Manual'} as Record<string,string>)[v]||v}
