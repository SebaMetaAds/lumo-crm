'use client'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import { AppShell } from '@/components/AppShell'
import { supabase } from '@/lib/supabase'
import { Plus, Play, Pause, Trash2, Zap } from 'lucide-react'

type Automation={
  id:string
  name:string
  description:string|null
  status:'draft'|'active'|'paused'
  trigger_type:string
  condition_config:any
  action_type:string
  action_config:any
  last_run_at:string|null
  created_at:string
}

const triggerOptions=[
  ['message_received','Llega un mensaje'],
  ['conversation_created','Se crea una conversación'],
  ['conversation_status_changed','Cambia el estado de una conversación'],
  ['opportunity_stage_changed','Cambia una oportunidad de etapa'],
  ['task_created','Se crea una tarea'],
  ['manual','Ejecución manual'],
]

const actionOptions=[
  ['assign_conversation','Asignar conversación'],
  ['set_priority','Cambiar prioridad'],
  ['set_conversation_status','Cambiar estado de conversación'],
  ['create_task','Crear tarea'],
  ['create_opportunity','Crear oportunidad'],
  ['add_tag','Agregar etiqueta'],
  ['notify','Enviar notificación'],
  ['none','Sin acción todavía'],
]

export default function AutomationsPage(){
  const [workspaceId,setWorkspaceId]=useState<string|null>(null)
  const [userId,setUserId]=useState<string|null>(null)
  const [rows,setRows]=useState<Automation[]>([])
  const [open,setOpen]=useState(false)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [form,setForm]=useState({name:'',description:'',trigger_type:'message_received',condition_field:'',condition_value:'',action_type:'create_task',action_value:''})

  async function bootstrap(){
    const {data:{user}}=await supabase.auth.getUser();if(!user)return
    setUserId(user.id)
    const {data:member,error:memberError}=await supabase.from('workspace_members').select('workspace_id').eq('user_id',user.id).eq('status','active').limit(1).single()
    if(memberError||!member){setError(memberError?.message||'No encontramos tu espacio de trabajo.');return}
    setWorkspaceId(member.workspace_id)
    await load(member.workspace_id)
  }

  async function load(wid=workspaceId){
    if(!wid)return
    const {data,error}=await supabase.from('automations').select('id,name,description,status,trigger_type,condition_config,action_type,action_config,last_run_at,created_at').eq('workspace_id',wid).order('created_at',{ascending:false})
    if(error)setError(error.message);else setRows((data||[]) as Automation[])
  }

  useEffect(()=>{bootstrap()},[])

  const activeCount=useMemo(()=>rows.filter(r=>r.status==='active').length,[rows])

  async function createAutomation(e:FormEvent){
    e.preventDefault();if(!workspaceId||!userId||!form.name.trim())return
    setBusy(true);setError('')
    const condition=form.condition_field.trim()?{field:form.condition_field.trim(),operator:'equals',value:form.condition_value.trim()}:{}
    const actionConfig=form.action_value.trim()?{value:form.action_value.trim()}:{}
    const {error}=await supabase.from('automations').insert({
      workspace_id:workspaceId,
      name:form.name.trim(),
      description:form.description.trim()||null,
      status:'draft',
      trigger_type:form.trigger_type,
      trigger_config:{},
      condition_config:condition,
      action_type:form.action_type,
      action_config:actionConfig,
      created_by:userId,
    })
    setBusy(false)
    if(error){setError(error.message);return}
    setOpen(false)
    setForm({name:'',description:'',trigger_type:'message_received',condition_field:'',condition_value:'',action_type:'create_task',action_value:''})
    await load(workspaceId)
  }

  async function toggle(row:Automation){
    if(!workspaceId)return
    const next=row.status==='active'?'paused':'active'
    const {error}=await supabase.from('automations').update({status:next,updated_at:new Date().toISOString()}).eq('id',row.id).eq('workspace_id',workspaceId)
    if(error)setError(error.message);else setRows(v=>v.map(x=>x.id===row.id?{...x,status:next}:x))
  }

  async function remove(row:Automation){
    if(!workspaceId||!confirm(`¿Eliminar la automatización “${row.name}”?`))return
    const {error}=await supabase.from('automations').delete().eq('id',row.id).eq('workspace_id',workspaceId)
    if(error)setError(error.message);else setRows(v=>v.filter(x=>x.id!==row.id))
  }

  return <AppShell><div className="page">
    <div className="page-head"><div><h1>Automatizaciones</h1><p>Definí reglas simples para que Lumo trabaje por vos.</p></div><button className="primary compact" onClick={()=>setOpen(true)}><Plus size={17}/> Nueva automatización</button></div>

    <div className="test-banner"><strong>WHEN → IF → THEN</strong><span>Elegís qué evento inicia la regla, una condición opcional y qué acción debe ejecutar Lumo.</span></div>
    {error&&<div className="error-banner">{error}</div>}

    <div style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:14,marginBottom:18}}>
      <div className="panel" style={{padding:18}}><span style={{fontSize:13,opacity:.65}}>Total</span><div style={{fontSize:30,fontWeight:750,marginTop:6}}>{rows.length}</div></div>
      <div className="panel" style={{padding:18}}><span style={{fontSize:13,opacity:.65}}>Activas</span><div style={{fontSize:30,fontWeight:750,marginTop:6}}>{activeCount}</div></div>
      <div className="panel" style={{padding:18}}><span style={{fontSize:13,opacity:.65}}>En borrador / pausadas</span><div style={{fontSize:30,fontWeight:750,marginTop:6}}>{rows.length-activeCount}</div></div>
    </div>

    <section className="panel" style={{overflow:'hidden'}}>
      {rows.length===0?<div className="empty" style={{padding:48}}><Zap size={30}/><strong>Todavía no hay automatizaciones</strong><span>Creá la primera regla para empezar a automatizar el trabajo repetitivo.</span></div>:
      <div style={{display:'flex',flexDirection:'column'}}>{rows.map(row=><div key={row.id} style={{display:'grid',gridTemplateColumns:'minmax(220px,1.3fr) minmax(180px,1fr) minmax(180px,1fr) 120px 110px',gap:14,alignItems:'center',padding:'16px 18px',borderBottom:'1px solid rgba(15,23,42,.08)'}}>
        <div><strong style={{display:'block'}}>{row.name}</strong><span style={{fontSize:13,opacity:.62}}>{row.description||'Sin descripción'}</span></div>
        <div><span style={{fontSize:11,fontWeight:700,opacity:.55}}>WHEN</span><div style={{fontSize:14,marginTop:3}}>{labelOf(triggerOptions,row.trigger_type)}</div></div>
        <div><span style={{fontSize:11,fontWeight:700,opacity:.55}}>THEN</span><div style={{fontSize:14,marginTop:3}}>{labelOf(actionOptions,row.action_type)}</div></div>
        <div><span style={{display:'inline-flex',padding:'6px 9px',borderRadius:999,fontSize:12,fontWeight:700,background:row.status==='active'?'rgba(22,163,74,.10)':'rgba(100,116,139,.10)'}}>{statusLabel(row.status)}</span></div>
        <div style={{display:'flex',gap:7,justifyContent:'flex-end'}}><button className="iconbtn" title={row.status==='active'?'Pausar':'Activar'} onClick={()=>toggle(row)}>{row.status==='active'?<Pause size={16}/>:<Play size={16}/>}</button><button className="iconbtn" title="Eliminar" onClick={()=>remove(row)}><Trash2 size={16}/></button></div>
      </div>)}</div>}
    </section>

    {open&&<div className="modal-backdrop"><div className="modal" style={{maxWidth:680}}><div className="modal-head"><div><h2>Nueva automatización</h2><p>Armá una regla WHEN → IF → THEN.</p></div><button className="iconbtn" onClick={()=>setOpen(false)}>×</button></div><form onSubmit={createAutomation} className="form-grid">
      <label className="full">Nombre<input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Ej. Priorizar consultas de venta" required/></label>
      <label className="full">Descripción<input value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Opcional"/></label>
      <label className="full"><strong>WHEN</strong> — Cuando<select value={form.trigger_type} onChange={e=>setForm({...form,trigger_type:e.target.value})}>{triggerOptions.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
      <label>IF — Campo<input value={form.condition_field} onChange={e=>setForm({...form,condition_field:e.target.value})} placeholder="Ej. channel"/></label>
      <label>IF — Es igual a<input value={form.condition_value} onChange={e=>setForm({...form,condition_value:e.target.value})} placeholder="Ej. instagram"/></label>
      <label className="full"><strong>THEN</strong> — Acción<select value={form.action_type} onChange={e=>setForm({...form,action_type:e.target.value})}>{actionOptions.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
      <label className="full">Valor / configuración<input value={form.action_value} onChange={e=>setForm({...form,action_value:e.target.value})} placeholder="Ej. high, Ventas, Pendiente..."/></label>
      <div className="modal-actions full"><button type="button" className="secondary" onClick={()=>setOpen(false)}>Cancelar</button><button className="primary" disabled={busy}>{busy?'Guardando...':'Crear borrador'}</button></div>
    </form></div></div>}
  </div></AppShell>
}

function labelOf(options:string[][],value:string){return options.find(x=>x[0]===value)?.[1]||value}
function statusLabel(status:string){return status==='active'?'Activa':status==='paused'?'Pausada':'Borrador'}
