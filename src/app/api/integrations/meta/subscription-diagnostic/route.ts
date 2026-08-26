import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { metaJson } from '@/lib/meta'

export async function GET(){
  return inspect(true)
}

export async function POST(){
  return inspect(true)
}

async function inspect(repair:boolean){
  try{
    const admin=supabaseAdmin()
    const instagramAppId=process.env.INSTAGRAM_APP_ID||''
    const metaAppId=process.env.META_APP_ID||''
    const {data:connections,error}=await admin.from('channel_connections')
      .select('id,external_account_id,external_account_name,status,settings')
      .eq('channel','instagram')
      .eq('status','connected')
      .eq('settings->>mode','live')
      .limit(5)
    if(error)throw error

    const results=[] as any[]
    for(const connection of connections||[]){
      const {data:secretRows,error:secretError}=await admin.rpc('get_channel_connection_secret',{p_connection_id:connection.id})
      const secret=secretRows?.[0]
      if(secretError||!secret?.access_token){
        results.push({connection_id:connection.id,account:connection.external_account_name||connection.external_account_id,ok:false,error:'missing_token'})
        continue
      }

      try{
        let repair_result:any=null
        if(repair){
          const subscribe=new URL(`https://graph.instagram.com/${connection.external_account_id}/subscribed_apps`)
          subscribe.searchParams.set('subscribed_fields','messages,messaging_postbacks')
          subscribe.searchParams.set('access_token',secret.access_token)
          repair_result=await metaJson(subscribe.toString(),{method:'POST'})
        }

        const url=new URL(`https://graph.instagram.com/${connection.external_account_id}/subscribed_apps`)
        url.searchParams.set('access_token',secret.access_token)
        const response=await metaJson(url.toString())
        const apps=Array.isArray(response?.data)?response.data:[]
        results.push({
          connection_id:connection.id,
          account:connection.external_account_name||connection.external_account_id,
          ok:true,
          repaired:repair,
          repair_success:repair?Boolean(repair_result?.success):null,
          subscriptions:apps.map((app:any)=>{
            const appId=app?.id?String(app.id):null
            return {
              fields:Array.isArray(app?.subscribed_fields)?app.subscribed_fields:[],
              matches_instagram_app_id:Boolean(appId&&instagramAppId&&appId===instagramAppId),
              matches_meta_app_id:Boolean(appId&&metaAppId&&appId===metaAppId)
            }
          })
        })
      }catch(err:any){
        results.push({connection_id:connection.id,account:connection.external_account_name||connection.external_account_id,ok:false,repaired:repair,error:err?.message||'subscription_check_failed'})
      }
    }

    return NextResponse.json({ok:true,mode:repair?'repair':'inspect',config:{has_instagram_app_id:Boolean(instagramAppId),has_meta_app_id:Boolean(metaAppId)},results})
  }catch(err:any){
    return NextResponse.json({ok:false,error:err?.message||'diagnostic_failed'},{status:500})
  }
}
