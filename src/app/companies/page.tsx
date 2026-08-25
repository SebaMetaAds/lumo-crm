'use client'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AppShell } from '@/components/AppShell'
import { Building2, Plus, Search } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import './companies.css'

type Company={id:string;name:string;legal_name:string|null;industry:string|null;email:string|null;phone:string|null;status:string;created_at:string}
const statuses=['prospect','customer','active','inactive']

export default function Companies(){
 const [workspaceId,setWorkspaceId]=useState<string|null>(null)
 const [rows,setRows]=useState<Company[]>([])
 const [q,setQ]=useState('')
 const [statusFilter,setStatusFilter]=useState('all')
 const [open,setOpen]=useState(false)
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState('')
 const [form,setForm]=useState({name:'',legal_name:'',industry:'',email:'',phone:'',status:'prospect'})
 async function load(){
  const {data:{user}}=await supabase.auth.getUser();if(!user)return
  const {data:mem}=await supabase.from('workspace_members').select('workspace_id').eq('user_id',user.id).eq('status','active').limit(1).single();if(!mem)return
  setWorkspaceId(mem.workspace_id)
  const {data,error}=await supabase.from('companies').select('id,name,legal_name,industry,email,phone,status,created_at').eq('workspace_id',mem.workspace_id).order('created_at',{ascending:false})
  if(error)setError(error.message);else setRows((data||[]) as Company[])
 }
 useEffect(()=>{load()},[])
 const filtered=useMemo(()=>rows.filter(c=>`${c.name} ${c.legal_name||''} ${c.industry||''} ${c.email||''}`.toLowerCase().includes(q.toLowerCase())&&(statusFilter==='all'||c.status===statusFilter)),[rows,q,statusFilter])
 async function create(e:FormEvent){e.preventDefault();if(!workspaceId)return;setBusy(true);setError('');const {data,error}=await supabase.from('companies').insert({workspace_id:workspaceId,name:form.name,legal_name:form.legal_name||null,industry:form.industry||null,email:form.email||null,phone:form.phone||null,status:form.status}).select('id,name,legal_name,industry,email,phone,status,created_at').single();if(error)setError(error.message);else if(data){setRows([data as Company,...rows]);setOpen(false);setForm({name:'',legal_name:'',industry:'',email:'',phone:'',status:'prospect'})}setBusy(false)}
 return <AppShell><div className="page"><div className="page-head"><div><h1>Empresas</h1><p>Cuentas comerciales, contactos y oportunidades en una sola vista.</p></div><button className="primary compact" onClick={()=>setOpen(true)}><Plus size={17}/> Nueva empresa</button></div>
 <div className="toolbar"><div className="search local"><Search size={17}/><input placeholder="Buscar empresa..." value={q} onChange={e=>setQ(e.target.value)}/></div><div className="filters"><select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="all">Todos los estados</option>{statuses.map(s=><option key={s} value={s}>{labelStatus(s)}</option>)}</select></div><span className="count">{filtered.length} empresas</span></div>
 {error&&<div className="error-banner">{error}</div>}
 {filtered.length===0?<section className="panel"><div className="empty"><Building2 size={28}/><strong>{rows.length?'No encontramos coincidencias':'Todavía no hay empresas'}</strong><span>{rows.length?'Probá cambiando la búsqueda o el filtro.':'Creá la primera cuenta comercial de Lumo.'}</span>{!rows.length&&<button className="secondary" onClick={()=>setOpen(true)}>Crear empresa</button>}</div></section>:<div className="companies-grid">{filtered.map(c=><Link className="company-card" href={`/companies/${c.id}`} key={c.id}><div className="company-card-top"><div className="company-icon"><Building2 size={20}/></div><span className="badge">{labelStatus(c.status)}</span></div><h3>{c.name}</h3><p>{c.industry||c.legal_name||'Sin industria definida'}</p><div className="company-card-meta"><span>{c.email||c.phone||'Sin contacto principal'}</span><span>{new Date(c.created_at).toLocaleDateString('es-AR')}</span></div></Link>)}</div>}
 {open&&<div className="modal-backdrop" onClick={()=>setOpen(false)}><div className="modal" onClick={e=>e.stopPropagation()}><h2>Nueva empresa</h2><p>Creá una cuenta comercial para vincular contactos y oportunidades.</p><form onSubmit={create}><label>Nombre comercial<input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label><label>Razón social<input value={form.legal_name} onChange={e=>setForm({...form,legal_name:e.target.value})}/></label><div className="form2"><label>Industria<input value={form.industry} onChange={e=>setForm({...form,industry:e.target.value})}/></label><label>Estado<select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>{statuses.map(s=><option key={s} value={s}>{labelStatus(s)}</option>)}</select></label></div><div className="form2"><label>Email<input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></label><label>Teléfono<input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/></label></div><div className="modal-actions"><button type="button" className="secondary" onClick={()=>setOpen(false)}>Cancelar</button><button className="primary" disabled={busy}>{busy?'Guardando…':'Guardar empresa'}</button></div></form></div></div>}
 </div></AppShell>
}
function labelStatus(v:string){return ({prospect:'Prospecto',customer:'Cliente',active:'Activa',inactive:'Inactiva'} as Record<string,string>)[v]||v}
