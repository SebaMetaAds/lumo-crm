import { NextRequest, NextResponse } from 'next/server'
import { metaConfig, verifyMetaWebhookSignature } from '@/lib/meta'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(req:NextRequest){
  const url=new URL(req.url)
  const mode=(url.searchParams.get('hub.mode')||'').trim()
  const token=(url.searchParams.get('hub.verify_token')||'').trim()
  const challenge=url.searchParams.get('hub.challenge')||''
  const {verifyToken}=metaConfig()
  const expected=(verifyToken||'').trim()
  if(mode==='subscribe'&&expected&&token===expected){
    return new NextResponse(challenge,{status:200,headers:{'Content-Type':'text/plain'}})
  }
  return new NextResponse('Forbidden',{status:403})
}

export async function POST(req:NextRequest){
  try{
    const raw=await req.text()
    if(!verifyMetaWebhookSignature(raw,req.headers.get('x-hub-signature-256')))return new NextResponse('Invalid signature',{status:401})
    const payload=JSON.parse(raw)
    const channel=payload.object==='instagram'?'instagram':'facebook'
    const admin=supabaseAdmin()
    for(const entry of payload.entry||[]){
      const accountId=String(entry.id||'')
      if(!accountId)continue
      const {data:connections}=await admin.from('channel_connections').select('id,workspace_id,channel,external_account_id').eq('channel',channel).eq('external_account_id',accountId).in('status',['connected','active']).limit(5)
      for(const connection of connections||[]){
        for(const event of entry.messaging||[]){
          if(!event?.sender?.id||!event?.message)continue
          if(event.message.is_echo)continue
          const externalUserId=String(event.sender.id)
          const externalMessageId=event.message.mid?String(event.message.mid):null
          const body=event.message.text||attachmentSummary(event.message.attachments)||null
          const now=event.timestamp?new Date(Number(event.timestamp)).toISOString():new Date().toISOString()

          const {data:identity}=await admin.from('contact_channels').select('contact_id').eq('workspace_id',connection.workspace_id).eq('channel',channel).eq('external_user_id',externalUserId).limit(1).maybeSingle()
          let contactId=identity?.contact_id||null
          if(!contactId){
            const {data:contact,error:ce}=await admin.from('contacts').insert({workspace_id:connection.workspace_id,first_name:channel==='instagram'?'Instagram':'Facebook',last_name:'Lead',source:channel,last_interaction_at:now}).select('id').single()
            if(ce)throw ce
            contactId=contact.id
            const {error:ie}=await admin.from('contact_channels').insert({workspace_id:connection.workspace_id,contact_id:contactId,channel,external_user_id:externalUserId,handle:externalUserId,is_primary:true,metadata:{provider:'meta'}})
            if(ie)throw ie
          }else{
            await admin.from('contacts').update({last_interaction_at:now}).eq('id',contactId).eq('workspace_id',connection.workspace_id)
          }

          const {data:existingConv}=await admin.from('conversations').select('id,unread_count').eq('channel_connection_id',connection.id).eq('external_conversation_id',externalUserId).limit(1).maybeSingle()
          let conversation=existingConv
          if(!conversation){
            const {data:newConv,error:cve}=await admin.from('conversations').insert({workspace_id:connection.workspace_id,channel_connection_id:connection.id,contact_id:contactId,external_conversation_id:externalUserId,status:'open',priority:'normal',last_message_at:now,last_incoming_at:now,unread_count:1,metadata:{mode:'live',provider:'meta'}}).select('id,unread_count').single()
            if(cve)throw cve
            conversation=newConv
          }

          if(externalMessageId){
            const {data:dup}=await admin.from('messages').select('id').eq('conversation_id',conversation.id).eq('external_message_id',externalMessageId).limit(1)
            if(dup?.length)continue
          }
          const {error:me}=await admin.from('messages').insert({workspace_id:connection.workspace_id,conversation_id:conversation.id,external_message_id:externalMessageId,direction:'incoming',sender_type:'contact',body,message_type:event.message.attachments?.length?'attachment':'text',status:'received',attachments:event.message.attachments||[],metadata:{mode:'live',provider:'meta'},sent_at:now})
          if(me)throw me
          await admin.from('conversations').update({contact_id:contactId,status:'open',last_message_at:now,last_incoming_at:now,unread_count:Number(conversation.unread_count||0)+1}).eq('id',conversation.id)
        }
      }
    }
    return NextResponse.json({ok:true})
  }catch(err:any){
    console.error('Meta webhook error',err)
    return NextResponse.json({error:'Webhook processing failed'},{status:500})
  }
}

function attachmentSummary(items:any[]|undefined){
  if(!items?.length)return ''
  const types=[...new Set(items.map(a=>a?.type).filter(Boolean))]
  return types.length?`Adjunto: ${types.join(', ')}`:'Adjunto recibido'
}
