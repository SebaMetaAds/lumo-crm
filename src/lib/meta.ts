import crypto from 'crypto'

export const metaVersion=process.env.META_GRAPH_VERSION||'v24.0'
export const metaGraph=`https://graph.facebook.com/${metaVersion}`

export function metaConfig(){
  const appId=process.env.META_APP_ID
  const appSecret=process.env.META_APP_SECRET
  const verifyToken=process.env.META_WEBHOOK_VERIFY_TOKEN
  const baseUrl=process.env.NEXT_PUBLIC_APP_URL||'https://lumo-crm-rho.vercel.app'
  if(!appId||!appSecret) throw new Error('Faltan META_APP_ID o META_APP_SECRET')
  return {appId,appSecret,verifyToken,baseUrl}
}

function b64url(value:string){return Buffer.from(value).toString('base64url')}

export function signMetaState(payload:{workspaceId:string;userId:string;channel:string;exp:number}){
  const {appSecret}=metaConfig()
  const body=b64url(JSON.stringify(payload))
  const sig=crypto.createHmac('sha256',appSecret).update(body).digest('base64url')
  return `${body}.${sig}`
}

export function verifyMetaState(state:string){
  const {appSecret}=metaConfig()
  const [body,sig]=state.split('.')
  if(!body||!sig) throw new Error('Estado OAuth inválido')
  const expected=crypto.createHmac('sha256',appSecret).update(body).digest('base64url')
  const a=Buffer.from(sig),b=Buffer.from(expected)
  if(a.length!==b.length||!crypto.timingSafeEqual(a,b)) throw new Error('Firma OAuth inválida')
  const payload=JSON.parse(Buffer.from(body,'base64url').toString('utf8'))
  if(!payload.exp||Date.now()>payload.exp) throw new Error('La conexión OAuth expiró')
  return payload as {workspaceId:string;userId:string;channel:string;exp:number}
}

export function verifyMetaWebhookSignature(raw:string,signature:string|null){
  if(!signature)return false
  const secrets=[process.env.META_APP_SECRET,process.env.INSTAGRAM_APP_SECRET].filter(Boolean) as string[]
  for(const secret of secrets){
    const expected='sha256='+crypto.createHmac('sha256',secret).update(raw).digest('hex')
    const a=Buffer.from(signature),b=Buffer.from(expected)
    if(a.length===b.length&&crypto.timingSafeEqual(a,b))return true
  }
  return false
}

export async function metaJson(url:string,init?:RequestInit){
  const res=await fetch(url,{...init,cache:'no-store'})
  const data=await res.json().catch(()=>({}))
  if(!res.ok) throw new Error(data?.error?.message||`Meta API ${res.status}`)
  return data
}
