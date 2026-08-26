import { NextRequest, NextResponse } from 'next/server'
import { metaConfig, verifyMetaWebhookSignature } from '@/lib/meta'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { runAutomations } from '@/lib/automations'
import { analyzeConversation } from '@/lib/inbox-intelligence'

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

    console.info('Meta webhook shape',JSON.stringify({
      object:payload?.object||null,
      entries:(payload?.entry||[]).map((entry:any)=>({
        id:entry?.id?String(entry.id):null,
        messaging_count:Array.isArray(entry?.messaging)?entry.messaging.length:0,
        change_fields:Array.isArray(entry?.changes)?entry.changes.map((c:any)=>c?.field).filter(Boolean):[],
        recipient_ids:collectEvents(entry).map((e:any)=>e?.recipient?.id?String(e.recipient.id):null).filter(Boolean)
      }))
    }))

    for(const entry of payload.entry||[]){
      const events=collectEvents(entry)
      if(!events.length)continue

      const accountIds=[...new Set([
        entry?.id?String(entry.id):'',
        ...events.map((e:any)=>e?.recipient?.id?String(e.recipient.id):'')
      ].filter(Boolean))]

      let connections:any[]=[]
      if(accountIds.length){
        const {data,error}=await admin.from('channel_connections')
          .select('id,workspace_id,channel,external_account_id')
          .eq('channel',channel)
          .in('external_account_id',accountIds)
          .in('status',['connected','active'])
          .limit(10)
        if(error)throw error
        connections=data||[]
      }

      console.info('Meta webhook connection match',JSON.stringify({channel,accountIds,matches:connections.length,eventCount:events.length}))
      if(!connections.length)continue

      for(const connection of connections){
        for(const event of events){
          if(event?.recipient?.id&&String(event.recipient.id)!==String(connection.external_account_id))continue
          if(!event?.sender?.id||!event?.message)continue
          if(event.message.is_echo)continue

          const externalUserId=String(event.sender.id)
          const externalMessageId=event.message.mid?String(event.message.mid):null
          const body=event.message.text||attachmentSummary(event.message.attachments)||null
          const now=event.timestamp?new Date(Number(event.timestamp)).toISOString():new Date().toISOString()

          const {data:identity,error:identityError}=await admin.from('contact_channels').select('contact_id').eq('workspace_id',connection.workspace_id).eq('channel',channel).eq('external_user_id',externalUserId).limit(1).maybeSingle()
          if(identityError)throw identityError
          let contactId=identity?.contact_id||null
          if(!contactId){
            const {data:contact,error:ce}=await admin.from('contacts').insert({workspace_id:connection.workspace_id,first_name:channel==='instagram'?'Instagram':'Facebook',last_name:'Lead',source:channel,last_interaction_at:now}).select('id').single()
            if(ce)throw ce
            contactId=contact.id
            const {error:ie}=await admin.from('contact_channels').insert({workspace_id:connection.workspace_id,contact_id:contactId,channel,external_user_id:externalUserId,handle:externalUserId,is_primary:true,metadata:{provider:'meta'}})
            if(ie)throw ie
          }else{
            const {error:updateContactError}=await admin.from('contacts').update({last_interaction_at:now}).eq('id',contactId).eq('workspace_id',connection.workspace_id)
            if(updateContactError)throw updateContactError
          }

          const {data:existingConv,error:convLookupError}=await admin.from('conversations').select('id,unread_count,metadata').eq('channel_connection_id',connection.id).eq('external_conversation_id',externalUserId).limit(1).maybeSingle()
          if(convLookupError)throw convLookupError
          let conversation=existingConv
          const isNewConversation=!conversation
          if(!conversation){
            const {data:newConv,error:cve}=await admin.from('conversations').insert({workspace_id:connection.workspace_id,channel_connection_id:connection.id,contact_id:contactId,external_conversation_id:externalUserId,status:'open',priority:'normal',last_message_at:now,last_incoming_at:now,unread_count:0,metadata:{mode:'live',provider:'meta'}}).select('id,unread_count,metadata').single()
            if(cve)throw cve
            conversation=newConv
          }

          if(externalMessageId){
            const {data:dup,error:dupError}=await admin.from('messages').select('id').eq('conversation_id',conversation.id).eq('external_message_id',externalMessageId).limit(1)
            if(dupError)throw dupError
            if(dup?.length)continue
          }

          const {data:message,error:me}=await admin.from('messages').insert({workspace_id:connection.workspace_id,conversation_id:conversation.id,external_message_id:externalMessageId,direction:'incoming',sender_type:'contact',body,message_type:event.message.attachments?.length?'attachment':'text',status:'received',attachments:event.message.attachments||[],metadata:{mode:'live',provider:'meta'},sent_at:now}).select('id').single()
          if(me)throw me
          const nextUnread=Number(conversation.unread_count||0)+1

          const {data:recentMessages,error:recentError}=await admin.from('messages').select('direction,body,sent_at').eq('conversation_id',conversation.id).order('sent_at',{ascending:true}).limit(100)
          if(recentError)throw recentError
          const insight=analyzeConversation(recentMessages||[])
          const metadata={...(conversation.metadata||{}),intelligence:{...insight,updated_at:now,engine:'rules-v1'}}
          const {error:updateConvError}=await admin.from('conversations').update({contact_id:contactId,status:'open',last_message_at:now,last_incoming_at:now,unread_count:nextUnread,metadata}).eq('id',conversation.id)
          if(updateConvError)throw updateConvError

          const automationPayload={channel,conversation_id:conversation.id,contact_id:contactId,message_id:message.id,body,status:'open',priority:'normal',intent:insight.intent,confidence:insight.confidence,suggested_priority:insight.suggested_priority,intent_label:insight.intent_label}
          if(isNewConversation){
            await runAutomations(admin,{workspaceId:connection.workspace_id,triggerType:'conversation_created',payload:automationPayload})
          }
          await runAutomations(admin,{workspaceId:connection.workspace_id,triggerType:'message_received',payload:automationPayload})
          console.info('Meta webhook message ingested',JSON.stringify({channel,connectionId:connection.id,conversationId:conversation.id,externalMessageId:externalMessageId||null}))
        }
      }
    }
    return NextResponse.json({ok:true})
  }catch(err:any){
    console.error('Meta webhook error',err)
    return NextResponse.json({error:'Webhook processing failed'},{status:500})
  }
}

function collectEvents(entry:any){
  const direct=Array.isArray(entry?.messaging)?entry.messaging:[]
  const nested=(Array.isArray(entry?.changes)?entry.changes:[]).flatMap((change:any)=>{
    const value=change?.value
    if(Array.isArray(value?.messaging))return value.messaging
    if(value?.sender&&value?.message)return [value]
    return []
  })
  return [...direct,...nested]
}

function attachmentSummary(items:any[]|undefined){
  if(!items?.length)return ''
  const types=[...new Set(items.map(a=>a?.type).filter(Boolean))]
  return types.length?`Adjunto: ${types.join(', ')}`:'Adjunto recibido'
}
