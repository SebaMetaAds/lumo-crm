'use client'
import {FormEvent,useEffect,useMemo,useState} from 'react'
import {MessageSquareText,Plus,Search,Pencil,Trash2,X} from 'lucide-react'
import {supabase} from '@/lib/supabase'

type QuickReply={id:string;workspace_id:string;title:string;body:string;category:string|null;shortcut:string|null;sort_order:number;is_active:boolean}

export default function QuickRepliesBridge(){
 const [workspaceId,setWorkspaceId]=useState<string|null>(null)
 const [items,setItems]=useState<QuickReply[]>([])
 const [open,setOpen]=useState(false)
 const [query,setQuery]=useState('')
 const [editing,setEditing]=useState<QuickReply|null>(null)
 const [title,setTitle]=useState('')
 const [body,setBody]=useState('')
 const [category,setCategory]=useState('')
 const [shortcut,setShortcut]=useState('')
 const [saving,setSaving]=useState(false)
 const [error,setError]=useState('')

 async function bootstrap(){
  const {data:{user}}=await supabase.auth.getUser()
  if(!user)return
  const {data:member}=await supabase.from('workspace_members').select('workspace_id').eq('user_id',user.id).eq('status','active').limit(1).maybeSingle()
  if(!member?.workspace_id)return
  setWorkspaceId(member.workspace_id)
  await load(member.workspace_id)
 }

 async function load(wid=workspaceId){
  if(!wid)return
  const {data,error:e}=await supabase.from('quick_replies').select('id,workspace_id,title,body,category,shortcut,sort_order,is_active').eq('workspace_id',wid).eq('is_active',true).order('sort_order').order('title')
  if(e){setError(e.message);return}
  setItems((data||[]) as QuickReply[])
 }

 useEffect(()=>{bootstrap()},[])

 useEffect(()=>{
  let button:HTMLButtonElement|null=null
  let observer:MutationObserver|null=null
  const mount=()=>{
   const composer=document.querySelector<HTMLFormElement>('.composer')
   if(!composer||composer.querySelector('.quick-replies-trigger'))return
   button=document.createElement('button')
   button.type='button'
   button.className='secondary compact quick-replies-trigger'
   button.title='Respuestas rápidas'
   button.innerHTML='⚡ Respuestas'
   button.style.whiteSpace='nowrap'
   button.addEventListener('click',()=>setOpen(true))
   composer.insertBefore(button,composer.firstChild)
  }
  mount()
  observer=new MutationObserver(mount)
  observer.observe(document.body,{subtree:true,childList:true})
  return()=>{observer?.disconnect();button?.remove()}
 },[])

 useEffect(()=>{
  function onKey(e:KeyboardEvent){
   if(e.key==='Escape'&&open){setOpen(false);setEditing(null)}
   if((e.ctrlKey||e.metaKey)&&e.key==='/'){e.preventDefault();setOpen(true)}
  }
  window.addEventListener('keydown',onKey)
  return()=>window.removeEventListener('keydown',onKey)
 },[open])

 function putInComposer(text:string){
  const textarea=document.querySelector<HTMLTextAreaElement>('.composer textarea')
  if(!textarea)return
  const setter=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')?.set
  if(setter)setter.call(textarea,text);else textarea.value=text
  textarea.dispatchEvent(new Event('input',{bubbles:true}))
  textarea.focus()
  setOpen(false)
 }

 function beginCreate(){
  setEditing(null);setTitle('');setBody('');setCategory('');setShortcut('');setError('')
 }

 function beginEdit(item:QuickReply){
  setEditing(item);setTitle(item.title);setBody(item.body);setCategory(item.category||'');setShortcut(item.shortcut||'');setError('')
 }

 async function save(e:FormEvent){
  e.preventDefault()
  if(!workspaceId||!title.trim()||!body.trim())return
  setSaving(true);setError('')
  const normalizedShortcut=shortcut.trim()?`/${shortcut.trim().replace(/^\/+/, '')}`:null
  const payload={workspace_id:workspaceId,title:title.trim(),body:body.trim(),category:category.trim()||null,shortcut:normalizedShortcut}
  const result=editing
   ? await supabase.from('quick_replies').update(payload).eq('id',editing.id).eq('workspace_id',workspaceId)
   : await supabase.from('quick_replies').insert(payload)
  setSaving(false)
  if(result.error){setError(result.error.message);return}
  await load(workspaceId);beginCreate()
 }

 async function remove(item:QuickReply){
  if(!workspaceId||!window.confirm(`Eliminar “${item.title}”?`))return
  const {error:e}=await supabase.from('quick_replies').delete().eq('id',item.id).eq('workspace_id',workspaceId)
  if(e){setError(e.message);return}
  await load(workspaceId)
  if(editing?.id===item.id)beginCreate()
 }

 const filtered=useMemo(()=>{
  const q=query.trim().toLowerCase()
  if(!q)return items
  return items.filter(i=>`${i.title} ${i.body} ${i.category||''} ${i.shortcut||''}`.toLowerCase().includes(q))
 },[items,query])

 if(!open)return null
 return <div style={{position:'fixed',inset:0,zIndex:1000,background:'rgba(15,23,42,.38)',display:'flex',alignItems:'center',justifyContent:'center',padding:20}} onMouseDown={e=>{if(e.target===e.currentTarget)setOpen(false)}}>
  <div className="panel" style={{width:'min(860px,96vw)',maxHeight:'86vh',overflow:'hidden',display:'grid',gridTemplateColumns:'1.15fr .85fr',boxShadow:'0 24px 80px rgba(15,23,42,.28)'}}>
   <section style={{padding:18,borderRight:'1px solid rgba(100,116,139,.16)',overflow:'auto'}}>
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,marginBottom:14}}><div><strong style={{display:'flex',gap:7,alignItems:'center'}}><MessageSquareText size={17}/> Respuestas rápidas</strong><small style={{opacity:.6}}>Elegí una respuesta para insertarla en el mensaje.</small></div><button className="iconbtn" onClick={()=>setOpen(false)}><X size={16}/></button></div>
    <div className="search local" style={{marginBottom:12}}><Search size={15}/><input autoFocus value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar respuesta, categoría o atajo..."/></div>
    <div style={{display:'grid',gap:8}}>{filtered.map(item=><div key={item.id} style={{border:'1px solid rgba(100,116,139,.14)',borderRadius:11,padding:11}}><div style={{display:'flex',justifyContent:'space-between',gap:8}}><div style={{minWidth:0}}><strong style={{fontSize:13}}>{item.title}</strong><div style={{display:'flex',gap:6,marginTop:3,flexWrap:'wrap'}}>{item.category&&<small style={{opacity:.55}}>{item.category}</small>}{item.shortcut&&<small style={{fontFamily:'monospace',opacity:.7}}>{item.shortcut}</small>}</div></div><div style={{display:'flex',gap:3}}><button className="iconbtn" title="Editar" onClick={()=>beginEdit(item)}><Pencil size={14}/></button><button className="iconbtn" title="Eliminar" onClick={()=>remove(item)}><Trash2 size={14}/></button></div></div><p style={{fontSize:12,lineHeight:1.45,opacity:.78,margin:'8px 0 10px',whiteSpace:'pre-wrap'}}>{item.body}</p><button className="secondary full" style={{justifyContent:'center'}} onClick={()=>putInComposer(item.body)}>Usar respuesta</button></div>)}{!filtered.length&&<div style={{padding:20,textAlign:'center',opacity:.55,fontSize:13}}>No encontramos respuestas.</div>}</div>
   </section>
   <section style={{padding:18,overflow:'auto'}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,marginBottom:12}}><div><strong>{editing?'Editar respuesta':'Nueva respuesta'}</strong><small style={{display:'block',opacity:.55,marginTop:2}}>Queda disponible para todo el equipo.</small></div>{editing&&<button className="secondary compact" onClick={beginCreate}><Plus size={14}/> Nueva</button>}</div>
    {error&&<div className="error-banner" style={{marginBottom:10}}>{error}</div>}
    <form onSubmit={save} style={{display:'grid',gap:10}}><label style={{fontSize:12}}>Nombre<input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Ej: Envíos" style={{display:'block',width:'100%',marginTop:4}}/></label><label style={{fontSize:12}}>Categoría<input value={category} onChange={e=>setCategory(e.target.value)} placeholder="Ej: Logística" style={{display:'block',width:'100%',marginTop:4}}/></label><label style={{fontSize:12}}>Atajo<input value={shortcut} onChange={e=>setShortcut(e.target.value)} placeholder="Ej: /envios" style={{display:'block',width:'100%',marginTop:4}}/></label><label style={{fontSize:12}}>Respuesta<textarea value={body} onChange={e=>setBody(e.target.value)} placeholder="Escribí el mensaje que querés reutilizar..." style={{display:'block',width:'100%',minHeight:150,marginTop:4}}/></label><button className="primary" disabled={saving||!title.trim()||!body.trim()}>{saving?'Guardando…':editing?'Guardar cambios':'Crear respuesta'}</button></form>
   </section>
  </div>
 </div>
}
