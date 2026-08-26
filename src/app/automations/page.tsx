'use client'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import { AppShell } from '@/components/AppShell'
import { supabase } from '@/lib/supabase'
import { Plus, Play, Pause, Trash2, Zap, CheckCircle2, XCircle, Clock3, X } from 'lucide-react'

type Automation={id:string;name:string;description:string|null;status:'draft'|'active'|'paused';trigger_type:string;condition_config:any;action_type:string;action_config:any;last_run_at:string|null;created_at:string}
type Member={user_id:string;role:string;profiles:{full_name:string|null}|null}
type Run={id:string;status:string;executed_at:string;finished_at:string|null;error_message:string|null;automation_id:string;automations:{name:string}|null}
type Condition={field:string;operator:string;value:string}
type Action={type:string;value:string}

const triggerOptions=[['message_received','Llega un mensaje'],['conversation_created','Se crea una conversación'],['conversation_status_changed','Cambia el estado de una conversación'],['opportunity_stage_changed','Cambia una oportunidad de etapa'],['task_created','Se crea una tarea'],['manual','Ejecución manual']]
const actionOptions=[['create_task','Crear tarea'],['set_priority','Cambiar prioridad'],['set_conversation_status','Cambiar estado de conversación'],['assign_conversation','Asignar conversación']]
const fieldOptions:Record<string,string[][]>={message_received:[['channel','Canal'],['body','Texto del mensaje'],['status','Estado de conversación'],['priority','Prioridad']],conversation_created:[['channel','Canal'],['status','Estado'],['priority','Prioridad']],conversation_status_changed:[['status','Nuevo estado'],['channel','Canal'],['priority','Prioridad']],opportunity_stage_changed:[['stage','Etapa'],['source_channel','Canal de origen']],task_created:[['priority','Prioridad'],['status','Estado']],manual:[]}
const channelValues=[['instagram','Instagram'],['facebook','Facebook'],['whatsapp','WhatsApp'],['mercadolibre','Mercado Libre'],['tiktok','TikTok']]
const priorityValues=[['low','Baja'],['normal','Normal'],['high','Alta'],['urgent','Urgente']]
const statusValues=[['open','Abierta'],['pending','Pendiente'],['closed','Cerrada']]

export default function AutomationsPage(){
 const [workspaceId,setWorkspaceId]=useState<string|null>(null)
 const [userId,setUserId]=useState<string|null>(null)
 const [rows,setRows]=useState<Automation[]>([])
 const [runs,setRuns]=useState<Run[]>([])
 const [members,setMembers]=useState<Member[]>([])
 const [open,setOpen]=useState(false)
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState('')
 const [name,setName]=useState('')
 const [description,setDescription]=useState('')
 const [triggerType,setTriggerType]=useState('message_received')
 const [logic,setLogic]=useState<'and'|'or'>('and')
 const [conditions,setConditions]=useState<Condition[]>([{field:'channel',operator:'equals',value:'instagram'}])
 const [actions,setActions]=useState<Action[]>([{type:'create_task',value:'Seguimiento de nuevo mensaje'}])

 async function bootstrap(){
  const {data:{user}}=await supabase.auth.getUser();if(!user)return
  setUserId(user.id)
  const {data:member,error:memberError}=await supabase.from('workspace_members').select('workspace_id').eq('user_id',user.id).eq('status','active').limit(1).single()
  if(memberError||!member){setError(memberError?.message||'No encontramos tu espacio de trabajo.');return}
  setWorkspaceId(member.workspace_id)
  await Promise.all([load(member.workspace_id),loadRuns(member.workspace_id),loadMembers(member.workspace_id)])
 }
 async function load(wid=workspaceId){if(!wid)return;const {data,error}=await supabase.from('automations').select('id,name,description,status,trigger_type,condition_config,action_type,action_config,last_run_at,created_at').eq('workspace_id',wid).order('created_at',{ascending:false});if(error)setError(error.message);else setRows((data||[]) as Automation[])}
 async function loadRuns(wid=workspaceId){if(!wid)return;const {data,error}=await supabase.from('automation_runs').select('id,status,executed_at,finished_at,error_message,automation_id,automations(name)').eq('workspace_id',wid).order('executed_at',{ascending:false}).limit(12);if(error)setError(error.message);else setRuns((data||[]) as unknown as Run[])}
 async function loadMembers(wid=workspaceId){if(!wid)return;const {data}=await supabase.from('workspace_members').select('user_id,role,profiles(full_name)').eq('workspace_id',wid).eq('status','active');setMembers((data||[]) as unknown as Member[])}
 useEffect(()=>{bootstrap()},[])

 const activeCount=useMemo(()=>rows.filter(r=>r.status==='active').length,[rows])
 const successfulRuns=useMemo(()=>runs.filter(r=>r.status==='success').length,[runs])

 function resetBuilder(){setName('');setDescription('');setTriggerType('message_received');setLogic('and');setConditions([{field:'channel',operator:'equals',value:'instagram'}]);setActions([{type:'create_task',value:'Seguimiento de nuevo mensaje'}])}
 function changeTrigger(value:string){setTriggerType(value);const first=(fieldOptions[value]||[])[0]?.[0]||'';setConditions(first?[{field:first,operator:first==='body'?'contains':'equals',value:defaultConditionValue(first)}]:[])}
 function addCondition(){const first=(fieldOptions[triggerType]||[])[0]?.[0];if(!first)return;setConditions(v=>[...v,{field:first,operator:first==='body'?'contains':'equals',value:defaultConditionValue(first)}])}
 function updateCondition(index:number,patch:Partial<Condition>){setConditions(v=>v.map((c,i)=>i===index?{...c,...patch}:c))}
 function addAction(){setActions(v=>[...v,{type:'create_task',value:'Seguimiento'}])}
 function updateAction(index:number,patch:Partial<Action>){setActions(v=>v.map((a,i)=>i===index?{...a,...patch}:a))}

 async function createAutomation(e:FormEvent){
  e.preventDefault();if(!workspaceId||!userId||!name.trim()||!actions.length)return
  setBusy(true);setError('')
  const conditionConfig=conditions.length?{logic,conditions}:{}
  const actionConfig={actions:actions.map(a=>({type:a.type,config:{value:a.value}}))}
  const {error}=await supabase.from('automations').insert({workspace_id:workspaceId,name:name.trim(),description:description.trim()||null,status:'draft',trigger_type:triggerType,trigger_config:{},condition_config:conditionConfig,action_type:actions[0].type,action_config:actionConfig,created_by:userId})
  setBusy(false)
  if(error){setError(error.message);return}
  setOpen(false);resetBuilder();await load(workspaceId)
 }
 async function toggle(row:Automation){if(!workspaceId)return;const next=row.status==='active'?'paused':'active';const {error}=await supabase.from('automations').update({status:next,updated_at:new Date().toISOString()}).eq('id',row.id).eq('workspace_id',workspaceId);if(error)setError(error.message);else setRows(v=>v.map(x=>x.id===row.id?{...x,status:next}:x))}
 async function remove(row:Automation){if(!workspaceId||!confirm(`¿Eliminar la automatización “${row.name}”?`))return;const {error}=await supabase.from('automations').delete().eq('id',row.id).eq('workspace_id',workspaceId);if(error)setError(error.message);else setRows(v=>v.filter(x=>x.id!==row.id))}

 return <AppShell><div className="page">
  <div className="page-head"><div><h1>Automatizaciones</h1><p>Construí reglas con múltiples condiciones y acciones.</p></div><button className="primary compact" onClick={()=>setOpen(true)}><Plus size={17}/> Nueva automatización</button></div>
  <div className="test-banner"><strong>WHEN → IF → THEN</strong><span>Ahora podés combinar condiciones con AND/OR y ejecutar varias acciones en secuencia.</span></div>
  {error&&<div className="error-banner">{error}</div>}
  <div style={{display:'grid',gridTemplateColumns:'repeat(4,minmax(0,1fr))',gap:14,marginBottom:18}}><Metric label="Total" value={rows.length}/><Metric label="Activas" value={activeCount}/><Metric label="Ejecuciones recientes" value={runs.length}/><Metric label="Exitosas" value={successfulRuns}/></div>

  <section className="panel" style={{overflow:'hidden',marginBottom:18}}>{rows.length===0?<div className="empty" style={{padding:48}}><Zap size={30}/><strong>Todavía no hay automatizaciones</strong><span>Creá la primera regla para empezar a automatizar.</span></div>:rows.map(row=><div key={row.id} style={{display:'grid',gridTemplateColumns:'minmax(240px,1.4fr) minmax(170px,1fr) minmax(220px,1.1fr) 135px 110px',gap:14,alignItems:'center',padding:'16px 18px',borderBottom:'1px solid rgba(15,23,42,.08)'}}>
   <div><strong style={{display:'block'}}>{row.name}</strong><span style={{fontSize:13,opacity:.62}}>{row.description||conditionSummary(row)}</span></div>
   <div><span style={{fontSize:11,fontWeight:700,opacity:.55}}>WHEN</span><div style={{fontSize:14,marginTop:3}}>{labelOf(triggerOptions,row.trigger_type)}</div></div>
   <div><span style={{fontSize:11,fontWeight:700,opacity:.55}}>THEN</span><div style={{fontSize:14,marginTop:3}}>{actionsSummary(row)}</div></div>
   <div><span style={{display:'inline-flex',padding:'6px 9px',borderRadius:999,fontSize:12,fontWeight:700,background:row.status==='active'?'rgba(22,163,74,.10)':'rgba(100,116,139,.10)'}}>{statusLabel(row.status)}</span>{row.last_run_at&&<small style={{display:'block',marginTop:5,opacity:.55}}>Última: {formatDate(row.last_run_at)}</small>}</div>
   <div style={{display:'flex',gap:7,justifyContent:'flex-end'}}><button className="iconbtn" title={row.status==='active'?'Pausar':'Activar'} onClick={()=>toggle(row)}>{row.status==='active'?<Pause size={16}/>:<Play size={16}/>}</button><button className="iconbtn" title="Eliminar" onClick={()=>remove(row)}><Trash2 size={16}/></button></div>
  </div>)}</section>

  <section className="panel" style={{overflow:'hidden'}}><div style={{padding:'17px 18px',borderBottom:'1px solid rgba(15,23,42,.08)'}}><strong>Historial de ejecuciones</strong><div style={{fontSize:13,opacity:.6,marginTop:3}}>Últimas ejecuciones del workspace.</div></div>{runs.length===0?<div className="mini-empty" style={{padding:30}}>Todavía no hay ejecuciones.</div>:runs.map(run=><div key={run.id} style={{display:'grid',gridTemplateColumns:'32px minmax(220px,1fr) 150px 140px',gap:12,alignItems:'center',padding:'13px 18px',borderBottom:'1px solid rgba(15,23,42,.06)'}}><div>{run.status==='success'?<CheckCircle2 size={19}/>:run.status==='failed'?<XCircle size={19}/>:<Clock3 size={19}/>}</div><div><strong style={{fontSize:14}}>{run.automations?.name||'Automatización'}</strong>{run.error_message&&<div style={{fontSize:12,marginTop:3,opacity:.65}}>{run.error_message}</div>}</div><span style={{fontSize:13}}>{run.status==='success'?'Exitosa':run.status==='failed'?'Falló':'Ejecutando'}</span><span style={{fontSize:12,opacity:.6}}>{formatDate(run.executed_at)}</span></div>)}</section>

  {open&&<div className="modal-backdrop"><div className="modal" style={{maxWidth:820,maxHeight:'90vh',overflow:'auto'}}><div className="modal-head"><div><h2>Nueva automatización</h2><p>Combiná condiciones y acciones sin escribir código.</p></div><button className="iconbtn" onClick={()=>setOpen(false)}>×</button></div><form onSubmit={createAutomation} className="form-grid">
   <label className="full">Nombre<input value={name} onChange={e=>setName(e.target.value)} placeholder="Ej. Priorizar consultas comerciales" required/></label>
   <label className="full">Descripción<input value={description} onChange={e=>setDescription(e.target.value)} placeholder="Opcional"/></label>
   <label className="full"><strong>WHEN</strong> — Cuando<select value={triggerType} onChange={e=>changeTrigger(e.target.value)}>{triggerOptions.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>

   {(fieldOptions[triggerType]||[]).length>0&&<div className="full" style={{display:'flex',flexDirection:'column',gap:10}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><strong>IF — Condiciones</strong><div style={{display:'flex',gap:8}}><select value={logic} onChange={e=>setLogic(e.target.value as 'and'|'or')}><option value="and">Cumplir TODAS (AND)</option><option value="or">Cumplir CUALQUIERA (OR)</option></select><button type="button" className="secondary" onClick={addCondition}><Plus size={15}/> Condición</button></div></div>{conditions.map((c,i)=><div key={i} style={{display:'grid',gridTemplateColumns:'1fr .9fr 1.2fr 38px',gap:8,alignItems:'end',padding:12,border:'1px solid rgba(15,23,42,.08)',borderRadius:12}}><label>Campo<select value={c.field} onChange={e=>{const field=e.target.value;updateCondition(i,{field,operator:field==='body'?'contains':'equals',value:defaultConditionValue(field)})}}>{(fieldOptions[triggerType]||[]).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label><label>Condición<select value={c.operator} onChange={e=>updateCondition(i,{operator:e.target.value})}><option value="equals">Es igual a</option><option value="not_equals">No es igual a</option><option value="contains">Contiene</option><option value="not_contains">No contiene</option></select></label><label>Valor<ConditionValue field={c.field} value={c.value} onChange={value=>updateCondition(i,{value})}/></label><button type="button" className="iconbtn" disabled={conditions.length===1} onClick={()=>setConditions(v=>v.filter((_,x)=>x!==i))}><X size={15}/></button></div>)}</div>}

   <div className="full" style={{display:'flex',flexDirection:'column',gap:10}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><strong>THEN — Acciones</strong><button type="button" className="secondary" onClick={addAction}><Plus size={15}/> Acción</button></div>{actions.map((a,i)=><div key={i} style={{display:'grid',gridTemplateColumns:'1fr 1.4fr 38px',gap:8,alignItems:'end',padding:12,border:'1px solid rgba(15,23,42,.08)',borderRadius:12}}><label>Acción<select value={a.type} onChange={e=>{const type=e.target.value;updateAction(i,{type,value:defaultActionValue(type,members)})}}>{actionOptions.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label><label>Configuración<ActionValue action={a.type} value={a.value} members={members} onChange={value=>updateAction(i,{value})}/></label><button type="button" className="iconbtn" disabled={actions.length===1} onClick={()=>setActions(v=>v.filter((_,x)=>x!==i))}><X size={15}/></button></div>)}</div>

   <div className="full" style={{padding:'14px 16px',borderRadius:14,background:'rgba(99,102,241,.07)'}}><strong style={{fontSize:12}}>RESUMEN</strong><div style={{marginTop:6,fontSize:14}}>{builderSummary(triggerType,logic,conditions,actions,members)}</div></div>
   <div className="modal-actions full"><button type="button" className="secondary" onClick={()=>setOpen(false)}>Cancelar</button><button className="primary" disabled={busy}>{busy?'Guardando...':'Crear borrador'}</button></div>
  </form></div></div>}
 </div></AppShell>
}

function Metric({label,value}:{label:string;value:number}){return <div className="panel" style={{padding:18}}><span style={{fontSize:13,opacity:.65}}>{label}</span><div style={{fontSize:30,fontWeight:750,marginTop:6}}>{value}</div></div>}
function labelOf(options:string[][],value:string){return options.find(x=>x[0]===value)?.[1]||value}
function statusLabel(status:string){return status==='active'?'Activa':status==='paused'?'Pausada':'Borrador'}
function formatDate(value:string){return new Intl.DateTimeFormat('es-AR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(value))}
function defaultConditionValue(field:string){if(field==='channel'||field==='source_channel')return 'instagram';if(field==='priority')return 'normal';if(field==='status')return 'open';return ''}
function defaultActionValue(action:string,members:Member[]){if(action==='set_priority')return 'high';if(action==='set_conversation_status')return 'pending';if(action==='assign_conversation')return members[0]?.user_id||'';return 'Seguimiento de conversación'}
function optionsForField(field:string){if(field==='channel'||field==='source_channel')return channelValues;if(field==='priority')return priorityValues;if(field==='status')return statusValues;return null}
function ConditionValue({field,value,onChange}:{field:string;value:string;onChange:(v:string)=>void}){const options=optionsForField(field);return options?<select value={value} onChange={e=>onChange(e.target.value)}>{options.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select>:<input value={value} onChange={e=>onChange(e.target.value)} placeholder={field==='body'?'Ej. precio':'Valor'}/>}
function ActionValue({action,value,members,onChange}:{action:string;value:string;members:Member[];onChange:(v:string)=>void}){if(action==='set_priority')return <select value={value} onChange={e=>onChange(e.target.value)}>{priorityValues.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select>;if(action==='set_conversation_status')return <select value={value} onChange={e=>onChange(e.target.value)}>{statusValues.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select>;if(action==='assign_conversation')return <select value={value} onChange={e=>onChange(e.target.value)}><option value="">Seleccionar persona...</option>{members.map(m=><option key={m.user_id} value={m.user_id}>{m.profiles?.full_name||'Usuario'} · {m.role}</option>)}</select>;return <input value={value} onChange={e=>onChange(e.target.value)} placeholder="Título de la tarea"/>}
function conditionSummary(row:Automation){const cfg=row.condition_config||{};const cs=Array.isArray(cfg.conditions)?cfg.conditions:(cfg.field?[cfg]:[]);if(!cs.length)return 'Sin condiciones';return `${cs.length} condición${cs.length===1?'':'es'} · ${(cfg.logic||'and').toUpperCase()}`}
function actionsSummary(row:Automation){const actions=Array.isArray(row.action_config?.actions)?row.action_config.actions:null;if(!actions)return labelOf(actionOptions,row.action_type);return actions.map((a:any)=>labelOf(actionOptions,a.type)).join(' → ')}
function builderSummary(trigger:string,logic:string,conditions:Condition[],actions:Action[],members:Member[]){const when=labelOf(triggerOptions,trigger);const ifText=conditions.length?conditions.map(c=>`${fieldLabel(trigger,c.field)} ${operatorLabel(c.operator)} ${displayValue(c.field,c.value)}`).join(logic==='and'?' Y ':' O '):'sin condiciones';const then=actions.map(a=>`${labelOf(actionOptions,a.type)}${a.value?` → ${actionValueLabel(a,members)}`:''}`).join(' → ');return `CUANDO ${when} · SI ${ifText} · ENTONCES ${then}`}
function fieldLabel(trigger:string,field:string){return (fieldOptions[trigger]||[]).find(x=>x[0]===field)?.[1]||field}
function operatorLabel(op:string){return op==='not_equals'?'no es':op==='contains'?'contiene':op==='not_contains'?'no contiene':'es'}
function displayValue(field:string,value:string){return optionsForField(field)?.find(x=>x[0]===value)?.[1]||value}
function actionValueLabel(a:Action,members:Member[]){if(a.type==='set_priority')return displayValue('priority',a.value);if(a.type==='set_conversation_status')return displayValue('status',a.value);if(a.type==='assign_conversation')return members.find(m=>m.user_id===a.value)?.profiles?.full_name||'Usuario';return a.value}
