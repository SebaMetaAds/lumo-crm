'use client'
import {useEffect} from 'react'
import {supabase} from '@/lib/supabase'

type MediaRow={id:string;attachments:any[];sent_at:string}

export default function InboxMediaBridge(){
 useEffect(()=>{
  let cancelled=false
  let observer:MutationObserver|null=null
  let timer:number|undefined

  function currentHandle(){
   const text=document.querySelector<HTMLElement>('.chat-person')?.textContent||''
   const match=text.match(/@[A-Za-z0-9._]+/)
   return match?.[0]||''
  }

  function attachmentUrl(row:MediaRow){
   const item=Array.isArray(row.attachments)?row.attachments.find((a:any)=>a?.type==='image'&&a?.payload?.url):null
   return item?.payload?.url?String(item.payload.url):''
  }

  function mountImage(bubble:HTMLElement,row:MediaRow){
   const url=attachmentUrl(row)
   if(!url||bubble.dataset.mediaMessageId===row.id)return
   const label=bubble.querySelector('p') as HTMLElement|null
   if(label)label.style.display='none'
   bubble.querySelector('.lumo-media-preview')?.remove()

   const link=document.createElement('a')
   link.className='lumo-media-preview'
   link.href=url
   link.target='_blank'
   link.rel='noreferrer'
   link.style.display='block'
   link.style.marginBottom='6px'

   const img=document.createElement('img')
   img.src=url
   img.alt='Imagen recibida por Instagram'
   img.referrerPolicy='no-referrer'
   img.style.display='block'
   img.style.width='min(320px, 100%)'
   img.style.maxHeight='420px'
   img.style.objectFit='cover'
   img.style.borderRadius='12px'
   img.style.cursor='zoom-in'
   img.addEventListener('error',()=>{link.remove();if(label)label.style.display=''}, {once:true})
   link.appendChild(img)
   bubble.insertBefore(link,bubble.firstChild)
   bubble.dataset.mediaMessageId=row.id
  }

  async function applyMedia(){
   if(cancelled)return
   const handle=currentHandle()
   if(!handle)return

   const {data:channel}=await supabase.from('contact_channels')
    .select('contact_id')
    .eq('channel','instagram')
    .eq('handle',handle)
    .limit(1)
    .maybeSingle()
   if(cancelled||!channel?.contact_id)return

   const {data:conv}=await supabase.from('conversations')
    .select('id')
    .eq('contact_id',channel.contact_id)
    .order('last_message_at',{ascending:false})
    .limit(1)
    .maybeSingle()
   if(cancelled||!conv?.id)return

   const {data}=await supabase.from('messages')
    .select('id,attachments,sent_at')
    .eq('conversation_id',conv.id)
    .eq('direction','incoming')
    .order('sent_at',{ascending:true})
   if(cancelled)return

   const media=(data||[]).filter((row:any)=>attachmentUrl(row as MediaRow)) as MediaRow[]
   const bubbles=[...document.querySelectorAll<HTMLElement>('.message-line.incoming .message-bubble')]
    .filter(b=>/Adjunto:\s*image/i.test(b.textContent||''))
   bubbles.forEach((bubble,index)=>{const row=media[index];if(row)mountImage(bubble,row)})
  }

  let pending=false
  function schedule(){
   if(pending||cancelled)return
   pending=true
   window.setTimeout(async()=>{pending=false;await applyMedia()},120)
  }

  schedule()
  observer=new MutationObserver(schedule)
  observer.observe(document.body,{subtree:true,childList:true,characterData:true})
  timer=window.setInterval(schedule,5000)

  return()=>{cancelled=true;observer?.disconnect();if(timer)window.clearInterval(timer)}
 },[])
 return null
}
