'use client'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AppShell } from '@/components/AppShell'
import { supabase } from '@/lib/supabase'
import { Search, Plus, Send, Instagram, Facebook, MessageCircle, Store, Music2, BadgeDollarSign } from 'lucide-react'

type Contact={id:string;first_name:string;last_name:string|null;email:string|null;phone:string|null;source:string|null}
type Member={user_id:string;role:string;profiles:{full_name:string|null}|null}
type Connection={id:string;channel:string;name:string;settings:any}
type Conversation={id:string;contact_id:string|null;channel_connection_id:string;status:string;priority:string;assigned_user_id:string|null;last_message_at:string|null;unread_count:number;subject:string|null;contacts:Contact|null;channel_connections:Connection|null}
type Message={id:string;direction:string;sender_type:string;body:string|null;sent_at:string;status:string}
type Stage={id:string;name:string;position:number;probability:number;is_won:boolean;is_lost:boolean}
const channels=['instagram','facebook','whatsapp','mercadolibre','tiktok']

export default function Inbox(){
 const [workspaceId,setWorkspaceId]=useState<string|null>(null)
 const [userId,setUserId]=useState<string|null>(null)
 const [contacts,setContacts]=useState<Contact[]>([])
 const [members,setMembers]=useState<Member[]>([])
 const [stages,setStages]=useState<Stage[]>([])
 const [conversations,setConversations]=useState<Conversation[]>([])
 const [selectedId,setSelectedId]=useState<string|null>(null)
 const [messages,setMessages]=useState<Message[]>([])
 const [q,setQ]=useState('')
 const [statusFilter,setStatusFilter]=useState('open')
 const [reply,setReply]=useState('')
 const [openNew,setOpenNew]=useState(false)
 const [openOpp,setOpenOpp]=useState(false)
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState('')
 const [success,setSuccess]=useState('')
 const [newConv,setNewConv]=useState({contact_id:'',channel:'instagram',message:'Hola, quisiera información sobre un producto.'})
 const [opp,setOpp]=useState({name:'',amount:'',stage_id:'',expected_close_date:''})
 const selected=conversations.find(c=>c.id===selectedId)||null

 async function bootstrap(){
  const {data:{user}}=await supabase.auth.getUser();if(!user)return
  setUserId(user.id)
  const {data:mem,error:memErr}=await supabase.from('workspace_members').select('workspace_id').eq('user_id',user.id).eq('status','active').limit(1).single()
  if(memErr||!mem){setError(memErr?.message||'No encontramos tu espacio de trabajo.');return}
  setWorkspaceId(mem.workspace_id)
  const [{data:cs},{data:ms},{data:ss}]=await Promise.all([
   supabase.from('contacts').select('id,first_name,last_name,email,phone,source').eq('workspace_id',mem.workspace_id).order('first_name'),
   supabase.from('workspace_members').select('user_id,role,profiles(full_name)').eq('workspace_id',mem.workspace_id).eq('status','active'),
   supabase.from('sales_stages').select('id,name,position,probability,is_won,is_lost').eq('workspace_id',mem.workspace_id).order('position')
  ])
  setContacts((cs||[]) as Contact[]);setMembers((ms||[]) as unknown as Member[]);setStages((ss||[]) as Stage[])
  await loadConversations(mem.workspace_id)
 }
 async function loadConversations(wid=workspaceId){
  if(!wid)return
  const {data,error}=await supabase.from('conversations').select('id,contact_id,channel_connection_id,status,priority,assigned_user_id,last_message_at,unread_count,subject,contacts(id,first_name,last_name,email,phone,source),channel_connections(id,channel,name,settings)').eq('workspace_id',wid).order('last_message_at',{ascending:false,nullsFirst:false})
  if(error){setError(error.message);return}
  const rows=(data||[]) as unknown as Conversation[];setConversations(rows);if(!selectedId&&rows.length)setSelectedId(rows[0].id)
 }
 useEffect(()=>{bootstrap()},[])
 useEffect(()=>{if(selectedId)loadMessages(selectedId)},[selectedId])
 async function loadMessages(cid:string){
  const {data,error}=await supabase.from('messages').select('id,direction,sender_type,body,sent_at,status').eq('conversation_id',cid).order('sent_at')
  if(error)setError(error.message);else setMessages((data||[]) as Message[])
  if(workspaceId){await supabase.from('conversations').update({unread_count:0}).eq('id',cid).eq('workspace_id',workspaceId);setConversations(v=>v.map(c=>c.id===cid?{...c,unread_count:0}:c))}
 }
 const filtered=useMemo(()=>conversations.filter(c=>{
  const name=c.contacts?`${c.contacts.first_name} ${c.contacts.last_name||''}`:''
  const text=`${name} ${c.subject||''} ${labelChannel(c.channel_connections?.channel||'')}`.toLowerCase()
  return text.includes(q.toLowerCase())&&(statusFilter==='all'||c.status===statusFilter)
 }),[conversations,q,statusFilter])
 async function ensureTestConnection(channel:string){
  if(!workspaceId)throw new Error('Workspace no disponible')
  const {data:found}=await supabase.from('channel_connections').select('id,channel,name,settings').eq('workspace_id',workspaceId).eq('channel',channel).contains('settings',{mode:'test'}).limit(1)
  if(found?.length)return found[0] as Connection
  const {data,error}=await supabase.from('channel_connections').insert({workspace_id:workspaceId,channel,name:`${labelChannel(channel)} · Modo prueba`,status:'connected',settings:{mode:'test'}}).select('id,channel,name,settings').single()
  if(error)throw error;return data as Connection
 }
 async function createConversation(e:FormEvent){
  e.preventDefault();if(!workspaceId||!newConv.contact_id||!newConv.message.trim())return;setBusy(true);setError('');setSuccess('')
  try{
   const connection=await ensureTestConnection(newConv.channel);const now=new Date().toISOString()
   const {data:conv,error:ce}=await supabase.from('conversations').insert({workspace_id:workspaceId,contact_id:newConv.contact_id,channel_connection_id:connection.id,status:'open',priority:'normal',assigned_user_id:userId,last_message_at:now,last_incoming_at:now,unread_count:1,metadata:{mode:'test'}}).select('id').single();if(ce)throw ce
   const {error:me}=await supabase.from('messages').insert({workspace_id:workspaceId,conversation_id:conv.id,direction:'incoming',sender_type:'contact',body:newConv.message,message_type:'text',status:'received',sent_at:now,attachments:[],metadata:{mode:'test'}});if(me)throw me
   setOpenNew(false);setNewConv({contact_id:'',channel:'instagram',message:'Hola, quisiera información sobre un producto.'});await loadConversations(workspaceId);setSelectedId(conv.id)
  }catch(err:any){setError(err.message||'No pudimos crear la conversación')}finally{setBusy(false)}
 }
 async function sendReply(e:FormEvent){
  e.preventDefault();if(!workspaceId||!selected||!reply.trim())return;setBusy(true);setError('');const now=new Date().toISOString();const body=reply.trim()
  const {data,error}=await supabase.from('messages').insert({workspace_id:workspaceId,conversation_id:selected.id,direction:'outgoing',sender_type:'user',sender_user_id:userId,body,message_type:'text',status:'sent',sent_at:now,attachments:[],metadata:{mode:selected.channel_connections?.settings?.mode||'live'}}).select('id,direction,sender_type,body,sent_at,status').single()
  if(error)setError(error.message);else{setReply('');setMessages(v=>[...v,data as Message]);await supabase.from('conversations').update({last_message_at:now,last_outgoing_at:now,status:'open'}).eq('id',selected.id);setConversations(v=>v.map(c=>c.id===selected.id?{...c,last_message_at:now,status:'open'}:c))}setBusy(false)
 }
 async function updateConversation(fields:Record<string,any>){if(!selected||!workspaceId)return;const {error}=await supabase.from('conversations').update(fields).eq('id',selected.id).eq('workspace_id',workspaceId);if(error)setError(error.message);else setConversations(v=>v.map(c=>c.id===selected.id?{...c,...fields}:c))}
 function startOpportunity(){
  if(!selected)return;const first=stages.find(s=>!s.is_won&&!s.is_lost)||stages[0]
  const person=selected.contacts?`${selected.contacts.first_name} ${selected.contacts.last_name||''}`.trim():'Cliente'
  setOpp({name:`Venta - ${person}`,amount:'',stage_id:first?.id||'',expected_close_date:''});setError('');setSuccess('');setOpenOpp(true)
 }
 async function createOpportunity(e:FormEvent){
  e.preventDefault();if(!workspaceId||!userId||!selected||!opp.name.trim()||!opp.stage_id)return;setBusy(true);setError('');setSuccess('')
  try{
   const {data:existing,error:xe}=await supabase.from('opportunities').select('id,name').eq('workspace_id',workspaceId).eq('conversation_id',selected.id).limit(1)
   if(xe)throw xe;if(existing?.length)throw new Error(`Esta conversación ya tiene la oportunidad “${existing[0].name}”.`)
   const stage=stages.find(s=>s.id===opp.stage_id)
   const {data:created,error:oe}=await supabase.from('opportunities').insert({workspace_id:workspaceId,name:opp.name.trim(),contact_id:selected.contact_id,conversation_id:selected.id,stage_id:opp.stage_id,owner_id:selected.assigned_user_id||userId,amount:opp.amount?Number(opp.amount):null,currency:'ARS',probability:stage?.probability??null,source_channel:selected.channel_connections?.channel||null,expected_close_date:opp.expected_close_date||null}).select('id,name').single();if(oe)throw oe
   await supabase.from('opportunity_history').insert({workspace_id:workspaceId,opportunity_id:created.id,changed_by:userId,field_name:'created',new_value:stage?.name||'Nueva oportunidad'})
   setOpenOpp(false);setSuccess(`Oportunidad “${created.name}” creada. Ya aparece en Oportunidades y en el Proceso de ventas.`)
  }catch(err:any){setError(err.message||'No pudimos crear la oportunidad')}finally{setBusy(false)}
 }
 return <AppShell><div className="page inbox-page"><div className="page-head"><div><h1>Inbox</h1><p>Todas las conversaciones del negocio en un solo lugar.</p></div><button className="primary compact" onClick={()=>setOpenNew(true)}><Plus size={17}/> Conversación de prueba</button></div>
 <div className="test-banner"><strong>Modo prueba</strong><span>Estas conversaciones se guardan en Lumo, pero todavía no envían ni reciben mensajes desde las redes externas.</span></div>
 {error&&<div className="error-banner">{error}</div>}{success&&<div className="test-banner"><strong>Listo</strong><span>{success}</span></div>}
 <div className="inbox-grid">
  <section className="inbox-list panel"><div className="inbox-list-head"><div className="search local"><Search size={16}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Buscar conversaciones..."/></div><select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="open">Abiertas</option><option value="pending">Pendientes</option><option value="closed">Cerradas</option><option value="all">Todas</option></select></div><div className="conversation-list">{filtered.length===0?<div className="mini-empty">No hay conversaciones para este filtro.</div>:filtered.map(c=><button key={c.id} className={`conversation-item ${selectedId===c.id?'selected':''}`} onClick={()=>setSelectedId(c.id)}><div className="channel-bubble">{channelIcon(c.channel_connections?.channel)}</div><div className="conversation-copy"><div><strong>{c.contacts?`${c.contacts.first_name} ${c.contacts.last_name||''}`:'Contacto sin identificar'}</strong><small>{formatTime(c.last_message_at)}</small></div><span>{labelChannel(c.channel_connections?.channel||'')} · {labelStatus(c.status)}</span><p>{c.subject||'Conversación de cliente'}</p></div>{c.unread_count>0&&<b className="unread">{c.unread_count}</b>}</button>)}</div></section>
  <section className="chat panel">{!selected?<div className="empty"><MessageCircle size={28}/><strong>Elegí una conversación</strong><span>Acá vas a responder consultas sin cambiar de plataforma.</span></div>:<><div className="chat-head"><div className="chat-person"><div className="contact-avatar">{selected.contacts?.first_name?.[0]||'?'}</div><div><strong>{selected.contacts?`${selected.contacts.first_name} ${selected.contacts.last_name||''}`:'Contacto'}</strong><span>{labelChannel(selected.channel_connections?.channel||'')} {selected.channel_connections?.settings?.mode==='test'?'· Prueba':''}</span></div></div><select value={selected.status} onChange={e=>updateConversation({status:e.target.value})}><option value="open">Abierta</option><option value="pending">Pendiente</option><option value="closed">Cerrada</option></select></div><div className="message-stream">{messages.map(m=><div key={m.id} className={`message-line ${m.direction}`}><div className="message-bubble"><p>{m.body}</p><small>{formatTime(m.sent_at)} · {m.status}</small></div></div>)}</div><form className="composer" onSubmit={sendReply}><textarea value={reply} onChange={e=>setReply(e.target.value)} placeholder="Escribí una respuesta..."/><button className="primary" disabled={busy||!reply.trim()}><Send size={16}/> Enviar</button></form></>}</section>
  <aside className="inbox-side panel">{!selected?<div className="mini-empty">Información del cliente</div>:<><div className="side-profile"><div className="profile-avatar small">{selected.contacts?.first_name?.[0]||'?'}</div><strong>{selected.contacts?`${selected.contacts.first_name} ${selected.contacts.last_name||''}`:'Sin contacto'}</strong>{selected.contacts&&<Link className="inline-link" href={`/contacts/${selected.contacts.id}`}>Ver Cliente 360°</Link>}</div><div className="side-section"><span className="side-label">Responsable</span><select value={selected.assigned_user_id||''} onChange={e=>updateConversation({assigned_user_id:e.target.value||null})}><option value="">Sin asignar</option>{members.map(m=><option key={m.user_id} value={m.user_id}>{m.profiles?.full_name||'Usuario'} · {m.role}</option>)}</select></div><div className="side-section"><span className="side-label">Prioridad</span><select value={selected.priority} onChange={e=>updateConversation({priority:e.target.value})}><option value="low">Baja</option><option value="normal">Normal</option><option value="high">Alta</option><option value="urgent">Urgente</option></select></div><div className="side-section"><span className="side-label">Canal</span><div className="side-value">{channelIcon(selected.channel_connections?.channel)} {labelChannel(selected.channel_connections?.channel||'')}</div></div><div className="side-section"><span className="side-label">Contacto</span><div className="side-info"><span>{selected.contacts?.email||'Sin email'}</span><span>{selected.contacts?.phone||'Sin teléfono'}</span></div></div><div className="side-section"><span className="side-label">Venta</span><button className="primary full" onClick={startOpportunity}><BadgeDollarSign size={16}/> Crear oportunidad</button><Link className="inline-link" href="/opportunities">Ver oportunidades</Link></div><div className="side-section"><button className="secondary full" onClick={()=>updateConversation({status:'closed'})}>Cerrar conversación</button></div></>}</aside>
 </div>
 {openNew&&<div className="modal-backdrop" onClick={()=>setOpenNew(false)}><div className="modal" onClick={e=>e.stopPropagation()}><div><h2>Nueva conversación de prueba</h2><p>Simulá una consulta para probar el flujo completo del Inbox.</p></div><form onSubmit={createConversation}><label>Contacto<select required value={newConv.contact_id} onChange={e=>setNewConv({...newConv,contact_id:e.target.value})}><option value="">Elegí un contacto</option>{contacts.map(c=><option key={c.id} value={c.id}>{c.first_name} {c.last_name||''}</option>)}</select></label><label>Canal<select value={newConv.channel} onChange={e=>setNewConv({...newConv,channel:e.target.value})}>{channels.map(c=><option key={c} value={c}>{labelChannel(c)}</option>)}</select></label><label>Mensaje inicial<textarea className="modal-textarea" value={newConv.message} onChange={e=>setNewConv({...newConv,message:e.target.value})}/></label><div className="modal-actions"><button type="button" className="secondary" onClick={()=>setOpenNew(false)}>Cancelar</button><button className="primary" disabled={busy}>{busy?'Creando…':'Crear conversación'}</button></div></form></div></div>}
 {openOpp&&<div className="modal-backdrop" onClick={()=>setOpenOpp(false)}><div className="modal" onClick={e=>e.stopPropagation()}><div><h2>Crear oportunidad</h2><p>Convertí esta conversación en una venta en seguimiento.</p></div><form onSubmit={createOpportunity}><label>Nombre de la oportunidad<input required value={opp.name} onChange={e=>setOpp({...opp,name:e.target.value})}/></label><label>Monto estimado (ARS)<input type="number" min="0" step="0.01" placeholder="Opcional" value={opp.amount} onChange={e=>setOpp({...opp,amount:e.target.value})}/></label><label>Etapa<select required value={opp.stage_id} onChange={e=>setOpp({...opp,stage_id:e.target.value})}>{stages.map(s=><option key={s.id} value={s.id}>{s.name} · {s.probability}%</option>)}</select></label><label>Fecha estimada de cierre<input type="date" value={opp.expected_close_date} onChange={e=>setOpp({...opp,expected_close_date:e.target.value})}/></label><div className="modal-actions"><button type="button" className="secondary" onClick={()=>setOpenOpp(false)}>Cancelar</button><button className="primary" disabled={busy}>{busy?'Creando…':'Crear oportunidad'}</button></div></form></div></div>}
 </div></AppShell>
}
function labelChannel(v:string){return ({instagram:'Instagram',facebook:'Facebook',whatsapp:'WhatsApp',mercadolibre:'Mercado Libre',tiktok:'TikTok',manual:'Manual'} as Record<string,string>)[v]||v}
function labelStatus(v:string){return ({open:'Abierta',pending:'Pendiente',closed:'Cerrada'} as Record<string,string>)[v]||v}
function formatTime(v:string|null){if(!v)return '';return new Date(v).toLocaleString('es-AR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}
function channelIcon(v?:string|null){const p={size:16};if(v==='instagram')return <Instagram {...p}/>;if(v==='facebook')return <Facebook {...p}/>;if(v==='whatsapp')return <MessageCircle {...p}/>;if(v==='mercadolibre')return <Store {...p}/>;if(v==='tiktok')return <Music2 {...p}/>;return <MessageCircle {...p}/>}
