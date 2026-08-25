import { createClient } from '@supabase/supabase-js'

export function supabaseAdmin(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY
  if(!url||!serviceKey) throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}})
}

export function supabaseForUser(accessToken:string){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL
  const publishable=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if(!url||!publishable) throw new Error('Falta configuración pública de Supabase')
  return createClient(url,publishable,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:`Bearer ${accessToken}`}}})
}
