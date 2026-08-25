'use client'
import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { AppShell } from '@/components/AppShell'
import { ArrowLeft, Building2, Mail, Phone, Pencil, Plus, StickyNote, UserRound } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import '../companies.css'

type Company={id:string;workspace_id:string;name:string;legal_name:string|null;industry:string|null;website:string|null;email:string|null;phone:string|null;city:string|null;country:string|null;status:string;created_at:string}
type Contact={id:string;first_name:string;last_name:string|null;job_title:string|null;email:string|null;phone:string|null}
type Opportunity={id:string;name:string;amount:number|null;currency:string;stage_id:string|null;sales_stages:{name:string}|null}
type Note={id:string;body:string;created_at:string}
const statuses=['prospect','customer','active','inactive']

export default function CompanyDetail(){
 const {id}=useParams<{id:string}>()
 const [company,setCompany]=useState<Company|null>(null)
 const [contacts,setContacts]=useState<Contact[]>([])
 const [available,setAvailable]=useState<Contact[]>([])
 const [opps,setOpps]=useState<Opportunity[]>([])
 const [notes,setNotes]=useState<Note[]>([])
 const [edit,setEdit]=useState(false),[linkOpen,setLinkOpen]=useState(false),[busy,setBusy]=useState(false)
 const [error,setError]=useState(''),[noteText,setNoteText]=useState(''),[contactId,setContactId]=useState('')
 const [form,setForm]=useState({name:'',legal_name:'',industry:'',website:'',email:'',phone:'',city:'',country:'',status:'prospect'})
 async function load(){
  const {data:c,error}=await supabase.from('companies').select('id,workspace_id,name,legal_name,industry,website,email,phone,city,country,status,created_at').eq('id',id).single();if(error||!c){setError(error?.message||'Empresa no encontrada');return}
  setCompany(c as Company);setForm({name:c.name,legal_name:c.legal_name||'',industry:c.industry||'',website:c.website||'',email:c.email||'',phone:c.phone||'',city:c.city||'',country:c.country||'',status:c.status})
  const [{data:cs},{data:av},{data:os},{data:ns}]=await Promise.all([
   supabase.from('contacts').select('id,first_name,last_name,job_title,email,phone').eq('company_id',id).order('first_name'),
   supabase.from('contacts').select('id,first_name,last_name,job_title,email,phone').eq('workspace_id',c.workspace_id).is('company_id',null).order('first_name'),
   supabase.from('opportunities').select('id,name,amount,currency,stage_id,sales_stages(name)').eq('company_id',id).order('created_at',{ascending:false}),
   supabase.from('notes').select('id,body,created_at').eq('company_id',id).order('created_at',{ascending:false})
  ])
  setContacts((cs||[]) as Contact[]);setAvailable((av||[]) as Contact[]);setOpps((os||[]) as unknown as Opportunity[]);setNotes((ns||[]) as Note[])
 }
 useEffect(()=>{load()},[id])
 async function save(e:FormEvent){e.preventDefault();if(!company)return;setBusy(true);const {error}=await supabase.from('companies').update({name:form.name,legal_name:form.legal_name||null,industry:form.industry||null,website:form.website||null,email:form.email||null,phone:form.phone||null,city:form.city||null,country:form.country||null,status:form.status}).eq('id',company.id);if(error)setError(error.message);else{setEdit(false);await load()}setBusy(false)}
 async function linkContact(e:FormEvent){e.preventDefault();if(!contactId||!company)return;setBusy(true);const {error}=await supabase.from('contacts').update({company_id:company.id}).eq('id',contactId).eq('workspace_id',company.workspace_id);if(error)setError(error.message);else{setContactId('');setLinkOpen(false);await load()}setBusy(false)}
 async function unlinkContact(cid:string){if(!company)return;const {error}=await supabase.from('contacts').update({company_id:null}).eq('id',cid).eq('workspace_id',company.workspace_id);if(error)setError(error.message);else await load()}
 async function addNote(e:FormEvent){e.preventDefault();if(!company||!noteText.trim())return;setBusy(true);const {data:{user}}=await supabase.auth.getUser();if(!user)return;const {error}=await supabase.from('notes').insert({workspace_id:company.workspace_id,company_id:company.id,body:noteText.trim(),created_by:user.id});if(error)setError(error.message);else{setNoteText('');await load()}setBusy(false)}
 if(!company)return <AppShell><div className="page"><div className={error?'error-banner':'loading'}>{error||'Cargando empresa…'}</div></div></AppShell>
 const value=opps.reduce((s,o)=>s+Number(o.amount||0),0)
 return <AppShell><div className="page"><div className="detail-top"><Link className="back-link" href="/companies"><ArrowLeft size={16}/> Empresas</Link></div><div className="company-detail-head"><div className="company-title"><div className="company-icon"><Building2 size={25}/></div><div><h1>{company.name}</h1><p>{company.industry||company.legal_name||'Empresa'} · {labelStatus(company.status)}</p></div></div><div className="company-inline-actions"><button className="secondary" onClick={()=>setLinkOpen(true)}><Plus size={15}/> Vincular contacto</button><button className="secondary" onClick={()=>setEdit(true)}><Pencil size={15}/> Editar</button></div></div>
 {error&&<div className="error-banner">{error}</div>}
 <div className="stats-grid"><div className="stat-card"><span>Contactos</span><strong>{contacts.length}</strong></div><div className="stat-card"><span>Oportunidades</span><strong>{opps.length}</strong></div><div className="stat-card"><span>Valor comercial</span><strong>{money(value)}</strong></div></div>
 <div className="company-tabs-grid"><div className="detail-main"><section className="panel"><div className="panel-title"><div><h2>Contactos</h2><p>Personas vinculadas a esta empresa.</p></div></div>{contacts.length===0?<div className="mini-empty">Todavía no hay contactos vinculados.</div>:contacts.map(c=><div className="company-contact-row" key={c.id}><div className="contact-avatar">{c.first_name[0]}{c.last_name?.[0]||''}</div><Link href={`/contacts/${c.id}`}><strong>{c.first_name} {c.last_name||''}</strong><span>{c.job_title||c.email||'Sin cargo'}</span></Link><button className="secondary" onClick={()=>unlinkContact(c.id)}>Desvincular</button></div>)}</section>
 <section className="panel"><div className="panel-title"><div><h2>Oportunidades</h2><p>Negocios asociados a la cuenta.</p></div></div>{opps.length===0?<div className="mini-empty">Todavía no hay oportunidades vinculadas.</div>:opps.map(o=><div className="company-opportunity" key={o.id}><div><strong>{o.name}</strong><b>{o.amount?money(Number(o.amount),o.currency):'Monto a definir'}</b></div><span>{o.sales_stages?.name||'Sin etapa'}</span></div>)}</section></div>
 <aside className="detail-side"><section className="panel"><div className="panel-title"><div><h2>Información</h2></div></div><dl className="info-list"><div><dt>Estado</dt><dd>{labelStatus(company.status)}</dd></div><div><dt>Industria</dt><dd>{company.industry||'Sin definir'}</dd></div><div><dt>Email</dt><dd>{company.email||'—'}</dd></div><div><dt>Teléfono</dt><dd>{company.phone||'—'}</dd></div><div><dt>Ubicación</dt><dd>{[company.city,company.country].filter(Boolean).join(', ')||'—'}</dd></div><div><dt>Sitio web</dt><dd>{company.website||'—'}</dd></div></dl></section>
 <section className="panel"><div className="panel-title"><div><h2>Notas</h2><p>Contexto interno de la cuenta.</p></div></div><form className="note-form" onSubmit={addNote}><textarea value={noteText} onChange={e=>setNoteText(e.target.value)} placeholder="Agregar una nota sobre la empresa..."/><button className="primary" disabled={busy||!noteText.trim()}><StickyNote size={15}/> Agregar nota</button></form><div className="notes-list">{notes.map(n=><div className="note-card" key={n.id}><p>{n.body}</p><small>{new Date(n.created_at).toLocaleString('es-AR')}</small></div>)}</div></section></aside></div>
 {linkOpen&&<div className="modal-backdrop" onClick={()=>setLinkOpen(false)}><div className="modal" onClick={e=>e.stopPropagation()}><h2>Vincular contacto</h2><p>Elegí una persona existente que todavía no tenga empresa.</p><form onSubmit={linkContact}><label>Contacto<select required value={contactId} onChange={e=>setContactId(e.target.value)}><option value="">Elegí un contacto</option>{available.map(c=><option key={c.id} value={c.id}>{c.first_name} {c.last_name||''}</option>)}</select></label><div className="modal-actions"><button type="button" className="secondary" onClick={()=>setLinkOpen(false)}>Cancelar</button><button className="primary" disabled={busy||!contactId}>Vincular</button></div></form></div></div>}
 {edit&&<div className="modal-backdrop" onClick={()=>setEdit(false)}><div className="modal" onClick={e=>e.stopPropagation()}><h2>Editar empresa</h2><p>Actualizá la información de la cuenta.</p><form onSubmit={save}><label>Nombre<input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label><label>Razón social<input value={form.legal_name} onChange={e=>setForm({...form,legal_name:e.target.value})}/></label><div className="form2"><label>Industria<input value={form.industry} onChange={e=>setForm({...form,industry:e.target.value})}/></label><label>Estado<select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>{statuses.map(s=><option key={s} value={s}>{labelStatus(s)}</option>)}</select></label></div><div className="form2"><label>Email<input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></label><label>Teléfono<input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/></label></div><label>Sitio web<input value={form.website} onChange={e=>setForm({...form,website:e.target.value})}/></label><div className="form2"><label>Ciudad<input value={form.city} onChange={e=>setForm({...form,city:e.target.value})}/></label><label>País<input value={form.country} onChange={e=>setForm({...form,country:e.target.value})}/></label></div><div className="modal-actions"><button type="button" className="secondary" onClick={()=>setEdit(false)}>Cancelar</button><button className="primary" disabled={busy}>{busy?'Guardando…':'Guardar cambios'}</button></div></form></div></div>}
 </div></AppShell>
}
function labelStatus(v:string){return ({prospect:'Prospecto',customer:'Cliente',active:'Activa',inactive:'Inactiva'} as Record<string,string>)[v]||v}
function money(v:number,currency='ARS'){return new Intl.NumberFormat('es-AR',{style:'currency',currency,maximumFractionDigits:0}).format(v)}
