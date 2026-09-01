'use client'
import {useEffect,useMemo,useState} from 'react'
import {Tag,Plus,X,Trash2} from 'lucide-react'
import {supabase} from '@/lib/supabase'

type TagDef={id:string;name:string;color:string}
type ConvTag={conversation_id:string;tag:string}
type ConvRow={id:string;contacts:any}

const palette:Record<string,string>={indigo:'#6366f1',blue:'#3b82f6',emerald:'#10b981',amber:'#f59e0b',violet:'#8b5cf6',cyan:'#06b6d4',rose:'#f43f5e',orange:'#f97316',slate:'#64748b'}

export default function InboxTagBridge(){
 const [workspaceId,setWorkspaceId]=useState<string|null>(null)
 const [defs,setDefs]=useState<TagDef[]>([])
 const [assignments,setAssignments]=useState<ConvTag[]>([])
 const [handleMap,setHandleMap]=useState<Record<string,string>>({})
 const [selectedConvId,setSelectedConvId]=useState<string|null>(null)
 const [open,setOpen]=useState(false)
 const [filterTag,setFilterTag]=useState('')
 const [newTag,setNewTag]=useState('')
 const [busy,setBusy]=useState(false)

 const tagsByConv=useMemo(()=>{const out:Record<string,string[]>={};for(const row of assignments)(out[row.conversation_id]||=[]).push(row.tag);return out},[assignments])
 const selectedTags=selectedConvId?tagsByConv[selectedConvId]||[]:[]

 async function loadAll(){
  const {data:{user}}=await supabase.auth.getUser();if(!user)return
  const {data:mem}=await supabase.from('workspace_members').select('workspace_id').eq('user_id',user.id).eq('status','active').limit(1).maybeSingle();if(!mem?.workspace_id)return
  setWorkspaceId(mem.workspace_id)
  const [{data:tagRows},{data:assigned},{data:convs}]=await Promise.all([
   supabase.from('tag_definitions').select('id,name,color').eq('workspace_id',mem.workspace_id).order('name'),
   supabase.from('conversation_tags').select('conversation_id,tag').eq('workspace_id',mem.workspace_id),
   supabase.from('conversations').select('id,contacts(contact_channels(channel,handle,metadata))').eq('workspace_id',mem.workspace_id)
  ])
  setDefs((tagRows||[]) as TagDef[]);setAssignments((assigned||[]) as ConvTag[])
  const map:Record<string,string>={}
  for(const row of (convs||[]) as unknown as ConvRow[]){
   const channels=row.contacts?.contact_channels||[]
   for(const ch of channels){if(ch?.channel==='instagram'){const raw=String(ch.handle||ch.metadata?.username||'').trim().toLowerCase();if(raw)map[raw.startsWith('@')?raw:`@${raw}`]=row.id}}
  }
  setHandleMap(map)
 }

 useEffect(()=>{loadAll()},[])
 useEffect(()=>{if(!workspaceId)return;const ch=supabase.channel(`tag-bridge-${workspaceId}`).on('postgres_changes',{event:'*',schema:'public',table:'conversation_tags',filter:`workspace_id=eq.${workspaceId}`},loadAll).on('postgres_changes',{event:'*',schema:'public',table:'tag_definitions',filter:`workspace_id=eq.${workspaceId}`},loadAll).subscribe();return()=>{supabase.removeChannel(ch)}},[workspaceId])

 useEffect(()=>{
  let cancelled=false
  const findHandle=(text:string)=>text.match(/@[A-Za-z0-9._]+/)?.[0]?.toLowerCase()||''
  const apply=()=>{
   if(cancelled)return
   const chat=document.querySelector<HTMLElement>('.chat-person')
   const current=findHandle(chat?.textContent||'')
   setSelectedConvId(current?handleMap[current]||null:null)
   document.querySelectorAll<HTMLElement>('.conversation-item').forEach(item=>{
    const handle=findHandle(item.textContent||'');const cid=handleMap[handle];const tags=cid?(tagsByConv[cid]||[]):[]
    const wrapper=item.parentElement as HTMLElement|null
    if(wrapper)wrapper.style.display=filterTag&&(!cid||!tags.includes(filterTag))?'none':''
    item.querySelector('.lumo-conversation-tags')?.remove()
    if(!tags.length)return
    const copy=item.querySelector<HTMLElement>('.conversation-copy');if(!copy)return
    const strip=document.createElement('div');strip.className='lumo-conversation-tags';strip.style.display='flex';strip.style.gap='4px';strip.style.flexWrap='wrap';strip.style.marginTop='4px'
    tags.slice(0,3).forEach(name=>{const def=defs.find(d=>d.name===name);const chip=document.createElement('span');chip.textContent=name;chip.style.fontSize='10px';chip.style.fontWeight='700';chip.style.padding='2px 6px';chip.style.borderRadius='999px';chip.style.background=`${palette[def?.color||'slate']}18`;chip.style.color=palette[def?.color||'slate'];strip.appendChild(chip)})
    copy.appendChild(strip)
   })
  }
  apply();const obs=new MutationObserver(apply);obs.observe(document.body,{subtree:true,childList:true,characterData:true});const timer=window.setInterval(apply,1500)
  return()=>{cancelled=true;obs.disconnect();window.clearInterval(timer)}
 },[handleMap,tagsByConv,defs,filterTag])

 async function addTag(name:string){if(!workspaceId||!selectedConvId||!name||selectedTags.includes(name))return;setBusy(true);await supabase.from('conversation_tags').insert({workspace_id:workspaceId,conversation_id:selectedConvId,tag:name});setBusy(false);await loadAll()}
 async function removeTag(name:string){if(!workspaceId||!selectedConvId)return;setBusy(true);await supabase.from('conversation_tags').delete().eq('workspace_id',workspaceId).eq('conversation_id',selectedConvId).eq('tag',name);setBusy(false);await loadAll()}
 async function createTag(){const name=newTag.trim();if(!workspaceId||!name)return;setBusy(true);const {error}=await supabase.from('tag_definitions').insert({workspace_id:workspaceId,name,color:'slate'});setBusy(false);if(!error){setNewTag('');await loadAll();if(selectedConvId)await addTag(name)}}
 async function deleteDef(def:TagDef){if(!workspaceId)return;setBusy(true);await supabase.from('conversation_tags').delete().eq('workspace_id',workspaceId).eq('tag',def.name);await supabase.from('tag_definitions').delete().eq('id',def.id).eq('workspace_id',workspaceId);setBusy(false);if(filterTag===def.name)setFilterTag('');await loadAll()}

 return <>
  <button onClick={()=>setOpen(v=>!v)} style={{position:'fixed',right:22,bottom:22,zIndex:80,border:0,borderRadius:999,padding:'11px 15px',display:'flex',gap:7,alignItems:'center',fontWeight:800,boxShadow:'0 10px 30px rgba(15,23,42,.18)',background:'#111827',color:'#fff',cursor:'pointer'}}><Tag size={15}/> Etiquetas</button>
  {open&&<div className="panel" style={{position:'fixed',right:22,bottom:72,zIndex:90,width:340,maxHeight:'72vh',overflow:'auto',padding:14,boxShadow:'0 18px 50px rgba(15,23,42,.2)'}}>
   <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8}}><div><strong>Etiquetas</strong><div style={{fontSize:11,opacity:.58,marginTop:2}}>Clasificá y filtrá conversaciones</div></div><button className="iconbtn" onClick={()=>setOpen(false)}><X size={15}/></button></div>
   <div style={{marginTop:12}}><label style={{fontSize:11,fontWeight:800,display:'block',marginBottom:5}}>FILTRAR INBOX</label><select value={filterTag} onChange={e=>setFilterTag(e.target.value)} style={{width:'100%'}}><option value="">Todas las etiquetas</option>{defs.map(d=><option key={d.id} value={d.name}>{d.name}</option>)}</select></div>
   <div style={{marginTop:14,borderTop:'1px solid rgba(100,116,139,.16)',paddingTop:12}}><label style={{fontSize:11,fontWeight:800,display:'block',marginBottom:7}}>CONVERSACIÓN ACTUAL</label>{!selectedConvId?<div style={{fontSize:12,opacity:.6}}>Abrí una conversación para etiquetarla.</div>:<><div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:8}}>{selectedTags.length?selectedTags.map(name=>{const def=defs.find(d=>d.name===name);return <button key={name} disabled={busy} onClick={()=>removeTag(name)} title="Quitar etiqueta" style={{border:0,borderRadius:999,padding:'5px 8px',fontSize:11,fontWeight:800,background:`${palette[def?.color||'slate']}18`,color:palette[def?.color||'slate'],cursor:'pointer'}}>{name} ×</button>}):<span style={{fontSize:12,opacity:.6}}>Sin etiquetas</span>}</div><select defaultValue="" disabled={busy} onChange={e=>{if(e.target.value){addTag(e.target.value);e.target.value=''}}} style={{width:'100%'}}><option value="" disabled>+ Agregar etiqueta</option>{defs.filter(d=>!selectedTags.includes(d.name)).map(d=><option key={d.id} value={d.name}>{d.name}</option>)}</select></>}</div>
   <div style={{marginTop:14,borderTop:'1px solid rgba(100,116,139,.16)',paddingTop:12}}><label style={{fontSize:11,fontWeight:800,display:'block',marginBottom:7}}>CREAR ETIQUETA</label><div style={{display:'flex',gap:6}}><input value={newTag} onChange={e=>setNewTag(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();createTag()}}} placeholder="Ej. Consulta cuotas" style={{flex:1}}/><button className="secondary compact" disabled={busy||!newTag.trim()} onClick={createTag}><Plus size={14}/> Crear</button></div></div>
   <div style={{marginTop:14,borderTop:'1px solid rgba(100,116,139,.16)',paddingTop:12}}><label style={{fontSize:11,fontWeight:800,display:'block',marginBottom:7}}>ADMINISTRAR</label>{defs.map(def=><div key={def.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,padding:'6px 0'}}><span style={{display:'flex',alignItems:'center',gap:7,fontSize:12}}><i style={{width:9,height:9,borderRadius:999,background:palette[def.color]||palette.slate}}/>{def.name}</span><button className="iconbtn" title="Eliminar etiqueta" disabled={busy} onClick={()=>deleteDef(def)}><Trash2 size={13}/></button></div>)}</div>
  </div>}
 </>
}
