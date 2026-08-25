'use client'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AppShell } from '@/components/AppShell'
import { Plus, Search, Mail, Phone, SlidersHorizontal, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'

type Contact={id:string;first_name:string;last_name:string|null;email:string|null;phone:string|null;lifecycle_stage:string;source:string|null;created_at:string;last_interaction_at:string|null}
const sources=['manual','instagram','facebook','mercadolibre','whatsapp','tiktok']
const stages=['lead','customer','inactive']

export default function Contacts(){
 const [contacts,setContacts]=useState<Contact[]>([])
 const [workspaceId,setWorkspaceId]=useState<string|null>(null)
 const [q,setQ]=useState('')
 const [sourceFilter,setSourceFilter]=useState('all')
 const [stageFilter,setStageFilter]=useState('all')
 const [open,setOpen]=useState(false)
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState('')
 const [form,setForm]=useState({first_name:'',last_name:'',email:'',phone:'',source:'manual',lifecycle_stage:'lead'})

 async function load(){
  const {data:{user}}=await supabase.auth.getUser(); if(!user)return
  const {data:mem}=await supabase.from('workspace_members').select('workspace_id').eq('user_id',user.id).eq('status','active').limit(1).single(); if(!mem)return
  setWorkspaceId(mem.workspace_id)
  const {data,error}=await supabase.from('contacts').select('id,first_name,last_name,email,phone,lifecycle_stage,source,created_at,last_interaction_at').eq('workspace_id',mem.workspace_id).order('created_at',{ascending:false})
  if(error)setError(error.message); else setContacts((data||[]) as Contact[])
 }
 useEffect(()=>{load()},[])
 const filtered=useMemo(()=>contacts.filter(c=>{
   const matchesQ=`${c.first_name} ${c.last_name||''} ${c.email||''} ${c.phone||''}`.toLowerCase().includes(q.toLowerCase())
   const matchesSource=sourceFilter==='all'||c.source===sourceFilter
   const matchesStage=stageFilter==='all'||c.lifecycle_stage===stageFilter
   return matchesQ&&matchesSource&&matchesStage
 }),[contacts,q,sourceFilter,stageFilter])
 async function create(e:FormEvent){
  e.preventDefault();if(!workspaceId)return;setBusy(true);setError('')
  const {data,error}=await supabase.from('contacts').insert({...form,workspace_id:workspaceId,last_name:form.last_name||null,email:form.email||null,phone:form.phone||null}).select('id,first_name,last_name,email,phone,lifecycle_stage,source,created_at,last_interaction_at').single()
  if(!error&&data){setContacts([data as Contact,...contacts]);setOpen(false);setForm({first_name:'',last_name:'',email:'',phone:'',source:'manual',lifecycle_stage:'lead'})} else if(error)setError(error.message)
  setBusy(false)
 }
 return <AppShell><div className="page"><div className="page-head"><div><h1>Contactos</h1><p>Personas, canales e historial comercial en un solo lugar.</p></div><button className="primary compact" onClick={()=>setOpen(true)}><Plus size={17}/> Nuevo contacto</button></div>
 <div className="toolbar contacts-toolbar"><div className="search local"><Search size={17}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Buscar por nombre, email o teléfono..."/></div><div className="filters"><SlidersHorizontal size={16}/><select value={sourceFilter} onChange={e=>setSourceFilter(e.target.value)}><option value="all">Todos los canales</option>{sources.map(s=><option key={s} value={s}>{labelSource(s)}</option>)}</select><select value={stageFilter} onChange={e=>setStageFilter(e.target.value)}><option value="all">Todos los estados</option>{stages.map(s=><option key={s} value={s}>{labelStage(s)}</option>)}</select></div><span className="count">{filtered.length} contactos</span></div>
 {error&&<div className="error-banner">{error}</div>}
 <section className="panel table-panel">{filtered.length===0?<div className="empty"><strong>{contacts.length?'No encontramos coincidencias':'Todavía no hay contactos'}</strong><span>{contacts.length?'Probá cambiando los filtros.':'Creá el primero o esperá a que Lumo genere uno desde una conversación.'}</span>{!contacts.length&&<button className="secondary" onClick={()=>setOpen(true)}>Crear contacto</button>}</div>:<div className="contact-list">{filtered.map(c=><Link className="contact-row contact-link" href={`/contacts/${c.id}`} key={c.id}><div className="contact-avatar">{c.first_name[0]}{c.last_name?.[0]||''}</div><div className="contact-main"><strong>{c.first_name} {c.last_name}</strong><span>{labelSource(c.source||'manual')} · {labelStage(c.lifecycle_stage)}</span></div><div className="contact-data">{c.email&&<span><Mail size={14}/>{c.email}</span>}{c.phone&&<span><Phone size={14}/>{c.phone}</span>}</div><ChevronRight size={17} className="row-arrow"/></Link>)}</div>}</section>
 {open&&<div className="modal-backdrop" onClick={()=>setOpen(false)}><div className="modal" onClick={e=>e.stopPropagation()}><div><h2>Nuevo contacto</h2><p>Agregalo al CRM de Lumo.</p></div><form onSubmit={create}><div className="form2"><label>Nombre<input required value={form.first_name} onChange={e=>setForm({...form,first_name:e.target.value})}/></label><label>Apellido<input value={form.last_name} onChange={e=>setForm({...form,last_name:e.target.value})}/></label></div><label>Email<input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></label><label>Teléfono / WhatsApp<input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/></label><div className="form2"><label>Origen<select value={form.source} onChange={e=>setForm({...form,source:e.target.value})}>{sources.map(s=><option key={s} value={s}>{labelSource(s)}</option>)}</select></label><label>Estado<select value={form.lifecycle_stage} onChange={e=>setForm({...form,lifecycle_stage:e.target.value})}>{stages.map(s=><option key={s} value={s}>{labelStage(s)}</option>)}</select></label></div><div className="modal-actions"><button type="button" className="secondary" onClick={()=>setOpen(false)}>Cancelar</button><button className="primary" disabled={busy}>{busy?'Guardando…':'Guardar contacto'}</button></div></form></div></div>}</div></AppShell>
}
function labelSource(v:string){return ({manual:'Manual',instagram:'Instagram',facebook:'Facebook',mercadolibre:'Mercado Libre',whatsapp:'WhatsApp',tiktok:'TikTok'} as Record<string,string>)[v]||v}
function labelStage(v:string){return ({lead:'Lead',customer:'Cliente',inactive:'Inactivo'} as Record<string,string>)[v]||v}
