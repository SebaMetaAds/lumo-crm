import {NextRequest,NextResponse} from 'next/server'
import {supabaseAdmin,supabaseForUser} from '@/lib/supabase-admin'

async function context(req:NextRequest){
 const auth=req.headers.get('authorization')||''
 const token=auth.startsWith('Bearer ')?auth.slice(7):''
 if(!token)return {error:NextResponse.json({error:'Sesión requerida.'},{status:401})}
 const userClient=supabaseForUser(token)
 const {data:{user},error}=await userClient.auth.getUser(token)
 if(error||!user)return {error:NextResponse.json({error:'Sesión inválida.'},{status:401})}
 return {user,admin:supabaseAdmin()}
}

export async function GET(req:NextRequest){
 try{
  const ctx=await context(req);if('error' in ctx)return ctx.error
  const conversationId=String(new URL(req.url).searchParams.get('conversation_id')||'')
  if(!conversationId)return NextResponse.json({error:'Falta la conversación.'},{status:400})
  const {data:conversation}=await ctx.admin.from('conversations').select('id,workspace_id').eq('id',conversationId).single()
  if(!conversation)return NextResponse.json({error:'Conversación no encontrada.'},{status:404})
  const {data:member}=await ctx.admin.from('workspace_members').select('id').eq('workspace_id',conversation.workspace_id).eq('user_id',ctx.user.id).eq('status','active').limit(1).maybeSingle()
  if(!member)return NextResponse.json({error:'No tenés acceso a esta conversación.'},{status:403})
  const {data:opportunity,error}=await ctx.admin.from('opportunities').select('id,name,amount,currency,stage_id,owner_id,source_channel,created_at,sales_stages(name,is_won,is_lost)').eq('workspace_id',conversation.workspace_id).eq('conversation_id',conversationId).order('created_at',{ascending:false}).limit(1).maybeSingle()
  if(error)throw error
  return NextResponse.json({opportunity:opportunity||null})
 }catch(err:any){return NextResponse.json({error:err.message||'No pudimos consultar la oportunidad.'},{status:500})}
}

export async function POST(req:NextRequest){
 try{
  const ctx=await context(req);if('error' in ctx)return ctx.error
  const body=await req.json(),conversationId=String(body.conversation_id||'')
  if(!conversationId)return NextResponse.json({error:'Falta la conversación.'},{status:400})
  const {data:conversation}=await ctx.admin.from('conversations').select('id,workspace_id,contact_id,assigned_user_id,channel_connections(channel)').eq('id',conversationId).single()
  if(!conversation)return NextResponse.json({error:'Conversación no encontrada.'},{status:404})
  const {data:member}=await ctx.admin.from('workspace_members').select('id').eq('workspace_id',conversation.workspace_id).eq('user_id',ctx.user.id).eq('status','active').limit(1).maybeSingle()
  if(!member)return NextResponse.json({error:'No tenés acceso a esta conversación.'},{status:403})

  const {data:existing}=await ctx.admin.from('opportunities').select('id,name,stage_id,sales_stages(name,is_won,is_lost)').eq('workspace_id',conversation.workspace_id).eq('conversation_id',conversationId).order('created_at',{ascending:false}).limit(1).maybeSingle()
  if(existing&&!((existing.sales_stages as any)?.is_won||(existing.sales_stages as any)?.is_lost))return NextResponse.json({opportunity:existing,created:false})

  const {data:stage,error:se}=await ctx.admin.from('sales_stages').select('id,name,probability').eq('workspace_id',conversation.workspace_id).eq('is_won',false).eq('is_lost',false).order('position').limit(1).single()
  if(se||!stage)throw new Error('No encontramos una etapa inicial del Proceso de ventas.')
  const {data:contact}=conversation.contact_id?await ctx.admin.from('contacts').select('first_name,last_name').eq('id',conversation.contact_id).eq('workspace_id',conversation.workspace_id).maybeSingle():{data:null}
  const contactName=contact?`${contact.first_name||''} ${contact.last_name||''}`.trim():''
  const sourceChannel=(conversation.channel_connections as any)?.channel||null
  const name=String(body.name||'').trim()||`Oportunidad · ${contactName||sourceChannel||'Inbox'}`
  const {data:created,error:oe}=await ctx.admin.from('opportunities').insert({workspace_id:conversation.workspace_id,name,contact_id:conversation.contact_id,conversation_id:conversationId,stage_id:stage.id,owner_id:conversation.assigned_user_id||ctx.user.id,source_channel:sourceChannel,currency:'ARS',probability:stage.probability,notes:'Creada desde Inbox'}).select('id,name,amount,currency,stage_id,owner_id,source_channel,created_at,sales_stages(name,is_won,is_lost)').single()
  if(oe)throw oe
  return NextResponse.json({opportunity:created,created:true})
 }catch(err:any){return NextResponse.json({error:err.message||'No pudimos crear la oportunidad.'},{status:500})}
}
