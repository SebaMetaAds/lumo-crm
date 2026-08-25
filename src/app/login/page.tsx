'use client'
import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const SITE_URL = 'https://lumo-crm-rho.vercel.app'

export default function LoginPage(){
  const router=useRouter(); const [mode,setMode]=useState<'login'|'signup'>('login'); const [email,setEmail]=useState(''); const [password,setPassword]=useState(''); const [name,setName]=useState(''); const [company,setCompany]=useState(''); const [msg,setMsg]=useState(''); const [busy,setBusy]=useState(false); const [resending,setResending]=useState(false)
  async function submit(e:FormEvent){e.preventDefault();setBusy(true);setMsg('')
    if(mode==='login'){
      const {error}=await supabase.auth.signInWithPassword({email,password}); if(error)setMsg(error.message); else router.replace('/')
    }else{
      const {data,error}=await supabase.auth.signUp({email,password,options:{emailRedirectTo:SITE_URL,data:{full_name:name,company_name:company||'Mi empresa'}}}); if(error){setMsg(error.message)} else if(data.user){
        if(data.session){router.replace('/')} else {setMsg('Cuenta creada. Revisá tu email para confirmar la cuenta y luego iniciá sesión.')}
      }
    } setBusy(false)
  }
  async function resendConfirmation(){
    if(!email){setMsg('Ingresá tu email para reenviar la confirmación.');return}
    setResending(true);setMsg('')
    const {error}=await supabase.auth.resend({type:'signup',email,options:{emailRedirectTo:SITE_URL}})
    setMsg(error?error.message:'Te reenviamos el email de confirmación. Abrí el nuevo mensaje; el enlace anterior ya no sirve.')
    setResending(false)
  }
  return <main className="auth"><section className="auth-card"><div className="logo-big"><span>L</span><strong>Lumo</strong><small>CRM</small></div><h1>{mode==='login'?'Bienvenido a Lumo':'Creá tu espacio de trabajo'}</h1><p>{mode==='login'?'Tus conversaciones, clientes y ventas en un solo lugar.':'Empezá con tu CRM omnicanal.'}</p><form onSubmit={submit}>{mode==='signup'&&<><label>Nombre<input value={name} onChange={e=>setName(e.target.value)} required/></label><label>Empresa<input value={company} onChange={e=>setCompany(e.target.value)} required/></label></>}<label>Email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required/></label><label>Contraseña<input type="password" value={password} onChange={e=>setPassword(e.target.value)} minLength={6} required/></label>{msg&&<div className="message">{msg}</div>}<button className="primary" disabled={busy}>{busy?'Procesando…':mode==='login'?'Ingresar':'Crear cuenta'}</button></form>{mode==='login'&&<button className="linkbtn" onClick={resendConfirmation} disabled={resending}>{resending?'Enviando…':'Reenviar email de confirmación'}</button>}<button className="linkbtn" onClick={()=>{setMode(mode==='login'?'signup':'login');setMsg('')}}>{mode==='login'?'¿Primera vez? Crear cuenta':'Ya tengo cuenta'}</button></section></main>
}
