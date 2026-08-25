'use client'
import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function SetupPage(){
  const router=useRouter()
  const [company,setCompany]=useState('')
  const [name,setName]=useState('')
  const [msg,setMsg]=useState('')
  const [busy,setBusy]=useState(false)
  const [ready,setReady]=useState(false)

  useEffect(()=>{(async()=>{
    const {data:{user}}=await supabase.auth.getUser()
    if(!user){router.replace('/login');return}
    const {data:member}=await supabase.from('workspace_members').select('workspace_id').eq('user_id',user.id).eq('status','active').limit(1)
    if(member?.length){router.replace('/');return}
    setName(user.user_metadata?.full_name||'')
    setCompany(user.user_metadata?.company_name||'')
    setReady(true)
  })()},[router])

  async function submit(e:FormEvent){
    e.preventDefault(); setBusy(true); setMsg('')
    const {data:{user}}=await supabase.auth.getUser()
    if(!user){router.replace('/login');return}
    const clean=(company||'mi-empresa').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'')
    const slug=(clean||'workspace')+'-'+user.id.replace(/-/g,'').slice(0,8)
    const {error:perr}=await supabase.from('profiles').upsert({id:user.id,full_name:name||null})
    if(perr){setMsg(perr.message);setBusy(false);return}
    const {data:ws,error:werr}=await supabase.from('workspaces').insert({name:company||'Mi empresa',slug,created_by:user.id}).select('id').single()
    if(werr){setMsg(werr.message);setBusy(false);return}
    const {error:merr}=await supabase.from('workspace_members').insert({workspace_id:ws.id,user_id:user.id,role:'owner',status:'active'})
    if(merr){setMsg(merr.message);setBusy(false);return}
    router.replace('/')
  }

  if(!ready) return <div className="loading">Preparando Lumo…</div>
  return <main className="auth"><section className="auth-card"><div className="logo-big"><span>L</span><strong>Lumo</strong><small>CRM</small></div><h1>Terminemos de configurar tu espacio</h1><p>Solo necesitamos estos datos para crear tu workspace.</p><form onSubmit={submit}><label>Nombre<input value={name} onChange={e=>setName(e.target.value)} required/></label><label>Empresa<input value={company} onChange={e=>setCompany(e.target.value)} required autoFocus/></label>{msg&&<div className="message">{msg}</div>}<button className="primary" disabled={busy}>{busy?'Creando…':'Crear espacio de trabajo'}</button></form></section></main>
}
