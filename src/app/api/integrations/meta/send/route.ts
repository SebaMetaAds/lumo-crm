import { NextRequest, NextResponse } from 'next/server'
import { metaGraph, metaJson } from '@/lib/meta'
import { supabaseAdmin, supabaseForUser } from '@/lib/supabase-admin'

export async function POST(req:NextRequest){
  try{
    const auth=req.headers.get('authorization')||''
    const token=auth.startsWith('Bearer ')?auth.slice(7):''
    if(!token)return NextResponse.json({error:'Sesión requerida.'},{status:401})
    const body=await req.json()
    const conversationId=String(body.conversation_id||'')
    const text=String(body.body||'').trim()
    if(!conversationId||!text)return NextResponse.json({error:'Faltan conversación o mensaje.'},{status:400})

    const userClient=supabaseForUser(token)
    const {data:{user},error:ue}=await userClient.auth.getUser(token)
    if(ue||!user)return NextResponse.json({error:'Sesión inválida.'},{status:401})

    const admin=supabaseAdmin()
    const {data:conversation,error:ce}=await admin.from('conversations').select('id,workspace_id,external_conversation_id,channel_connection_id,channel_connections(id,channel,external_account_id,status,settings)').eq('id',conversationId).single()
    if(ce||!conversation)return NextResponse.json({error:'Conversación no encontrada.'},{status:404})
    const {data:member}=await admin.from('workspace_members').select('id').eq('workspace_id',conversation.workspace_id).eq('user_id',user.id).eq('status','active').limit(1).maybeSingle()
    if(!member)return NextResponse.json({error:'No tenés acceso a esta conversación.'},{status:403})

    const connection:any=conversation.channel_connections
    if(!connection||!['instagram','facebook'].includes(connection.channel))return NextResponse.json({error:'Esta conversación no usa Meta.'},{status:400})
    if(connection.settings?.mode==='test')return NextResponse.json({error:'Las conversaciones de prueba se responden localmente.'},{status:400})
    if(!conversation.external_conversation_id)return NextResponse.json({error:'Falta destinatario externo.'},{status:400})

    const {data:secretRows,error:se}=await admin.rpc('get_channel_connection_secret',{p_connection_id:connection.id})
    const secret=secretRows?.[0]
    if(se||!secret?.access_token)return NextResponse.json({error:'La conexión no tiene credenciales activas.'},{status:400})

    const graphBase=connection.channel==='instagram'&&connection.settings?.auth_model==='instagram_login'?'https://graph.instagram.com':metaGraph
    const endpoint=`${graphBase}/${connection.external_account_id}/messages`
    const sent=await metaJson(endpoint,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${secret.access_token}`},body:JSON.stringify({recipient:{id:conversation.external_conversation_id},message:{text}})})
    const now=new Date().toISOString()
    const {data:message,error:me}=await admin.from('messages').insert({workspace_id:conversation.workspace_id,conversation_id:conversation.id,external_message_id:sent.message_id||null,direction:'outgoing',sender_type:'user',sender_user_id:user.id,body:text,message_type:'text',status:'sent',attachments:[],metadata:{mode:'live',provider:'meta',sent_via_api:true},sent_at:now}).select('id,direction,sender_type,body,sent_at,status').single()
    if(me)throw me
    await admin.from('conversations').update({last_message_at:now,last_outgoing_at:now,status:'open'}).eq('id',conversation.id)
    return NextResponse.json({message})
  }catch(err:any){
    return NextResponse.json({error:err.message||'No pudimos enviar el mensaje por Meta.'},{status:500})
  }
}
