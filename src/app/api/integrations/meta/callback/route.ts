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
    accountsUrl.searchParams.set('fields','id,name,access_token,instagram_business_account{id,username,name}')
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
        workspace_id:oauth.workspaceId,channel:'facebook',name:`Facebook · ${page.name||page.id}`,
        external_account_id:String(page.id),external_account_name:page.name||null,status:'connected',
        settings:{mode:'live',provider:'meta',page_id:String(page.id),connected_at:new Date().toISOString()}
      },{onConflict:'workspace_id,channel,external_account_id'}).select('id').single()
      if(fbe)throw fbe
      const {error:fbs}=await admin.rpc('upsert_channel_connection_secret',{p_connection_id:fb.id,p_workspace_id:oauth.workspaceId,p_access_token:pageToken,p_provider:'meta',p_token_type:'page',p_expires_at:null,p_metadata:{page_id:String(page.id)}})
      if(fbs)throw fbs
      created++

      try{
        const subscribe=new URL(`${metaGraph}/${page.id}/subscribed_apps`)
        subscribe.searchParams.set('subscribed_fields','messages,messaging_postbacks,message_echoes')
        subscribe.searchParams.set('access_token',pageToken)
        await metaJson(subscribe.toString(),{method:'POST'})
      }catch{}

      const ig=page.instagram_business_account
      if(ig?.id){
        const igName=ig.username?`@${ig.username}`:(ig.name||String(ig.id))
        const {data:igc,error:ige}=await admin.from('channel_connections').upsert({
          workspace_id:oauth.workspaceId,channel:'instagram',name:`Instagram · ${igName}`,
          external_account_id:String(ig.id),external_account_name:igName,status:'connected',
          settings:{mode:'live',provider:'meta',page_id:String(page.id),instagram_id:String(ig.id),connected_at:new Date().toISOString()}
        },{onConflict:'workspace_id,channel,external_account_id'}).select('id').single()
        if(ige)throw ige
        const {error:igs}=await admin.rpc('upsert_channel_connection_secret',{p_connection_id:igc.id,p_workspace_id:oauth.workspaceId,p_access_token:pageToken,p_provider:'meta',p_token_type:'page',p_expires_at:null,p_metadata:{page_id:String(page.id),instagram_id:String(ig.id)}})
        if(igs)throw igs
        created++
      }
    }
    return NextResponse.redirect(`${baseUrl}/settings?tab=integrations&meta=connected&count=${created}`)
  }catch(err:any){
    return NextResponse.redirect(`${baseUrl}/settings?tab=integrations&meta=error&message=${encodeURIComponent(err.message||'Error conectando Meta')}`)
  }
}
