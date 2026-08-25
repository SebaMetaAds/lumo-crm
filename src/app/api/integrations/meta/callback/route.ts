import { NextRequest, NextResponse } from 'next/server'
import { metaConfig, metaGraph, metaJson, verifyMetaState } from '@/lib/meta'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(req:NextRequest){
  const {baseUrl}=metaConfig()
  try{
    const url=new URL(req.url)
    const code=url.searchParams.get('code')
    const state=url.searchParams.get('state')
    const denied=url.searchParams.get('error')
    if(denied)return NextResponse.redirect(`${baseUrl}/settings?tab=integrations&meta=cancelled`)
    if(!code||!state)throw new Error('Meta no devolvió autorización completa.')
    const oauth=verifyMetaState(state)
    if(oauth.channel==='instagram')return await connectInstagram(code,oauth.workspaceId,baseUrl)
    return await connectFacebook(code,oauth.workspaceId,baseUrl)
  }catch(err:any){
    return NextResponse.redirect(`${baseUrl}/settings?tab=integrations&meta=error&message=${encodeURIComponent(err.message||'Error conectando Meta')}`)
  }
}

async function connectInstagram(code:string,workspaceId:string,baseUrl:string){
  const {appId,appSecret}=metaConfig()
  const redirectUri=`${baseUrl}/api/integrations/meta/callback`
  const body=new URLSearchParams({client_id:appId,client_secret:appSecret,grant_type:'authorization_code',redirect_uri:redirectUri,code})
  const short=await metaJson('https://api.instagram.com/oauth/access_token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body})
  let accessToken=String(short.access_token||'')
  if(!accessToken)throw new Error('Instagram no devolvió un access token.')
  let expiresAt:string|null=null
  try{
    const longUrl=new URL('https://graph.instagram.com/access_token')
    longUrl.searchParams.set('grant_type','ig_exchange_token')
    longUrl.searchParams.set('client_secret',appSecret)
    longUrl.searchParams.set('access_token',accessToken)
    const long=await metaJson(longUrl.toString())
    if(long.access_token)accessToken=String(long.access_token)
    if(long.expires_in)expiresAt=new Date(Date.now()+Number(long.expires_in)*1000).toISOString()
  }catch{}

  const meUrl=new URL('https://graph.instagram.com/me')
  meUrl.searchParams.set('fields','user_id,username,name,account_type,profile_picture_url')
  meUrl.searchParams.set('access_token',accessToken)
  const me=await metaJson(meUrl.toString())
  const igId=String(me.user_id||me.id||short.user_id||'')
  if(!igId)throw new Error('No pudimos identificar la cuenta profesional de Instagram.')
  const igName=me.username?`@${me.username}`:(me.name||igId)
  const admin=supabaseAdmin()
  const {data:connection,error:ce}=await admin.from('channel_connections').upsert({
    workspace_id:workspaceId,channel:'instagram',name:`Instagram · ${igName}`,
    external_account_id:igId,external_account_name:igName,status:'connected',
    settings:{mode:'live',provider:'meta',auth_model:'instagram_login',instagram_id:igId,username:me.username||null,connected_at:new Date().toISOString()}
  },{onConflict:'workspace_id,channel,external_account_id'}).select('id').single()
  if(ce)throw ce
  const {error:se}=await admin.rpc('upsert_channel_connection_secret',{p_connection_id:connection.id,p_workspace_id:workspaceId,p_access_token:accessToken,p_provider:'meta',p_token_type:'instagram_user',p_expires_at:expiresAt,p_metadata:{instagram_id:igId,username:me.username||null,auth_model:'instagram_login'}})
  if(se)throw se

  try{
    const subscribe=new URL(`https://graph.instagram.com/${igId}/subscribed_apps`)
    subscribe.searchParams.set('subscribed_fields','messages,messaging_postbacks')
    subscribe.searchParams.set('access_token',accessToken)
    await metaJson(subscribe.toString(),{method:'POST'})
  }catch{}
  return NextResponse.redirect(`${baseUrl}/settings?tab=integrations&meta=connected&count=1`)
}

async function connectFacebook(code:string,workspaceId:string,baseUrl:string){
  const {appId,appSecret}=metaConfig()
  const redirectUri=`${baseUrl}/api/integrations/meta/callback`
  const tokenUrl=new URL(`${metaGraph}/oauth/access_token`)
  tokenUrl.searchParams.set('client_id',appId)
  tokenUrl.searchParams.set('client_secret',appSecret)
  tokenUrl.searchParams.set('redirect_uri',redirectUri)
  tokenUrl.searchParams.set('code',code)
  const short=await metaJson(tokenUrl.toString())
  let userToken=short.access_token as string
  try{
    const longUrl=new URL(`${metaGraph}/oauth/access_token`)
    longUrl.searchParams.set('grant_type','fb_exchange_token')
    longUrl.searchParams.set('client_id',appId)
    longUrl.searchParams.set('client_secret',appSecret)
    longUrl.searchParams.set('fb_exchange_token',userToken)
    const long=await metaJson(longUrl.toString())
    if(long.access_token)userToken=long.access_token
  }catch{}

  const accountsUrl=new URL(`${metaGraph}/me/accounts`)
  accountsUrl.searchParams.set('fields','id,name,access_token')
  accountsUrl.searchParams.set('limit','100')
  accountsUrl.searchParams.set('access_token',userToken)
  const accounts=await metaJson(accountsUrl.toString())
  const pages=Array.isArray(accounts.data)?accounts.data:[]
  if(!pages.length)throw new Error('No encontramos páginas de Facebook administrables en esta cuenta.')
  const admin=supabaseAdmin()
  let created=0
  for(const page of pages){
    const pageToken=page.access_token||userToken
    const {data:fb,error:fbe}=await admin.from('channel_connections').upsert({
      workspace_id:workspaceId,channel:'facebook',name:`Facebook · ${page.name||page.id}`,
      external_account_id:String(page.id),external_account_name:page.name||null,status:'connected',
      settings:{mode:'live',provider:'meta',auth_model:'facebook_login',page_id:String(page.id),connected_at:new Date().toISOString()}
    },{onConflict:'workspace_id,channel,external_account_id'}).select('id').single()
    if(fbe)throw fbe
    const {error:fbs}=await admin.rpc('upsert_channel_connection_secret',{p_connection_id:fb.id,p_workspace_id:workspaceId,p_access_token:pageToken,p_provider:'meta',p_token_type:'page',p_expires_at:null,p_metadata:{page_id:String(page.id),auth_model:'facebook_login'}})
    if(fbs)throw fbs
    created++
    try{
      const subscribe=new URL(`${metaGraph}/${page.id}/subscribed_apps`)
      subscribe.searchParams.set('subscribed_fields','messages,messaging_postbacks,message_echoes')
      subscribe.searchParams.set('access_token',pageToken)
      await metaJson(subscribe.toString(),{method:'POST'})
    }catch{}
  }
  return NextResponse.redirect(`${baseUrl}/settings?tab=integrations&meta=connected&count=${created}`)
}
