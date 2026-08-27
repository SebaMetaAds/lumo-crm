'use client'
import {useEffect,useState} from 'react'
import {BriefcaseBusiness,ChevronLeft,ChevronRight,Command,PanelRightClose,PanelRightOpen,Maximize2,Minimize2,X} from 'lucide-react'
import InboxV4 from '@/components/InboxV4'
import InboxOpportunityBar from '@/components/InboxOpportunityBar'
import {supabase} from '@/lib/supabase'
import '@/app/inbox-v6.css'

export default function InboxV6(){
 const [focus,setFocus]=useState(false)
 const [showInfo,setShowInfo]=useState(true)
 const [showCommercial,setShowCommercial]=useState(false)
 const [showShortcuts,setShowShortcuts]=useState(false)

 useEffect(()=>{
  document.body.classList.toggle('inbox-focus-mode',focus)
  document.body.classList.toggle('inbox-hide-info',!showInfo)
  return()=>{document.body.classList.remove('inbox-focus-mode','inbox-hide-info')}
 },[focus,showInfo])

 useEffect(()=>{
  let cancelled=false
  async function syncInstagram(){
   try{
    const {data:{session}}=await supabase.auth.getSession()
    if(cancelled||!session?.access_token)return
    await fetch('/api/integrations/meta/sync',{method:'POST',headers:{Authorization:`Bearer ${session.access_token}`}})
   }catch{}
  }
  syncInstagram()
  const timer=window.setInterval(syncInstagram,15000)
  return()=>{cancelled=true;window.clearInterval(timer)}
 },[])

 useEffect(()=>{
  function navigate(delta:number){
   const items=[...document.querySelectorAll<HTMLButtonElement>('.conversation-item')]
   if(!items.length)return
   const current=items.findIndex(x=>x.classList.contains('selected'))
   const next=current<0?0:Math.min(items.length-1,Math.max(0,current+delta))
   items[next]?.click();items[next]?.scrollIntoView({block:'nearest',behavior:'smooth'})
  }
  function onKey(e:KeyboardEvent){
   const tag=(e.target as HTMLElement)?.tagName?.toLowerCase()
   if(['input','textarea','select'].includes(tag))return
   if(e.key==='ArrowDown'){e.preventDefault();navigate(1)}
   if(e.key==='ArrowUp'){e.preventDefault();navigate(-1)}
   if(e.key.toLowerCase()==='f'){setFocus(v=>!v)}
   if(e.key.toLowerCase()==='i'){setShowInfo(v=>!v)}
   if(e.key.toLowerCase()==='o'){setShowCommercial(v=>!v)}
   if(e.key==='Escape'){setFocus(false);setShowCommercial(false);setShowShortcuts(false)}
   if(e.key==='?')setShowShortcuts(v=>!v)
  }
  window.addEventListener('keydown',onKey)
  return()=>window.removeEventListener('keydown',onKey)
 },[])

 function move(delta:number){
  const items=[...document.querySelectorAll<HTMLButtonElement>('.conversation-item')]
  if(!items.length)return
  const current=items.findIndex(x=>x.classList.contains('selected'))
  const next=current<0?0:Math.min(items.length-1,Math.max(0,current+delta))
  items[next]?.click();items[next]?.scrollIntoView({block:'nearest',behavior:'smooth'})
 }

 return <div className="inbox-v6-shell">
  <div className="inbox-v6-floating-tools">
   <button className="v6-tool" title="Conversación anterior" onClick={()=>move(-1)}><ChevronLeft size={15}/></button>
   <button className="v6-tool" title="Conversación siguiente" onClick={()=>move(1)}><ChevronRight size={15}/></button>
   <span className="v6-divider"/>
   <button className={`v6-tool ${focus?'active':''}`} title="Modo foco (F)" onClick={()=>setFocus(v=>!v)}>{focus?<Minimize2 size={15}/>:<Maximize2 size={15}/>}</button>
   <button className={`v6-tool ${showInfo?'active':''}`} title="Mostrar/ocultar información (I)" onClick={()=>setShowInfo(v=>!v)}>{showInfo?<PanelRightClose size={15}/>:<PanelRightOpen size={15}/>}</button>
   <button className={`v6-tool ${showCommercial?'active':''}`} title="Gestión comercial (O)" onClick={()=>setShowCommercial(v=>!v)}><BriefcaseBusiness size={15}/></button>
   <button className={`v6-tool ${showShortcuts?'active':''}`} title="Atajos (?)" onClick={()=>setShowShortcuts(v=>!v)}><Command size={15}/></button>
  </div>

  {showCommercial&&<div className="inbox-v6-commercial-dock"><div className="v6-dock-head"><div><BriefcaseBusiness size={16}/><strong>Gestión comercial</strong></div><button className="v6-close" onClick={()=>setShowCommercial(false)}><X size={14}/></button></div><InboxOpportunityBar/></div>}

  {showShortcuts&&<div className="inbox-v6-shortcuts panel"><div className="v6-dock-head"><strong>Atajos del Inbox</strong><button className="v6-close" onClick={()=>setShowShortcuts(false)}><X size={14}/></button></div><div className="v6-shortcut-grid"><span><kbd>↑</kbd><kbd>↓</kbd> Cambiar conversación</span><span><kbd>F</kbd> Modo foco</span><span><kbd>I</kbd> Panel de información</span><span><kbd>O</kbd> Gestión comercial</span><span><kbd>?</kbd> Ver atajos</span><span><kbd>Esc</kbd> Salir</span></div></div>}

  <InboxV4/>
 </div>
}
