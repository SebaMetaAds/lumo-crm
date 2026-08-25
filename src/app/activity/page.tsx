'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AppShell } from '@/components/AppShell'
import { supabase } from '@/lib/supabase'
import { Search, MessageCircle, CheckSquare, StickyNote, ArrowRightLeft, Activity as ActivityIcon } from 'lucide-react'
import './activity.css'

type FeedItem={id:string;type:'message'|'task'|'note'|'stage'|'activity';title:string;description:string;occurred_at:string;channel?:string|null;status?:string|null;href?:string|null;entity?:string|null}

export default function ActivityPage(){
 const [workspaceId,setWorkspaceId]=useState<string|null>(null)
 const [items,setItems]=useState<FeedItem[]>([])
 const [q,setQ]=useState('')
 const [filter,setFilter]=useState('all')
 const [error,setError]=useState('')
 const [loading,setLoading]=useState(true)
 useEffect(()=>{load()},[])
 async function load(){
  setLoading(true);setError('')
  const {data:{user}}=await supabase.auth.getUser();if(!user){setLoading(false);return}
  const {data:mem,error:me}=await supabase.from('workspace_members').select('workspace_id').eq('user_id',user.id).eq('status','active').limit(1).single()
  if(me||!mem){setError(me?.message||'No encontramos tu espacio de trabajo.');setLoading(false);return}
  setWorkspaceId(mem.workspace_id)
  const [mRes,tRes,nRes,hRes,aRes]=await Promise.all([
   supabase.from('messages').select('id,body,direction,status,sent_at,conversation_id,conversations(id,contact_id,channel_connections(channel),contacts(id,first_name,last_name))').eq('workspace_id',mem.workspace_id).order('sent_at',{ascending:false}).limit(80),
   supabase.from('tasks').select('id,title,description,status,priority,created_at,completed_at,contact_id,company_id,opportunity_id,conversation_id,contacts(id,first_name,last_name),companies(id,name),opportunities(id,name)').eq('workspace_id',mem.workspace_id).order('created_at',{ascending:false}).limit(80),
   supabase.from('notes').select('id,body,created_at,contact_id,company_id,contacts(id,first_name,last_name),companies(id,name)').eq('workspace_id',mem.workspace_id).order('created_at',{ascending:false}).limit(80),
   supabase.from('opportunity_history').select('id,field_name,old_value,new_value,created_at,opportunity_id,opportunities(id,name)').eq('workspace_id',mem.workspace_id).order('created_at',{ascending:false}).limit(80),
   supabase.from('activities').select('id,activity_type,title,description,direction,channel,occurred_at,contact_id,company_id,contacts(id,first_name,last_name),companies(id,name)').eq('workspace_id',mem.workspace_id).order('occurred_at',{ascending:false}).limit(80)
  ])
  const errs=[mRes.error,tRes.error,nRes.error,hRes.error,aRes.error].filter(Boolean)
  if(errs.length)setError(errs[0]!.message)
  const feed:FeedItem[]=[]
  ;(mRes.data||[]).forEach((m:any)=>{const c=m.conversations?.contacts;const who=c?`${c.first_name} ${c.last_name||''}`.trim():'Contacto';feed.push({id:`m-${m.id}`,type:'message',title:m.direction==='incoming'?`Mensaje recibido de ${who}`:`Mensaje enviado a ${who}`,description:m.body||'Mensaje sin texto',occurred_at:m.sent_at,channel:m.conversations?.channel_connections?.channel||null,status:m.status,href:m.conversation_id?'/inbox':null,entity:'Conversación'})})
  ;(tRes.data||[]).forEach((t:any)=>{const related=t.opportunities?.name||t.companies?.name||(t.contacts?`${t.contacts.first_name} ${t.contacts.last_name||''}`.trim():null);feed.push({id:`t-${t.id}`,type:'task',title:t.status==='completed'?`Tarea completada: ${t.title}`:`Tarea creada: ${t.title}`,description:t.description||related||`Prioridad ${labelPriority(t.priority)}`,occurred_at:t.completed_at||t.created_at,status:t.status,href:t.opportunity_id?`/opportunities/${t.opportunity_id}`:t.contact_id?`/contacts/${t.contact_id}`:t.company_id?`/companies/${t.company_id}`:'/tasks',entity:related||'Tarea'})})
  ;(nRes.data||[]).forEach((n:any)=>{const related=n.companies?.name||(n.contacts?`${n.contacts.first_name} ${n.contacts.last_name||''}`.trim():'Registro');feed.push({id:`n-${n.id}`,type:'note',title:`Nota agregada en ${related}`,description:n.body,occurred_at:n.created_at,href:n.contact_id?`/contacts/${n.contact_id}`:n.company_id?`/companies/${n.company_id}`:null,entity:related})})
  ;(hRes.data||[]).forEach((h:any)=>{const op=h.opportunities?.name||'Oportunidad';feed.push({id:`h-${h.id}`,type:'stage',title:`Cambio en ${op}`,description:h.field_name==='stage'?`${h.old_value||'Sin etapa'} → ${h.new_value||'Sin etapa'}`:`${h.field_name}: ${h.old_value||'—'} → ${h.new_value||'—'}`,occurred_at:h.created_at,href:h.opportunity_id?`/opportunities/${h.opportunity_id}`:null,entity:op})})
  ;(aRes.data||[]).forEach((a:any)=>{const related=a.companies?.name||(a.contacts?`${a.contacts.first_name} ${a.contacts.last_name||''}`.trim():null);feed.push({id:`a-${a.id}`,type:'activity',title:a.title||labelActivity(a.activity_type),description:a.description||related||'Actividad registrada',occurred_at:a.occurred_at,channel:a.channel,href:a.contact_id?`/contacts/${a.contact_id}`:a.company_id?`/companies/${a.company_id}`:null,entity:related})})
  feed.sort((a,b)=>new Date(b.occurred_at).getTime()-new Date(a.occurred_at).getTime())
  setItems(feed.slice(0,200));setLoading(false)
 }
 const filtered=useMemo(()=>items.filter(i=>{const text=`${i.title} ${i.description} ${i.channel||''} ${i.entity||''}`.toLowerCase();return text.includes(q.toLowerCase())&&(filter==='all'||i.type===filter)}),[items,q,filter])
 const counts=useMemo(()=>({messages:items.filter(i=>i.type==='message').length,tasks:items.filter(i=>i.type==='task').length,notes:items.filter(i=>i.type==='note').length,changes:items.filter(i=>i.type==='stage').length}),[items])
 return <AppShell><div className="page activity-page"><div className="page-head"><div><h1>Actividad</h1><p>Todo lo que pasa en tu CRM, ordenado en una sola línea de tiempo.</p></div></div>
 {error&&<div className="error-banner">{error}</div>}
 <div className="activity-summary"><div className="stat-card"><span>Mensajes</span><strong>{counts.messages}</strong></div><div className="stat-card"><span>Tareas</span><strong>{counts.tasks}</strong></div><div className="stat-card"><span>Notas</span><strong>{counts.notes}</strong></div><div className="stat-card"><span>Cambios comerciales</span><strong>{counts.changes}</strong></div></div>
 <div className="activity-toolbar"><div className="search"><Search size={16}/><input placeholder="Buscar actividad, contacto, empresa..." value={q} onChange={e=>setQ(e.target.value)}/></div><select value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">Toda la actividad</option><option value="message">Mensajes</option><option value="task">Tareas</option><option value="note">Notas</option><option value="stage">Cambios de oportunidad</option><option value="activity">Otras actividades</option></select></div>
 <section className="activity-feed">{loading?<div className="activity-empty">Cargando actividad…</div>:filtered.length===0?<div className="activity-empty"><div><strong>No encontramos actividad</strong><p>Probá cambiando la búsqueda o el filtro.</p></div></div>:filtered.map(i=><article className="activity-item" key={i.id}><div className={`activity-icon ${i.type}`}>{icon(i.type)}</div><div className="activity-copy"><h3>{i.title}</h3><p>{i.description}</p><div className="activity-meta"><span className="activity-chip">{labelType(i.type)}</span>{i.channel&&<span className="activity-chip">{labelChannel(i.channel)}</span>}{i.status&&<span className="activity-chip">{labelStatus(i.status)}</span>}{i.href&&<Link className="activity-link" href={i.href}>Abrir {i.entity||'registro'} →</Link>}</div></div><time className="activity-time">{formatDate(i.occurred_at)}</time></article>)}</section>
 </div></AppShell>
}
function icon(t:FeedItem['type']){if(t==='message')return <MessageCircle size={17}/>;if(t==='task')return <CheckSquare size={17}/>;if(t==='note')return <StickyNote size={17}/>;if(t==='stage')return <ArrowRightLeft size={17}/>;return <ActivityIcon size={17}/>}
function labelType(v:string){return ({message:'Mensaje',task:'Tarea',note:'Nota',stage:'Oportunidad',activity:'Actividad'} as Record<string,string>)[v]||v}
function labelChannel(v:string){return ({instagram:'Instagram',facebook:'Facebook',whatsapp:'WhatsApp',mercadolibre:'Mercado Libre',tiktok:'TikTok',email:'Email',manual:'Manual'} as Record<string,string>)[v]||v}
function labelStatus(v:string){return ({open:'Abierta',in_progress:'En curso',completed:'Completada',cancelled:'Cancelada',sent:'Enviado',delivered:'Entregado',read:'Leído',received:'Recibido',failed:'Fallido'} as Record<string,string>)[v]||v}
function labelPriority(v:string){return ({low:'baja',normal:'normal',high:'alta',urgent:'urgente'} as Record<string,string>)[v]||v}
function labelActivity(v:string){return ({message:'Mensaje',call:'Llamada',meeting:'Reunión',email:'Email',note:'Nota'} as Record<string,string>)[v]||'Actividad'}
function formatDate(v:string){const d=new Date(v);const today=new Date();if(d.toDateString()===today.toDateString())return `Hoy, ${d.toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'})}`;return d.toLocaleString('es-AR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}
