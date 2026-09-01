'use client'
import {useEffect} from 'react'
import {supabase} from '@/lib/supabase'

type MediaRow={id:string;attachments:any[];sent_at:string}

type MediaItem={type:string;url:string;title?:string}

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

  function mediaItem(row:MediaRow):MediaItem|null{
   const item=Array.isArray(row.attachments)?row.attachments.find((a:any)=>a?.payload?.url):null
   if(!item?.payload?.url)return null
   return {type:String(item.type||'').toLowerCase(),url:String(item.payload.url),title:item.payload.title?String(item.payload.title):undefined}
  }

  function instagramEmbedUrl(url:string){
   try{
    const parsed=new URL(url)
    if(!/instagram\.com$/i.test(parsed.hostname.replace(/^www\./,'')))return ''
    const match=parsed.pathname.match(/^\/(reel|p|tv)\/([^/]+)/i)
    if(!match)return ''
    return `https://www.instagram.com/${match[1].toLowerCase()}/${match[2]}/embed/`
   }catch{return ''}
  }

  function mountMedia(bubble:HTMLElement,row:MediaRow){
   const item=mediaItem(row)
   if(!item||bubble.dataset.mediaMessageId===row.id)return
   const label=bubble.querySelector('p') as HTMLElement|null
   if(label)label.style.display='none'
   bubble.querySelector('.lumo-media-preview')?.remove()

   const wrap=document.createElement('div')
   wrap.className='lumo-media-preview'
   wrap.style.display='block'
   wrap.style.marginBottom='6px'
   wrap.style.maxWidth='340px'

   if(item.type==='image'){
    const link=document.createElement('a')
    link.href=item.url
    link.target='_blank'
    link.rel='noreferrer'
    link.style.display='block'
    const img=document.createElement('img')
    img.src=item.url
    img.alt='Imagen recibida por Instagram'
    img.referrerPolicy='no-referrer'
    img.style.display='block'
    img.style.width='min(320px, 100%)'
    img.style.maxHeight='420px'
    img.style.objectFit='cover'
    img.style.borderRadius='12px'
    img.style.cursor='zoom-in'
    img.addEventListener('error',()=>{wrap.remove();if(label)label.style.display=''}, {once:true})
    link.appendChild(img);wrap.appendChild(link)
   }else if(item.type==='video'){
    const video=document.createElement('video')
    video.src=item.url
    video.controls=true
    video.preload='metadata'
    video.playsInline=true
    video.style.display='block'
    video.style.width='min(320px, 100%)'
    video.style.maxHeight='420px'
    video.style.borderRadius='12px'
    video.addEventListener('error',()=>{wrap.remove();if(label)label.style.display=''}, {once:true})
    wrap.appendChild(video)
   }else if(item.type==='audio'){
    const audio=document.createElement('audio')
    audio.src=item.url
    audio.controls=true
    audio.preload='metadata'
    audio.style.display='block'
    audio.style.width='min(320px, 100%)'
    audio.addEventListener('error',()=>{wrap.remove();if(label)label.style.display=''}, {once:true})
    wrap.appendChild(audio)
   }else if(item.type==='ig_reel'){
    const embed=instagramEmbedUrl(item.url)
    if(embed){
     const iframe=document.createElement('iframe')
     iframe.src=embed
     iframe.title=item.title||'Reel de Instagram'
     iframe.loading='lazy'
     iframe.allow='autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share'
     iframe.style.display='block'
     iframe.style.width='min(326px, 100%)'
     iframe.style.height='500px'
     iframe.style.border='0'
     iframe.style.borderRadius='12px'
     iframe.style.background='#fff'
     wrap.appendChild(iframe)
    }
    const link=document.createElement('a')
    link.href=item.url
    link.target='_blank'
    link.rel='noreferrer'
    link.textContent=item.title?`Ver Reel: ${item.title}`:'Ver Reel en Instagram'
    link.style.display='block'
    link.style.fontSize='12px'
    link.style.marginTop='6px'
    link.style.textDecoration='underline'
    wrap.appendChild(link)
   }else{
    if(label)label.style.display=''
    return
   }

   bubble.insertBefore(wrap,bubble.firstChild)
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

   const media=(data||[]).filter((row:any)=>mediaItem(row as MediaRow)) as MediaRow[]
   const bubbles=[...document.querySelectorAll<HTMLElement>('.message-line.incoming .message-bubble')]
    .filter(b=>/Adjunto:\s*(image|video|audio|ig_reel)/i.test(b.textContent||''))
   bubbles.forEach((bubble,index)=>{const row=media[index];if(row)mountMedia(bubble,row)})
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
