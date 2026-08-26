import {NextRequest,NextResponse} from 'next/server'
import {supabaseAdmin,supabaseForUser} from '@/lib/supabase-admin'
import {analyzeConversation} from '@/lib/inbox-intelligence'

export async function POST(req:NextRequest){
 try{
  const auth=req.headers.get('authorization')||''
  const token=auth.startsWith('Bearer ')?auth.slice(7):''
  if(!token)return NextResponse.json({error:'Sesión requerida.'},{status:401})
  const body=await req.json()
  const conversationId=String(body.conversation_id||'')
  if(!conversationId)return NextResponse.json({error:'Falta la conversación.'},{status:400})

  const userClient=supabaseForUser(token)
  const {data:{user},error:ue}=await userClient.auth.getUser(token)
  if(ue||!user)return NextResponse.json({error:'Sesión inválida.'},{status:401})

  const admin=supabaseAdmin()
  const {data:conversation,error:ce}=await admin.from('conversations').select('id,workspace_id,metadata').eq('id',conversationId).single()
  if(ce||!conversation)return NextResponse.json({error:'Conversación no encontrada.'},{status:404})
  const {data:member}=await admin.from('workspace_members').select('id').eq('workspace_id',conversation.workspace_id).eq('user_id',user.id).eq('status','active').limit(1).maybeSingle()
  if(!member)return NextResponse.json({error:'No tenés acceso a esta conversación.'},{status:403})

  const {data:messages,error:me}=await admin.from('messages').select('direction,body,sent_at').eq('conversation_id',conversationId).order('sent_at',{ascending:true}).limit(100)
  if(me)throw me
  const insight=analyzeConversation(messages||[])
  if(body.persist!==false){
   const metadata={...(conversation.metadata||{}),intelligence:{...insight,updated_at:new Date().toISOString(),engine:'rules-v1'}}
   const {error:pe}=await admin.from('conversations').update({metadata}).eq('id',conversationId).eq('workspace_id',conversation.workspace_id)
   if(pe)throw pe
  }
  return NextResponse.json({insight})
 }catch(err:any){
  return NextResponse.json({error:err.message||'No pudimos analizar la conversación.'},{status:500})
 }
}
