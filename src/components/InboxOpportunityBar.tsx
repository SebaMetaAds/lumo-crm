'use client'
import Link from 'next/link'
import {useEffect,useMemo,useState} from 'react'
import {BriefcaseBusiness,ExternalLink,Plus,RefreshCw} from 'lucide-react'
import {supabase} from '@/lib/supabase'

type Conversation={id:string;contact_id:string|null;last_message_at:string|null;contacts:{first_name:string;last_name:string|null}|null;channel_connections:{channel:string}|null}
type Opportunity={id:string;name:string;stage_id:string|null;amount:number|null;currency:string;source_channel:string|null;sales_stages:{name:string;is_won:boolean;is_lost:boolean}|null}

export default function InboxOpportunityBar(){
 const [workspaceId,setWorkspaceId]=useState<string|null>(null)
 const [conversations,setConversations]=useState<Conversation[]>([])
 const [selectedId,setSelectedId]=useState('')
 const [opportunity,setOpportunity]=useState<Opportunity|null>(null)
 const [busy,setBusy]=useState(false),[error,setError]=useState('')
 const selected=useMemo(()=>conversations.find(c=>c.id===selectedId)||null,[conversations,selectedId])

 useEffect(()=>{bootstrap()},[])
 useEffect(()=>{if(selectedId)loadOpportunity(selectedId);else setOpportunity(null)},[selectedId])
 async function bootstrap(){
  const {data:{user}}=await supabase.auth.getUser();if(!user)return
  const {data:member}=await supabase.from('workspace_members').select('workspace_id').eq('user_id',user.id).eq('status','active').limit(1).single();if(!member)return
  setWorkspaceId(member.workspace_id)
  const {data}=await supabase.from('conversations').select('id,contact_id,last_message_at,contacts(first_name,last_name),channel_connections(channel)').eq('workspace_id',member.workspace_id).order('last_message_at',{ascending:false}).limit(100)
  const rows=(data||[]) as unknown as Conversation[];setConversations(rows);if(rows.length)setSelectedId(rows[0].id)
 }
 async function auth(){const {data:{session}}=await supabase.auth.getSession();if(!session)throw new Error('Tu sesión expiró.');return session.access_token}
 async function loadOpportunity(id=selectedId){if(!id)return;setBusy(true);setError('');try{const token=await auth();const res=await fetch(`/api/inbox/opportunity?conversation_id=${encodeURIComponent(id)}`,{headers:{Authorization:`Bearer ${token}`}});const json=await res.json();if(!res.ok)throw new Error(json.error||'No pudimos consultar la oportunidad.');setOpportunity(json.opportunity||null)}catch(e:any){setError(e.message)}finally{setBusy(false)}}
 async function createOpportunity(){if(!selectedId)return;setBusy(true);setError('');try{const token=await auth();const res=await fetch('/api/inbox/opportunity',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({conversation_id:selectedId})});const json=await res.json();if(!res.ok)throw new Error(json.error||'No pudimos crear la oportunidad.');setOpportunity(json.opportunity)}catch(e:any){setError(e.message)}finally{setBusy(false)}}

 return <div className="panel" style={{padding:'12px 14px',marginBottom:12,display:'flex',gap:12,alignItems:'center',flexWrap:'wrap'}}>
  <div style={{display:'flex',alignItems:'center',gap:8,minWidth:180}}><BriefcaseBusiness size={17}/><div><strong style={{display:'block',fontSize:13}}>Gestión comercial</strong><span style={{fontSize:11,opacity:.6}}>Oportunidades desde conversaciones</span></div></div>
  <select value={selectedId} onChange={e=>setSelectedId(e.target.value)} style={{minWidth:240,flex:'1 1 280px'}}>{conversations.map(c=><option key={c.id} value={c.id}>{conversationLabel(c)}</option>)}</select>
  {busy?<span style={{fontSize:12,opacity:.6}}>Cargando…</span>:opportunity?<><div style={{fontSize:12,minWidth:190}}><strong>{opportunity.name}</strong><div style={{opacity:.6}}>{opportunity.sales_stages?.name||'Sin etapa'}{opportunity.amount?` · ${money(opportunity.amount,opportunity.currency)}`:''}</div></div><Link className="secondary compact" href={`/opportunities/${opportunity.id}`}><ExternalLink size={14}/> Abrir oportunidad</Link></>:<button className="primary compact" onClick={createOpportunity} disabled={!selectedId}><Plus size={14}/> Crear oportunidad</button>}
  <button className="iconbtn" title="Actualizar" onClick={()=>loadOpportunity()} disabled={!selectedId||busy}><RefreshCw size={14}/></button>
  {error&&<span style={{fontSize:12,color:'var(--danger,#b91c1c)'}}>{error}</span>}
 </div>
}

function conversationLabel(c:Conversation){const n=c.contacts?`${c.contacts.first_name||''} ${c.contacts.last_name||''}`.trim():'Contacto sin identificar';const ch=(c.channel_connections?.channel||'').replace('mercadolibre','Mercado Libre');return `${n}${ch?` · ${ch}`:''}`}
function money(v:number,currency:string){try{return new Intl.NumberFormat('es-AR',{style:'currency',currency:currency||'ARS',maximumFractionDigits:0}).format(Number(v))}catch{return String(v)}}
