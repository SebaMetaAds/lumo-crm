'use client'
import './sales-process.css'
import { DragEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AppShell } from '@/components/AppShell'
import { supabase } from '@/lib/supabase'
import { GripVertical, MessageCircle, UserRound, Search, Wifi, ArrowUpRight } from 'lucide-react'

type Stage={id:string;name:string;position:number;probability:number;is_won:boolean;is_lost:boolean}
type Contact={id:string;first_name:string;last_name:string|null}
type Opportunity={id:string;name:string;amount:number|null;currency:string;source_channel:string|null;stage_id:string|null;owner_id:string|null;conversation_id:string|null;expected_close_date:string|null;contacts:Contact|null}
type Member={user_id:string;role:string;profiles:{full_name:string|null}|null}

export default function SalesProcess(){
 const [workspaceId,setWorkspaceId]=useState<string|null>(null)
 const [userId,setUserId]=useState<string|null>(null)
 const [stages,setStages]=useState<Stage[]>([])
 const [ops,setOps]=useState<Opportunity[]>([])
 const [members,setMembers]=useState<Member[]>([])
 const [dragging,setDragging]=useState<string|null>(null)
 const [overStage,setOverStage]=useState<string|null>(null)
 const [busyId,setBusyId]=useState<string|null>(null)
 const [error,setError]=useState('')
 const [q,setQ]=useState('')
 const [ownerFilter,setOwnerFilter]=useState('all')
 const [channelFilter,setChannelFilter]=useState('all')
 const [live,setLive]=useState(false)
 useEffect(()=>{bootstrap()},[])
 async function bootstrap(){
  const {data:{user}}=await supabase.auth.getUser();if(!user)return;setUserId(user.id)
  const {data:mem,error:me}=await supabase.from('workspace_members').select('workspace_id').eq('user_id',user.id).eq('status','active').limit(1).single()
  if(me||!mem){setError(me?.message||'No encontramos tu espacio de trabajo.');return}
  setWorkspaceId(mem.workspace_id);await load(mem.workspace_id)
 }
 async function load(wid=workspaceId){if(!wid)return;const [{data:ss,error:se},{data:oo,error:oe},{data:mm}]=await Promise.all([
   supabase.from('sales_stages').select('id,name,position,probability,is_won,is_lost').eq('workspace_id',wid).order('position'),
   supabase.from('opportunities').select('id,name,amount,currency,source_channel,stage_id,owner_id,conversation_id,expected_close_date,contacts(id,first_name,last_name)').eq('workspace_id',wid).order('created_at',{ascending:false}),
   supabase.from('workspace_members').select('user_id,role,profiles(full_name)').eq('workspace_id',wid).eq('status','active')
  ]);if(se)setError(se.message);else setStages((ss||[]) as Stage[]);if(oe)setError(oe.message);else setOps((oo||[]) as unknown as Opportunity[]);setMembers((mm||[]) as unknown as Member[])}
 useEffect(()=>{if(!workspaceId)return;const channel=supabase.channel(`sales-process-live-${workspaceId}`).on('postgres_changes',{event:'*',schema:'public',table:'opportunities',filter:`workspace_id=eq.${workspaceId}`},()=>load(workspaceId)).subscribe(s=>setLive(s==='SUBSCRIBED'));return()=>{supabase.removeChannel(channel);setLive(false)}},[workspaceId])
 const memberNames=useMemo(()=>Object.fromEntries(members.map(m=>[m.user_id,m.profiles?.full_name||'Usuario'])),[members])
 const filteredOps=useMemo(()=>ops.filter(op=>{const contact=op.contacts?`${op.contacts.first_name} ${op.contacts.last_name||''}`:'';const text=`${op.name} ${contact} ${op.source_channel||''}`.toLowerCase();return text.includes(q.toLowerCase())&&(ownerFilter==='all'||(ownerFilter==='unassigned'?!op.owner_id:op.owner_id===ownerFilter))&&(channelFilter==='all'||op.source_channel===channelFilter)}),[ops,q,ownerFilter,channelFilter])
 async function moveOpportunity(op:Opportunity,stage:Stage){
  if(!workspaceId||busyId||op.stage_id===stage.id)return
  const oldStage=stages.find(s=>s.id===op.stage_id)||null
  setBusyId(op.id);setError('')
  const now=new Date().toISOString();const patch:any={stage_id:stage.id,probability:stage.probability}
  if(stage.is_won||stage.is_lost)patch.closed_at=now;else patch.closed_at=null
  if(!stage.is_lost)patch.loss_reason=null
  const {error:ue}=await supabase.from('opportunities').update(patch).eq('id',op.id).eq('workspace_id',workspaceId)
  if(ue){setError(ue.message);setBusyId(null);return}
  const {error:he}=await supabase.from('opportunity_history').insert({workspace_id:workspaceId,opportunity_id:op.id,changed_by:userId,field_name:'stage',old_value:oldStage?.name||null,new_value:stage.name})
  if(he)setError(he.message)
  setOps(v=>v.map(x=>x.id===op.id?{...x,stage_id:stage.id}:x));setBusyId(null)
 }
 function onDragStart(e:DragEvent,op:Opportunity){setDragging(op.id);e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',op.id)}
 function onDrop(e:DragEvent,stage:Stage){e.preventDefault();const id=e.dataTransfer.getData('text/plain')||dragging;const op=ops.find(o=>o.id===id);setDragging(null);setOverStage(null);if(op)moveOpportunity(op,stage)}
 const totalOpen=filteredOps.filter(o=>!stages.find(s=>s.id===o.stage_id)?.is_lost).reduce((sum,o)=>sum+Number(o.amount||0),0)
 const channels=[...new Set(ops.map(o=>o.source_channel).filter(Boolean))] as string[]
 return <AppShell><div className="page sales-process-page"><div className="page-head"><div><h1>Proceso de ventas</h1><p>Mové oportunidades entre etapas y seguí cada venta visualmente.</p></div><span className="soft-live"><i className="live-dot"/><Wifi size={13}/>{live?'Tablero en vivo':'Conectando…'}</span></div>
 {error&&<div className="error-banner">{error}</div>}
 <div className="stats-grid"><div className="stat-card interactive-card"><span>Oportunidades visibles</span><strong>{filteredOps.length}</strong></div><div className="stat-card interactive-card"><span>Valor en proceso</span><strong>{money(totalOpen)}</strong></div></div>
 <div className="panel" style={{padding:12,marginBottom:14,display:'flex',gap:9,alignItems:'center',flexWrap:'wrap'}}><div className="search local" style={{minWidth:260,flex:'1 1 320px'}}><Search size={16}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Buscar oportunidad o contacto..."/></div><select value={ownerFilter} onChange={e=>setOwnerFilter(e.target.value)}><option value="all">Todos los responsables</option><option value="unassigned">Sin asignar</option>{members.map(m=><option key={m.user_id} value={m.user_id}>{memberNames[m.user_id]}</option>)}</select><select value={channelFilter} onChange={e=>setChannelFilter(e.target.value)}><option value="all">Todos los canales</option>{channels.map(c=><option key={c} value={c}>{labelChannel(c)}</option>)}</select>{(q||ownerFilter!=='all'||channelFilter!=='all')&&<button className="secondary compact" onClick={()=>{setQ('');setOwnerFilter('all');setChannelFilter('all')}}>Limpiar filtros</button>}</div>
 <div className="kanban-wrap"><div className="kanban-board">{stages.map(stage=>{const stageOps=filteredOps.filter(o=>o.stage_id===stage.id);const total=stageOps.reduce((s,o)=>s+Number(o.amount||0),0);return <section key={stage.id} className={`kanban-column ${overStage===stage.id?'drag-over':''} ${stage.is_won?'won-column':''} ${stage.is_lost?'lost-column':''}`} onDragOver={e=>{e.preventDefault();e.dataTransfer.dropEffect='move';setOverStage(stage.id)}} onDragLeave={()=>setOverStage(null)} onDrop={e=>onDrop(e,stage)}>
 <div className="kanban-head"><div><strong>{stage.name}</strong><span>{stageOps.length} oportunidades · {stage.probability}%</span></div><b>{money(total)}</b></div>
 <div className="kanban-cards">{stageOps.length===0?<div className="kanban-empty">{filteredOps.length===0?'No hay resultados':'Soltá una oportunidad acá'}</div>:stageOps.map(op=><article key={op.id} className={`deal-card ${dragging===op.id?'dragging':''} ${busyId===op.id?'saving':''}`} draggable onDragStart={e=>onDragStart(e,op)} onDragEnd={()=>{setDragging(null);setOverStage(null)}}>
  <div className="deal-top"><span className="deal-grip"><GripVertical size={16}/></span><strong>{op.name}</strong><Link href={`/opportunities/${op.id}`} className="iconbtn" style={{width:30,height:30,display:'grid',placeItems:'center'}} title="Abrir oportunidad"><ArrowUpRight size={13}/></Link></div>
  <div className="deal-amount">{op.amount?money(Number(op.amount),op.currency):'Monto a definir'}</div>
  <div className="deal-meta">{op.contacts&&<span><UserRound size={14}/>{op.contacts.first_name} {op.contacts.last_name||''}</span>}{op.conversation_id&&<span><MessageCircle size={14}/> Conversación vinculada</span>}</div>
  <div className="deal-foot"><span className="channel-chip">{labelChannel(op.source_channel)}</span><span>{op.owner_id?memberNames[op.owner_id]||'Responsable':'Sin asignar'}</span></div>
 </article>)}</div>
 </section>})}</div></div>
 <div className="process-help">Arrastrá una tarjeta a otra columna para actualizar la etapa. Los cambios aparecen en tiempo real y quedan guardados en el historial.</div>
 </div></AppShell>
}
function money(v:number,currency='ARS'){return new Intl.NumberFormat('es-AR',{style:'currency',currency:currency||'ARS',maximumFractionDigits:0}).format(v)}
function labelChannel(v:string|null){return ({instagram:'Instagram',facebook:'Facebook',whatsapp:'WhatsApp',mercadolibre:'Mercado Libre',tiktok:'TikTok',email:'Email',manual:'Manual'} as Record<string,string>)[v||'']||v||'Sin canal'}
