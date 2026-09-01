'use client'
import {useEffect} from 'react'
import {supabase} from '@/lib/supabase'

export default function AutomationDraftBridge(){
 useEffect(()=>{
  let cancelled=false
  let observer:MutationObserver|null=null
  let timer:number|undefined
  const consumedKeys=new Set<string>()

  function currentHandle(){
   const text=document.querySelector<HTMLElement>('.chat-person')?.textContent||''
   const match=text.match(/@[A-Za-z0-9._]+/)
   return match?.[0]||''
  }

  function fillComposer(body:string){
   const textarea=document.querySelector<HTMLTextAreaElement>('.composer textarea')
   if(!textarea)return
   const setter=Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value')?.set
   if(setter)setter.call(textarea,body)
   else textarea.value=body
   textarea.dispatchEvent(new Event('input',{bubbles:true}))
   textarea.focus()
   textarea.setSelectionRange(textarea.value.length,textarea.value.length)
   textarea.scrollIntoView({block:'nearest',behavior:'smooth'})
  }

  async function consumeDraft(conversationId:string,metadata:any,key:string,reason:'used'|'dismissed'){
   consumedKeys.add(key)
   const next={...(metadata||{})}
   delete next.automation_draft_reply
   next.automation_draft_reply_consumed_at=new Date().toISOString()
   next.automation_draft_reply_consumed_reason=reason
   const {error}=await supabase.from('conversations').update({metadata:next}).eq('id',conversationId)
   if(error)console.error('Could not consume automation draft',error)
  }

  function mountDraft(body:string,createdAt:string,conversationId:string,metadata:any){
   const composer=document.querySelector<HTMLElement>('.composer')
   if(!composer)return
   const parent=composer.parentElement
   if(!parent)return

   const existing=document.querySelector<HTMLElement>('.lumo-automation-draft')
   const key=`${createdAt}:${body}`
   if(consumedKeys.has(key)){existing?.remove();return}
   if(existing?.dataset.draftKey===key)return
   existing?.remove()

   const box=document.createElement('div')
   box.className='lumo-automation-draft'
   box.dataset.draftKey=key
   box.style.padding='11px 12px'
   box.style.border='1px solid rgba(99,102,241,.2)'
   box.style.background='rgba(99,102,241,.055)'
   box.style.borderRadius='12px'
   box.style.margin='0 0 8px 0'
   box.style.width='100%'
   box.style.boxSizing='border-box'

   const top=document.createElement('div')
   top.style.display='flex'
   top.style.justifyContent='space-between'
   top.style.gap='10px'
   top.style.alignItems='center'
   top.style.flexWrap='wrap'

   const label=document.createElement('strong')
   label.textContent='Borrador automático · requiere aprobación'
   label.style.fontSize='12px'
   label.style.lineHeight='1.3'

   const actions=document.createElement('div')
   actions.style.display='flex'
   actions.style.gap='6px'
   actions.style.flexShrink='0'

   const use=document.createElement('button')
   use.type='button'
   use.className='primary compact'
   use.textContent='Usar borrador'
   use.addEventListener('click',()=>{
    fillComposer(body)
    box.remove()
    void consumeDraft(conversationId,metadata,key,'used')
   })

   const dismiss=document.createElement('button')
   dismiss.type='button'
   dismiss.className='secondary compact'
   dismiss.textContent='Ocultar'
   dismiss.addEventListener('click',()=>{
    box.remove()
    void consumeDraft(conversationId,metadata,key,'dismissed')
   })

   actions.append(use,dismiss)
   top.append(label,actions)

   const preview=document.createElement('div')
   preview.textContent=body
   preview.style.fontSize='13px'
   preview.style.lineHeight='1.45'
   preview.style.marginTop='8px'
   preview.style.whiteSpace='pre-wrap'
   preview.style.wordBreak='break-word'

   box.append(top,preview)
   parent.insertBefore(box,composer)
  }

  async function applyDraft(){
   if(cancelled)return
   const handle=currentHandle()
   if(!handle){document.querySelector('.lumo-automation-draft')?.remove();return}

   const {data:channel}=await supabase.from('contact_channels').select('contact_id').eq('channel','instagram').eq('handle',handle).limit(1).maybeSingle()
   if(cancelled||!channel?.contact_id)return
   const {data:conv}=await supabase.from('conversations').select('id,metadata').eq('contact_id',channel.contact_id).order('last_message_at',{ascending:false}).limit(1).maybeSingle()
   if(cancelled||!conv?.id)return
   const draft=(conv.metadata as any)?.automation_draft_reply
   const body=String(draft?.body||'').trim()
   if(!body){document.querySelector('.lumo-automation-draft')?.remove();return}
   mountDraft(body,String(draft?.created_at||''),conv.id,conv.metadata)
  }

  let pending=false
  function schedule(){
   if(pending||cancelled)return
   pending=true
   window.setTimeout(async()=>{pending=false;await applyDraft()},150)
  }

  schedule()
  observer=new MutationObserver(schedule)
  observer.observe(document.body,{subtree:true,childList:true,characterData:true})
  timer=window.setInterval(schedule,4000)
  return()=>{cancelled=true;observer?.disconnect();if(timer)window.clearInterval(timer)}
 },[])
 return null
}
