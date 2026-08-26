'use client'
import {FormEvent,useEffect,useMemo,useState} from 'react'
import Link from 'next/link'
import {AppShell} from '@/components/AppShell'
import {supabase} from '@/lib/supabase'
import {Search,Send,Instagram,Facebook,MessageCircle,Store,Music2,RefreshCw,Wifi,Check,Mail,MailOpen,Clock3,StickyNote,Users,Archive,RotateCcw,X,ChevronDown} from 'lucide-react'

type Contact={id:string;first_name:string;last_name:string|null;email:string|null;phone:string|null}
type Member={user_id:string;role:string;profiles:{full_name:string|null}|null}
type Connection={id:string;channel:string;name:string;settings:any}
type Note={id:string;body:string;created_at:string;created_by:string|null}
type Conversation={id:string;workspace_id:string;contact_id:string|null;channel_connection_id:string;status:string;priority:string;assigned_user_id:string|null;last_message_at:string|null;unread_count:number;subject:string|null;metadata:any;contacts:Contact|null;channel_connections:Connection|null}
type Message={id:string;conversation_id:string;direction:string;sender_type:string;body:string|null;sent_at:string;status:string}
type Preview={body:string|null;sent_at:string;direction:string}
const channels=['instagram','facebook','whatsapp','mercadolibre','tiktok']

export default function InboxV3(){
 const [workspaceId,setWorkspaceId]=useState<string|null>(null),[userId,setUserId]=useState<string|null>(null)
 const [members,setMembers]=useState<Member[]>([]),[conversations,setConversations]=useState<Conversation[]>([]),[previews,setPreviews]=useState<Record<string,Preview>>({}),[messages,setMessages]=useState<Message[]>([])
 const [selectedId,setSelectedId]=useState<string|null>(null),[selectedIds,setSelectedIds]=useState<string[]>([])
 const [q,setQ]=useState(''),[statusFilter,setStatusFilter]=useState('open'),[channelFilter,setChannelFilter]=useState('all'),[reply,setReply]=useState(''),[note,setNote]=useState('')
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState(''),[live,setLive]=useState(false),[showSnooze,setShowSnooze]=useState(false)
 const selected=conversations.find(c=>c.id===selectedId)||null

 async function bootstrap(){
  const {data:{user}}=await supabase.auth.getUser();if(!user)return;setUserId(user.id)
  const {data:mem,error:e}=await supabase.from('workspace_members').select('workspace_id').eq('user_id',user.id).eq('status','active').limit(1).single();if(e||!mem){setError(e?.message||'No encontramos tu espacio de trabajo.');return}
  setWorkspaceId(mem.workspace_id)
  const {data:ms}=await supabase.from('workspace_members').select('user_id,role,profiles(full_name)').eq('workspace_id',mem.workspace_id).eq('status','active')
  setMembers((ms||[]) as unknown as Member[]);await loadConversations(mem.workspace_id)
 }
 async function loadConversations(wid=workspaceId){
  if(!wid)return
  const {data,error:e}=await supabase.from('conversations').select('id,workspace_id,contact_id,channel_connection_id,status,priority,assigned_user_id,last_message_at,unread_count,subject,metadata,contacts(id,first_name,last_name,email,phone),channel_connections(id,channel,name,settings)').eq('workspace_id',wid).order('last_message_at',{ascending:false,nullsFirst:false})
  if(e){setError(e.message);return}
  const rows=(data||[]) as unknown as Conversation[];setConversations(rows);if(!selectedId&&rows.length)setSelectedId(rows[0].id);await loadPreviews(rows.map(r=>r.id))
 }
 async function loadPreviews(ids:string[]){
  if(!ids.length){setPreviews({});return}
  const {data}=await supabase.from('messages').select('conversation_id,body,sent_at,direction').in('conversation_id',ids).order('sent_at',{ascending:false}).limit(Math.min(ids.length*6,300))
  const out:Record<string,Preview>={};for(const m of data||[])if(!out[m.conversation_id])out[m.conversation_id]={body:m.body,sent_at:m.sent_at,direction:m.direction};setPreviews(out)
 }
 async function loadMessages(cid:string){
  const {data,error:e}=await supabase.from('messages').select('id,conversation_id,direction,sender_type,body,sent_at,status').eq('conversation_id',cid).order('sent_at')
  if(e)setError(e.message);else setMessages((data||[]) as Message[])
  if(workspaceId){await supabase.from('conversations').update({unread_count:0}).eq('id',cid).eq('workspace_id',workspaceId);setConversations(v=>v.map(c=>c.id===cid?{...c,unread_count:0}:c))}
 }
 useEffect(()=>{bootstrap()},[])
 useEffect(()=>{if(selectedId)loadMessages(selectedId)},[selectedId,workspaceId])
 useEffect(()=>{if(!workspaceId)return;const ch=supabase.channel(`inbox-v3-${workspaceId}`)
  .on('postgres_changes',{event:'*',schema:'public',table:'conversations',filter:`workspace_id=eq.${workspaceId}`},()=>loadConversations(workspaceId))
  .on('postgres_changes',{event:'INSERT',schema:'public',table:'messages',filter:`workspace_id=eq.${workspaceId}`},(p:any)=>{const m=p.new as Message;if(m.conversation_id===selectedId)setMessages(v=>v.some(x=>x.id===m.id)?v:[...v,m]);loadConversations(workspaceId)})
  .subscribe(s=>setLive(s==='SUBSCRIBED'));return()=>{supabase.removeChannel(ch);setLive(false)}},[workspaceId,selectedId])

 const now=Date.now()
 const visible=useMemo(()=>conversations.filter(c=>{const until=c.metadata?.snoozed_until?new Date(c.metadata.snoozed_until).getTime():0;if(until>now)return false;const name=contactName(c);const preview=previews[c.id]?.body||'';const channel=c.channel_connections?.channel||'';return `${name} ${preview} ${c.subject||''}`.toLowerCase().includes(q.toLowerCase())&&(statusFilter==='all'||c.status===statusFilter)&&(channelFilter==='all'||channel===channelFilter)}),[conversations,previews,q,statusFilter,channelFilter,now])
 const unreadTotal=conversations.reduce((n,c)=>n+Number(c.unread_count||0),0)
 const notes=(selected?.metadata?.internal_notes||[]) as Note[]
 const allVisibleSelected=visible.length>0&&visible.every(c=>selectedIds.includes(c.id))

 async function updateOne(id:string,fields:Record<string,any>){if(!workspaceId)return;const {error:e}=await supabase.from('conversations').update(fields).eq('id',id).eq('workspace_id',workspaceId);if(e){setError(e.message);return false};setConversations(v=>v.map(c=>c.id===id?{...c,...fields}:c));return true}
 async function updateSelected(fields:Record<string,any>){if(!workspaceId||!selectedIds.length)return;setBusy(true);setError('');const {error:e}=await supabase.from('conversations').update(fields).eq('workspace_id',workspaceId).in('id',selectedIds);setBusy(false);if(e){setError(e.message);return};setConversations(v=>v.map(c=>selectedIds.includes(c.id)?{...c,...fields}:c));setSuccess(`${selectedIds.length} conversaciones actualizadas.`);setSelectedIds([])}
 async function assignSelected(user:string){await updateSelected({assigned_user_id:user||null})}
 async function setRead(id:string,read:boolean){await updateOne(id,{unread_count:read?0:1})}
 async function toggleClosed(c:Conversation){await updateOne(c.id,{status:c.status==='closed'?'open':'closed'})}
 async function snooze(hours:number){if(!selected)return;const until=new Date(Date.now()+hours*3600000).toISOString();const metadata={...(selected.metadata||{}),snoozed_until:until};if(await updateOne(selected.id,{metadata,status:'pending'})){setShowSnooze(false);setSuccess(`Conversación pospuesta hasta ${formatDate(until)}.`)}}
 async function unsnooze(c:Conversation){const metadata={...(c.metadata||{})};delete metadata.snoozed_until;await updateOne(c.id,{metadata,status:'open'})}
 async function saveNote(e:FormEvent){e.preventDefault();if(!selected||!note.trim())return;const item:Note={id:crypto.randomUUID(),body:note.trim(),created_at:new Date().toISOString(),created_by:userId};const metadata={...(selected.metadata||{}),internal_notes:[...(selected.metadata?.internal_notes||[]),item]};if(await updateOne(selected.id,{metadata})){setNote('');setSuccess('Nota interna guardada.')}}
 async function sendReply(e:FormEvent){e.preventDefault();if(!workspaceId||!selected||!reply.trim())return;setBusy(true);setError('');const body=reply.trim();try{const liveMeta=selected.channel_connections?.settings?.mode!=='test'&&['instagram','facebook'].includes(selected.channel_connections?.channel||'');if(liveMeta){const {data:{session}}=await supabase.auth.getSession();if(!session)throw new Error('Tu sesión expiró.');const res=await fetch('/api/integrations/meta/send',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${session.access_token}`},body:JSON.stringify({conversation_id:selected.id,body})});const result=await res.json();if(!res.ok)throw new Error(result.error||'No pudimos enviar el mensaje.')}else{const ts=new Date().toISOString();const {error:e}=await supabase.from('messages').insert({workspace_id:workspaceId,conversation_id:selected.id,direction:'outgoing',sender_type:'user',sender_user_id:userId,body,message_type:'text',status:'sent',sent_at:ts,attachments:[],metadata:{mode:selected.channel_connections?.settings?.mode||'test'}});if(e)throw e;await supabase.from('conversations').update({last_message_at:ts,last_outgoing_at:ts,status:'open'}).eq('id',selected.id)}setReply('')}catch(x:any){setError(x.message||'No pudimos enviar la respuesta')}finally{setBusy(false)}}
 function toggleSelection(id:string){setSelectedIds(v=>v.includes(id)?v.filter(x=>x!==id):[...v,id])}
 function selectAllVisible(){setSelectedIds(allVisibleSelected?[]:visible.map(c=>c.id))}

 return <AppShell><div className="page inbox-page">
  <div className="page-head"><div><h1>Inbox</h1><p>Conversaciones, asignación y seguimiento en un solo lugar.</p></div><div style={{display:'flex',gap:8,alignItems:'center'}}><span style={{fontSize:12,display:'flex',gap:5,alignItems:'center',opacity:.7}}><Wifi size={14}/>{live?'En tiempo real':'Conectando...'}</span><button className="secondary compact" onClick={()=>workspaceId&&loadConversations(workspaceId)}><RefreshCw size={15}/> Actualizar</button></div></div>
  {error&&<div className="error-banner">{error}</div>}{success&&<div className="test-banner"><strong>Listo</strong><span>{success}</span><button className="iconbtn" onClick={()=>setSuccess('')}><X size={14}/></button></div>}
  <div style={{display:'flex',gap:10,marginBottom:12,fontSize:13,opacity:.72}}><span><strong>{visible.length}</strong> conversaciones</span><span>·</span><span><strong>{unreadTotal}</strong> sin leer</span><span>·</span><span><strong>{conversations.filter(c=>c.metadata?.snoozed_until&&new Date(c.metadata.snoozed_until).getTime()>Date.now()).length}</strong> pospuestas</span></div>

  {selectedIds.length>0&&<div className="panel" style={{padding:'10px 12px',marginBottom:10,display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}><strong style={{fontSize:13}}>{selectedIds.length} seleccionadas</strong><button className="secondary compact" onClick={()=>updateSelected({unread_count:0})}><MailOpen size={14}/> Leídas</button><button className="secondary compact" onClick={()=>updateSelected({unread_count:1})}><Mail size={14}/> No leídas</button><button className="secondary compact" onClick={()=>updateSelected({status:'closed'})}><Archive size={14}/> Cerrar</button><button className="secondary compact" onClick={()=>updateSelected({status:'open'})}><RotateCcw size={14}/> Reabrir</button><select onChange={e=>assignSelected(e.target.value)} defaultValue=""><option value="" disabled>Asignar a…</option><option value="">Sin asignar</option>{members.map(m=><option key={m.user_id} value={m.user_id}>{memberName(m)}</option>)}</select><button className="iconbtn" onClick={()=>setSelectedIds([])}><X size={15}/></button></div>}

  <div className="inbox-grid">
   <section className="inbox-list panel"><div className="inbox-list-head" style={{gap:8,flexWrap:'wrap'}}><button className="iconbtn" title="Seleccionar visibles" onClick={selectAllVisible}>{allVisibleSelected?<Check size={16}/>:<span style={{width:14,height:14,border:'1px solid currentColor',borderRadius:3}}/>}</button><div className="search local" style={{minWidth:180,flex:1}}><Search size={16}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Buscar cliente o mensaje..."/></div><select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="open">Abiertas</option><option value="pending">Pendientes</option><option value="closed">Cerradas</option><option value="all">Todas</option></select><select value={channelFilter} onChange={e=>setChannelFilter(e.target.value)}><option value="all">Todos</option>{channels.map(x=><option key={x} value={x}>{labelChannel(x)}</option>)}</select></div>
    <div className="conversation-list">{visible.length===0?<div className="mini-empty">No hay conversaciones para este filtro.</div>:visible.map(c=>{const p=previews[c.id];return <div key={c.id} style={{display:'flex',alignItems:'stretch'}}><button className="iconbtn" style={{margin:'14px 0 14px 8px'}} onClick={()=>toggleSelection(c.id)} title="Seleccionar">{selectedIds.includes(c.id)?<Check size={15}/>:<span style={{width:13,height:13,border:'1px solid currentColor',borderRadius:3}}/>}</button><button style={{flex:1}} className={`conversation-item ${selectedId===c.id?'selected':''}`} onClick={()=>setSelectedId(c.id)}><div className="channel-bubble">{channelIcon(c.channel_connections?.channel)}</div><div className="conversation-copy"><div><strong>{contactName(c)}</strong><small>{formatDate(p?.sent_at||c.last_message_at)}</small></div><div style={{display:'flex',gap:5,flexWrap:'wrap',margin:'4px 0'}}><Badge text={labelChannel(c.channel_connections?.channel||'')}/><Badge text={labelStatus(c.status)}/>{c.priority!=='normal'&&<Badge text={labelPriority(c.priority)}/>}</div><p style={{fontWeight:c.unread_count>0?650:400}}>{p?.body||c.subject||'Sin mensajes todavía'}</p></div>{c.unread_count>0&&<b className="unread">{c.unread_count}</b>}</button></div>})}</div>
   </section>

   <section className="chat panel">{!selected?<div className="empty"><MessageCircle size={28}/><strong>Elegí una conversación</strong><span>Desde acá podés responder y gestionar el seguimiento.</span></div>:<><div className="chat-head" style={{gap:8,flexWrap:'wrap'}}><div className="chat-person"><div className="contact-avatar">{selected.contacts?.first_name?.[0]||'?'}</div><div><strong>{contactName(selected)}</strong><span>{labelChannel(selected.channel_connections?.channel||'')} · {selected.channel_connections?.settings?.mode==='test'?'Prueba':'En vivo'}</span></div></div><div style={{display:'flex',gap:5}}><button className="iconbtn" title={selected.unread_count?'Marcar leído':'Marcar no leído'} onClick={()=>setRead(selected.id,selected.unread_count>0)}>{selected.unread_count?<MailOpen size={16}/>:<Mail size={16}/>}</button><button className="iconbtn" title={selected.status==='closed'?'Reabrir':'Cerrar'} onClick={()=>toggleClosed(selected)}>{selected.status==='closed'?<RotateCcw size={16}/>:<Archive size={16}/>}</button><div style={{position:'relative'}}><button className="secondary compact" onClick={()=>setShowSnooze(v=>!v)}><Clock3 size={15}/> Posponer <ChevronDown size={13}/></button>{showSnooze&&<div className="panel" style={{position:'absolute',right:0,top:'calc(100% + 6px)',zIndex:20,padding:6,minWidth:170}}>{[[1,'1 hora'],[4,'4 horas'],[24,'Mañana'],[72,'3 días'],[168,'1 semana']].map(([h,l])=><button key={h} className="secondary full" style={{marginBottom:4}} onClick={()=>snooze(Number(h))}>{l}</button>)}</div>}</div></div></div>
    <div className="message-stream">{messages.length===0?<div className="mini-empty">Todavía no hay mensajes.</div>:messages.map(m=><div key={m.id} className={`message-line ${m.direction}`}><div className="message-bubble"><p>{m.body}</p><small>{formatDate(m.sent_at)} · {m.status}</small></div></div>)}</div>
    <form className="composer" onSubmit={sendReply}><textarea value={reply} onChange={e=>setReply(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();e.currentTarget.form?.requestSubmit()}}} placeholder="Escribí una respuesta..."/><button className="primary" disabled={busy||!reply.trim()}><Send size={16}/> Enviar</button></form></>}</section>

   <aside className="inbox-side panel">{!selected?<div className="mini-empty">Información del cliente</div>:<><div className="side-profile"><div className="profile-avatar small">{selected.contacts?.first_name?.[0]||'?'}</div><strong>{contactName(selected)}</strong>{selected.contacts&&<Link className="inline-link" href={`/contacts/${selected.contacts.id}`}>Ver Cliente 360°</Link>}</div><div className="side-section"><span className="side-label">Responsable</span><select value={selected.assigned_user_id||''} onChange={e=>updateOne(selected.id,{assigned_user_id:e.target.value||null})}><option value="">Sin asignar</option>{members.map(m=><option key={m.user_id} value={m.user_id}>{memberName(m)}</option>)}</select></div><div className="side-section"><span className="side-label">Prioridad</span><select value={selected.priority} onChange={e=>updateOne(selected.id,{priority:e.target.value})}><option value="low">Baja</option><option value="normal">Normal</option><option value="high">Alta</option><option value="urgent">Urgente</option></select></div><div className="side-section"><span className="side-label">Estado</span><select value={selected.status} onChange={e=>updateOne(selected.id,{status:e.target.value})}><option value="open">Abierta</option><option value="pending">Pendiente</option><option value="closed">Cerrada</option></select></div><div className="side-section"><span className="side-label">Contacto</span><div className="side-info"><span>{selected.contacts?.email||'Sin email'}</span><span>{selected.contacts?.phone||'Sin teléfono'}</span></div></div>{selected.metadata?.snoozed_until&&new Date(selected.metadata.snoozed_until).getTime()>Date.now()&&<div className="side-section"><span className="side-label">Pospuesta hasta</span><div className="side-value">{formatDate(selected.metadata.snoozed_until)}</div><button className="secondary full" onClick={()=>unsnooze(selected)}>Reactivar ahora</button></div>}<div className="side-section"><span className="side-label"><StickyNote size={14}/> Notas internas</span><form onSubmit={saveNote}><textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Nota visible solo para el equipo..." style={{width:'100%',minHeight:70,margin:'7px 0'}}/><button className="secondary full" disabled={!note.trim()}>Guardar nota</button></form><div style={{display:'flex',flexDirection:'column',gap:7,marginTop:9}}>{notes.slice().reverse().map(n=><div key={n.id} style={{padding:9,borderRadius:10,background:'rgba(100,116,139,.08)',fontSize:12}}><div>{n.body}</div><small style={{opacity:.55}}>{formatDate(n.created_at)}</small></div>)}{!notes.length&&<small style={{opacity:.55}}>Sin notas internas.</small>}</div></div></>}</aside>
  </div>
 </div></AppShell>
}

function contactName(c:Conversation){return c.contacts?`${c.contacts.first_name} ${c.contacts.last_name||''}`.trim():'Contacto sin identificar'}
function memberName(m:Member){return `${m.profiles?.full_name||'Usuario'} · ${m.role}`}
function labelChannel(v:string){return ({instagram:'Instagram',facebook:'Facebook',whatsapp:'WhatsApp',mercadolibre:'Mercado Libre',tiktok:'TikTok'} as Record<string,string>)[v]||v}
function labelStatus(v:string){return ({open:'Abierta',pending:'Pendiente',closed:'Cerrada'} as Record<string,string>)[v]||v}
function labelPriority(v:string){return ({low:'Baja',normal:'Normal',high:'Alta',urgent:'Urgente'} as Record<string,string>)[v]||v}
function formatDate(v:string|null|undefined){if(!v)return '';return new Date(v).toLocaleString('es-AR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}
function Badge({text}:{text:string}){return <span style={{fontSize:10,fontWeight:700,padding:'3px 6px',borderRadius:999,background:'rgba(100,116,139,.09)'}}>{text}</span>}
function channelIcon(v?:string|null){const p={size:16};if(v==='instagram')return <Instagram {...p}/>;if(v==='facebook')return <Facebook {...p}/>;if(v==='whatsapp')return <MessageCircle {...p}/>;if(v==='mercadolibre')return <Store {...p}/>;if(v==='tiktok')return <Music2 {...p}/>;return <MessageCircle {...p}/>}
