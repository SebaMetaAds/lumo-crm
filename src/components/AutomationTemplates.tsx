'use client'
import {useEffect,useState} from 'react'
import {CreditCard,Flame,MessageSquareText,PackageCheck,ScanSearch,Tag,Truck,TriangleAlert,X,Zap} from 'lucide-react'
import {supabase} from '@/lib/supabase'

type Template={key:string;name:string;description:string;intent:string;icon:any;actions:{type:string;value:string}[]}

const templates:Template[]=[
 {key:'stock',name:'Detectar consultas de stock',description:'Etiqueta la conversación como Stock cuando Lumo detecta una consulta de disponibilidad.',intent:'availability',icon:PackageCheck,actions:[{type:'add_tag',value:'Stock'}]},
 {key:'shipping',name:'Detectar consultas de envíos',description:'Etiqueta automáticamente las consultas relacionadas con entrega o envío.',intent:'shipping',icon:Truck,actions:[{type:'add_tag',value:'Envíos'}]},
 {key:'complaint',name:'Priorizar reclamos',description:'Marca como Reclamo y cambia la prioridad a Urgente para que no quede enterrado en el Inbox.',intent:'complaint',icon:TriangleAlert,actions:[{type:'add_tag',value:'Reclamo'},{type:'set_priority',value:'urgent'}]},
 {key:'hot',name:'Detectar clientes calientes',description:'Cuando detecta intención de compra, etiqueta Cliente caliente y sube la prioridad a Alta.',intent:'purchase',icon:Flame,actions:[{type:'add_tag',value:'Cliente caliente'},{type:'set_priority',value:'high'}]},
 {key:'draft-stock',name:'Preparar borrador para stock',description:'Cuando detecta una consulta de stock, prepara una respuesta sugerida en el Inbox. Nunca la envía sin tu aprobación.',intent:'availability',icon:MessageSquareText,actions:[{type:'draft_reply',value:'__suggested__'}]},
 {key:'draft-shipping',name:'Preparar borrador para envíos',description:'Cuando detecta una consulta de envío, prepara una respuesta sugerida lista para revisar y enviar.',intent:'shipping',icon:MessageSquareText,actions:[{type:'draft_reply',value:'__suggested__'}]},
 {key:'draft-price',name:'Preparar borrador para precios',description:'Cuando detecta una consulta de precio, prepara una respuesta para revisar sin asumir valores que Lumo todavía no conoce.',intent:'price',icon:Tag,actions:[{type:'draft_reply',value:'__suggested__'}]},
 {key:'draft-payment',name:'Preparar borrador para pagos',description:'Cuando detecta una consulta sobre cuotas o medios de pago, prepara un borrador pendiente de aprobación.',intent:'payment',icon:CreditCard,actions:[{type:'draft_reply',value:'__suggested__'}]},
 {key:'draft-product',name:'Preparar borrador para producto',description:'Cuando detecta una consulta de medidas, material, color o uso, prepara una respuesta para completar con la información del producto.',intent:'product',icon:ScanSearch,actions:[{type:'draft_reply',value:'__suggested__'}]},
]

export default function AutomationTemplates(){
 const [workspaceId,setWorkspaceId]=useState<string|null>(null)
 const [userId,setUserId]=useState<string|null>(null)
 const [existing,setExisting]=useState<string[]>([])
 const [busy,setBusy]=useState<string|null>(null)
 const [message,setMessage]=useState('')
 const [open,setOpen]=useState(false)

 useEffect(()=>{bootstrap()},[])
 async function bootstrap(){
  const {data:{user}}=await supabase.auth.getUser();if(!user)return
  setUserId(user.id)
  const {data:member}=await supabase.from('workspace_members').select('workspace_id').eq('user_id',user.id).eq('status','active').limit(1).maybeSingle()
  if(!member?.workspace_id)return
  setWorkspaceId(member.workspace_id)
  await loadExisting(member.workspace_id)
 }
 async function loadExisting(wid:string){
  const {data}=await supabase.from('automations').select('name').eq('workspace_id',wid)
  setExisting((data||[]).map((r:any)=>String(r.name)))
 }
 async function activate(t:Template){
  if(!workspaceId||!userId)return
  setBusy(t.key);setMessage('')
  const {error}=await supabase.from('automations').insert({
   workspace_id:workspaceId,name:t.name,description:t.description,status:'active',trigger_type:'message_received',trigger_config:{},
   condition_config:{logic:'and',conditions:[{field:'intent',operator:'equals',value:t.intent}]},
   action_type:t.actions[0].type,action_config:{actions:t.actions.map(a=>({type:a.type,config:{value:a.value}}))},created_by:userId,
  })
  setBusy(null)
  if(error){setMessage(error.message);return}
  setMessage(`Activada: ${t.name}`)
  await loadExisting(workspaceId)
  window.setTimeout(()=>window.location.reload(),700)
 }

 return <>
  <button className="primary compact" onClick={()=>setOpen(v=>!v)} style={{position:'fixed',right:22,bottom:22,zIndex:70,boxShadow:'0 12px 30px rgba(15,23,42,.18)'}}><Zap size={16}/> Recomendadas</button>
  {open&&<div className="panel" style={{position:'fixed',right:22,bottom:72,zIndex:71,width:'min(720px,calc(100vw - 44px))',maxHeight:'72vh',overflow:'auto',padding:16,boxShadow:'0 22px 60px rgba(15,23,42,.22)'}}>
   <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:12,marginBottom:12}}><div><div style={{display:'flex',gap:7,alignItems:'center'}}><Zap size={17}/><strong>Automatizaciones recomendadas para el Inbox</strong></div><p style={{margin:'4px 0 0',fontSize:13,opacity:.64}}>Podés clasificar, priorizar y preparar borradores. Los borradores nunca se envían sin tu aprobación.</p></div><button className="iconbtn" onClick={()=>setOpen(false)}><X size={15}/></button></div>
   {message&&<div style={{fontSize:12,marginBottom:10,opacity:.75}}>{message}</div>}
   <div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:10}}>{templates.map(t=>{const Icon=t.icon,active=existing.includes(t.name);return <div key={t.key} style={{border:'1px solid rgba(15,23,42,.09)',borderRadius:12,padding:13,display:'flex',gap:11,alignItems:'flex-start'}}><div style={{width:34,height:34,borderRadius:10,display:'grid',placeItems:'center',background:'rgba(99,102,241,.08)',flex:'0 0 auto'}}><Icon size={17}/></div><div style={{minWidth:0,flex:1}}><strong style={{display:'block',fontSize:13}}>{t.name}</strong><span style={{display:'block',fontSize:12,lineHeight:1.4,opacity:.62,marginTop:3}}>{t.description}</span><button className={active?'secondary compact':'primary compact'} style={{marginTop:9}} disabled={active||busy===t.key} onClick={()=>activate(t)}>{active?'Ya creada':busy===t.key?'Activando…':'Activar'}</button></div></div>})}</div>
  </div>}
 </>
}
