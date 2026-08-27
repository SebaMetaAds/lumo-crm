import { NextRequest, NextResponse } from 'next/server'
import { metaJson } from '@/lib/meta'
import { supabaseAdmin, supabaseForUser } from '@/lib/supabase-admin'
import { analyzeConversation } from '@/lib/inbox-intelligence'

export async function POST(req:NextRequest){
  try{
    const auth=req.headers.get('authorization')||''
    const token=auth.startsWith('Bearer ')?auth.slice(7):''
    if(!token)return NextResponse.json({error:'Sesión requerida.'},{status:401})

    const userClient=supabaseForUser(token)
    const {data:{user},error:ue}=await userClient.auth.getUser(token)
    if(ue||!user)return NextResponse.json({error:'Sesión inválida.'},{status:401})

    const admin=supabaseAdmin()
    const {data:membership,error:me}=await admin.from('workspace_members').select('workspace_id').eq('user_id',user.id).eq('status','active').limit(1).maybeSingle()
    if(me||!membership)return NextResponse.json({error:'No encontramos tu espacio de trabajo.'},{status:403})
    const workspaceId=membership.workspace_id

    const {data:connections,error:ce}=await admin.from('channel_connections')
      .select('id,workspace_id,external_account_id,external_account_name,status,settings')
      .eq('workspace_id',workspaceId).eq('channel','instagram').eq('status','connected').eq('settings->>mode','live')
    if(ce)throw ce

    let conversationsSeen=0,messagesImported=0
    const version=process.env.META_GRAPH_VERSION||'v26.0'

    for(const connection of connections||[]){
      if(!connection.external_account_id)continue
      const {data:secretRows,error:se}=await admin.rpc('get_channel_connection_secret',{p_connection_id:connection.id})
      const secret=secretRows?.[0]
      if(se||!secret?.access_token)continue

      const igId=String(connection.external_account_id)
      let list:any=null
      let listMode='ig_user_id'

      const listUrl=new URL(`https://graph.instagram.com/${version}/${igId}/conversations`)
      listUrl.searchParams.set('platform','instagram')
      listUrl.searchParams.set('fields','id,updated_time')
      listUrl.searchParams.set('limit','25')
      list=await metaJson(listUrl.toString(),{headers:{Authorization:`Bearer ${secret.access_token}`}})

      let remoteConversations=Array.isArray(list?.data)?list.data:[]
      if(!remoteConversations.length){
        const meUrl=new URL(`https://graph.instagram.com/${version}/me/conversations`)
        meUrl.searchParams.set('platform','instagram')
        meUrl.searchParams.set('fields','id,updated_time')
        meUrl.searchParams.set('limit','25')
        const meList=await metaJson(meUrl.toString(),{headers:{Authorization:`Bearer ${secret.access_token}`}})
        const meRows=Array.isArray(meList?.data)?meList.data:[]
        if(meRows.length || !Array.isArray(list?.data)){
          list=meList
          remoteConversations=meRows
          listMode='me'
        }
      }

      console.info('Instagram sync list diagnostic',JSON.stringify({
        account:connection.external_account_name||igId,
        listMode,
        platform:'instagram',
        hasData:Array.isArray(list?.data),
        conversationCount:remoteConversations.length,
        topLevelKeys:Object.keys(list||{}),
        hasPaging:Boolean(list?.paging),
        hasError:Boolean(list?.error),
        errorCode:list?.error?.code||null,
        errorType:list?.error?.type||null
      }))

      for(const remoteConversation of remoteConversations){
        if(!remoteConversation?.id)continue
        conversationsSeen++
        const conversationUrl=new URL(`https://graph.instagram.com/${version}/${encodeURIComponent(String(remoteConversation.id))}`)
        conversationUrl.searchParams.set('fields','messages.limit(20){id,created_time,from,to,message,is_unsupported}')
        const detail=await metaJson(conversationUrl.toString(),{headers:{Authorization:`Bearer ${secret.access_token}`}})
        const remoteMessages=Array.isArray(detail?.messages?.data)?detail.messages.data:[]
        console.info('Instagram sync conversation diagnostic',JSON.stringify({hasMessages:Array.isArray(detail?.messages?.data),messageCount:remoteMessages.length,keys:Object.keys(detail||{})}))
        if(!remoteMessages.length)continue

        const participantMessage=remoteMessages.find((m:any)=>String(m?.from?.id||'')&&String(m.from.id)!==igId) || remoteMessages.find((m:any)=>Array.isArray(m?.to?.data)&&m.to.data.some((x:any)=>String(x?.id||'')!==igId))
        const participantId=String(participantMessage?.from?.id&&String(participantMessage.from.id)!==igId?participantMessage.from.id:(participantMessage?.to?.data||[]).find((x:any)=>String(x?.id||'')!==igId)?.id||'')
        if(!participantId)continue

        const latestTs=remoteMessages.map((m:any)=>Date.parse(String(m?.created_time||''))).filter((x:number)=>Number.isFinite(x)).sort((a:number,b:number)=>b-a)[0]||Date.now()
        const latestIso=new Date(latestTs).toISOString()

        const {data:identity,error:ie}=await admin.from('contact_channels').select('contact_id').eq('workspace_id',workspaceId).eq('channel','instagram').eq('external_user_id',participantId).limit(1).maybeSingle()
        if(ie)throw ie
        let contactId=identity?.contact_id||null
        if(!contactId){
          const {data:contact,error:cne}=await admin.from('contacts').insert({workspace_id:workspaceId,first_name:'Instagram',last_name:'Lead',source:'instagram',last_interaction_at:latestIso}).select('id').single()
          if(cne)throw cne
          contactId=contact.id
          const {error:cie}=await admin.from('contact_channels').insert({workspace_id:workspaceId,contact_id:contactId,channel:'instagram',external_user_id:participantId,handle:participantId,is_primary:true,metadata:{provider:'meta',synced_via:'conversations_api'}})
          if(cie)throw cie
        }else{
          await admin.from('contacts').update({last_interaction_at:latestIso}).eq('id',contactId).eq('workspace_id',workspaceId)
        }

        const {data:existing,error:ee}=await admin.from('conversations').select('id,unread_count,metadata').eq('channel_connection_id',connection.id).eq('external_conversation_id',participantId).limit(1).maybeSingle()
        if(ee)throw ee
        let local=existing
        if(!local){
          const {data:created,error:cve}=await admin.from('conversations').insert({workspace_id:workspaceId,channel_connection_id:connection.id,contact_id:contactId,external_conversation_id:participantId,status:'open',priority:'normal',last_message_at:latestIso,last_incoming_at:latestIso,unread_count:0,metadata:{mode:'live',provider:'meta',synced_via:'conversations_api',meta_conversation_id:String(remoteConversation.id)}}).select('id,unread_count,metadata').single()
          if(cve)throw cve
          local=created
        }

        let importedIncoming=0
        for(const rm of [...remoteMessages].sort((a:any,b:any)=>Date.parse(String(a?.created_time||''))-Date.parse(String(b?.created_time||'')))){
          if(!rm?.id||rm?.is_unsupported)continue
          const text=typeof rm?.message==='string'?rm.message:''
          if(!text)continue
          const externalId=String(rm.id)
          const {data:dup,error:de}=await admin.from('messages').select('id').eq('conversation_id',local.id).eq('external_message_id',externalId).limit(1)
          if(de)throw de
          if(dup?.length)continue

          const fromId=String(rm?.from?.id||'')
          const incoming=fromId!==igId
          const sentAt=rm?.created_time?new Date(String(rm.created_time)).toISOString():new Date().toISOString()
          const {error:mie}=await admin.from('messages').insert({workspace_id:workspaceId,conversation_id:local.id,external_message_id:externalId,direction:incoming?'incoming':'outgoing',sender_type:incoming?'contact':'user',body:text,message_type:'text',status:incoming?'received':'sent',attachments:[],metadata:{mode:'live',provider:'meta',synced_via:'conversations_api'},sent_at:sentAt})
          if(mie)throw mie
          messagesImported++
          if(incoming)importedIncoming++
        }

        const {data:recent,error:re}=await admin.from('messages').select('direction,body,sent_at').eq('conversation_id',local.id).order('sent_at',{ascending:true}).limit(100)
        if(re)throw re
        const insight=analyzeConversation(recent||[])
        const metadata={...(local.metadata||{}),meta_conversation_id:String(remoteConversation.id),synced_via:'conversations_api',intelligence:{...insight,updated_at:new Date().toISOString(),engine:'rules-v1'}}
        const incomingDates=(recent||[]).filter((m:any)=>m.direction==='incoming').map((m:any)=>m.sent_at).filter(Boolean)
        const lastIncoming=incomingDates.length?incomingDates[incomingDates.length-1]:null
        const {error:uce}=await admin.from('conversations').update({contact_id:contactId,status:'open',last_message_at:latestIso,last_incoming_at:lastIncoming,unread_count:Number(local.unread_count||0)+importedIncoming,metadata}).eq('id',local.id).eq('workspace_id',workspaceId)
        if(uce)throw uce
      }
    }

    console.info('Instagram sync complete',JSON.stringify({connections:(connections||[]).length,conversationsSeen,messagesImported}))
    return NextResponse.json({ok:true,connections:(connections||[]).length,conversations_seen:conversationsSeen,messages_imported:messagesImported})
  }catch(err:any){
    console.error('Instagram sync error',err)
    return NextResponse.json({error:err?.message||'No pudimos sincronizar Instagram.'},{status:500})
  }
}
