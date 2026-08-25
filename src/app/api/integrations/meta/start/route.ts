import { NextRequest, NextResponse } from 'next/server'
import { metaConfig, metaVersion, signMetaState } from '@/lib/meta'
import { supabaseForUser } from '@/lib/supabase-admin'

export async function POST(req:NextRequest){
  try{
    const auth=req.headers.get('authorization')||''
    const token=auth.startsWith('Bearer ')?auth.slice(7):''
    if(!token)return NextResponse.json({error:'Sesión requerida.'},{status:401})
    const body=await req.json().catch(()=>({}))
    const channel=body.channel==='facebook'?'facebook':'instagram'
    const sb=supabaseForUser(token)
    const {data:{user},error:ue}=await sb.auth.getUser(token)
    if(ue||!user)return NextResponse.json({error:'Sesión inválida.'},{status:401})
    const {data:mem,error:me}=await sb.from('workspace_members').select('workspace_id,role,status').eq('user_id',user.id).eq('status','active').limit(1).single()
    if(me||!mem)return NextResponse.json({error:'Workspace no disponible.'},{status:403})
    if(!['owner','admin'].includes(mem.role))return NextResponse.json({error:'Solo owner/admin pueden conectar Meta.'},{status:403})

    const {appId,baseUrl}=metaConfig()
    const redirectUri=`${baseUrl}/api/integrations/meta/callback`
    const state=signMetaState({workspaceId:mem.workspace_id,userId:user.id,channel,exp:Date.now()+10*60*1000})
    const scopes=process.env.META_SCOPES||'pages_show_list,pages_read_engagement,pages_manage_metadata,pages_messaging,instagram_basic,instagram_manage_messages'
    const params=new URLSearchParams({client_id:appId,redirect_uri:redirectUri,state,response_type:'code',scope:scopes})
    return NextResponse.json({url:`https://www.facebook.com/${metaVersion}/dialog/oauth?${params.toString()}`})
  }catch(err:any){return NextResponse.json({error:err.message||'No pudimos iniciar Meta OAuth.'},{status:500})}
}
