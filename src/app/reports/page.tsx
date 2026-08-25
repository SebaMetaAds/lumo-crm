'use client'
import { useEffect, useMemo, useState } from 'react'
import { AppShell } from '@/components/AppShell'
import { supabase } from '@/lib/supabase'
import './reports.css'

type Period='7'|'30'|'90'|'all'
type Stage={id:string;name:string;position:number;is_won:boolean;is_lost:boolean}
type Opportunity={id:string;name:string;amount:number|null;currency:string;source_channel:string|null;stage_id:string|null;created_at:string;closed_at:string|null;sales_stages:Stage|null}
type Task={id:string;status:string;priority:string;created_at:string;completed_at:string|null}
type ProductLine={id:string;quantity:number;unit_price:number|null;products:{id:string;name:string;sku:string|null}|null;opportunities:{id:string;closed_at:string|null;stage_id:string|null;sales_stages:{is_won:boolean}|null}|null}

const money=(v:number)=>new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(v)

export default function Reports(){
 const [period,setPeriod]=useState<Period>('30')
 const [stages,setStages]=useState<Stage[]>([])
 const [opps,setOpps]=useState<Opportunity[]>([])
 const [tasks,setTasks]=useState<Task[]>([])
 const [products,setProducts]=useState<ProductLine[]>([])
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState('')

 useEffect(()=>{load()},[])
 async function load(){
  setLoading(true);setError('')
  const {data:{user}}=await supabase.auth.getUser();if(!user){setLoading(false);return}
  const {data:mem,error:me}=await supabase.from('workspace_members').select('workspace_id').eq('user_id',user.id).eq('status','active').limit(1).single()
  if(me||!mem){setError(me?.message||'No encontramos tu espacio de trabajo.');setLoading(false);return}
  const wid=mem.workspace_id
  const [{data:ss,error:se},{data:oo,error:oe},{data:tt,error:te},{data:pp,error:pe}]=await Promise.all([
   supabase.from('sales_stages').select('id,name,position,is_won,is_lost').eq('workspace_id',wid).order('position'),
   supabase.from('opportunities').select('id,name,amount,currency,source_channel,stage_id,created_at,closed_at,sales_stages(id,name,position,is_won,is_lost)').eq('workspace_id',wid).order('created_at',{ascending:false}),
   supabase.from('tasks').select('id,status,priority,created_at,completed_at').eq('workspace_id',wid),
   supabase.from('opportunity_products').select('id,quantity,unit_price,products(id,name,sku),opportunities(id,closed_at,stage_id,sales_stages(is_won))').eq('workspace_id',wid)
  ])
  const firstError=se||oe||te||pe
  if(firstError)setError(firstError.message)
  setStages((ss||[]) as Stage[])
  setOpps((oo||[]) as unknown as Opportunity[])
  setTasks((tt||[]) as Task[])
  setProducts((pp||[]) as unknown as ProductLine[])
  setLoading(false)
 }

 const since=useMemo(()=>{
  if(period==='all')return null
  const d=new Date();d.setDate(d.getDate()-Number(period));return d
 },[period])
 const inPeriod=(value:string|null|undefined)=>!since||!!value&&new Date(value)>=since
 const periodOpps=useMemo(()=>opps.filter(o=>inPeriod(o.created_at)),[opps,since])
 const wonOpps=useMemo(()=>opps.filter(o=>o.sales_stages?.is_won&&inPeriod(o.closed_at||o.created_at)),[opps,since])
 const lostOpps=useMemo(()=>opps.filter(o=>o.sales_stages?.is_lost&&inPeriod(o.closed_at||o.created_at)),[opps,since])
 const openOpps=useMemo(()=>opps.filter(o=>!o.sales_stages?.is_won&&!o.sales_stages?.is_lost&&inPeriod(o.created_at)),[opps,since])
 const openValue=openOpps.reduce((s,o)=>s+Number(o.amount||0),0)
 const wonValue=wonOpps.reduce((s,o)=>s+Number(o.amount||0),0)
 const closedCount=wonOpps.length+lostOpps.length
 const winRate=closedCount?Math.round((wonOpps.length/closedCount)*100):0

 const stageMetrics=stages.map(s=>{
  const rows=periodOpps.filter(o=>o.stage_id===s.id)
  return {name:s.name,count:rows.length,value:rows.reduce((a,o)=>a+Number(o.amount||0),0)}
 })
 const maxStage=Math.max(1,...stageMetrics.map(x=>x.count))
 const channelMetrics=Object.entries(periodOpps.reduce((acc,o)=>{
  const key=o.source_channel||'Sin canal';const prev=acc[key]||{count:0,value:0};prev.count++;prev.value+=Number(o.amount||0);acc[key]=prev;return acc
 },{} as Record<string,{count:number;value:number}>)).sort((a,b)=>b[1].value-a[1].value)

 const productMetrics=Object.values(products.reduce((acc,line)=>{
  const isWon=line.opportunities?.sales_stages?.is_won
  const eventDate=line.opportunities?.closed_at
  if(!isWon||!inPeriod(eventDate))return acc
  const name=line.products?.name||'Producto';const prev=acc[name]||{name,qty:0,value:0};prev.qty+=Number(line.quantity||0);prev.value+=Number(line.quantity||0)*Number(line.unit_price||0);acc[name]=prev;return acc
 },{} as Record<string,{name:string;qty:number;value:number}>)).sort((a,b)=>b.value-a.value).slice(0,8)

 const periodTasks=tasks.filter(t=>inPeriod(t.created_at))
 const completed=periodTasks.filter(t=>t.status==='completed').length
 const pending=periodTasks.filter(t=>t.status==='open'||t.status==='in_progress').length
 const urgent=periodTasks.filter(t=>t.priority==='urgent'&&t.status!=='completed'&&t.status!=='cancelled').length

 const label=period==='all'?'Todo el historial':`Últimos ${period} días`
 return <AppShell><div className="page reports-page">
  <div className="page-head reports-head"><div><h1>Reportes</h1><p>Rendimiento comercial de Lumo basado en datos reales.</p></div><div className="reports-period">{(['7','30','90','all'] as Period[]).map(p=><button key={p} className={period===p?'active':''} onClick={()=>setPeriod(p)}>{p==='all'?'Todo':`${p} días`}</button>)}</div></div>
  {error&&<div className="error-banner">{error}</div>}
  {loading?<div className="loading">Cargando reportes…</div>:<>
   <div className="report-kpis">
    <div className="report-kpi"><span>Valor abierto</span><strong>{money(openValue)}</strong><small>{openOpps.length} oportunidades · {label}</small></div>
    <div className="report-kpi"><span>Ventas ganadas</span><strong>{money(wonValue)}</strong><small>{wonOpps.length} cierres ganados</small></div>
    <div className="report-kpi"><span>Tasa de cierre</span><strong>{winRate}%</strong><small>{wonOpps.length} ganadas · {lostOpps.length} perdidas</small></div>
    <div className="report-kpi"><span>Tareas completadas</span><strong>{completed}</strong><small>{pending} pendientes en el período</small></div>
   </div>

   <div className="report-grid">
    <section className="report-section"><h2>Oportunidades por etapa</h2><p className="section-sub">Cantidad de oportunidades creadas en el período.</p><div className="metric-bars">{stageMetrics.map(row=><div className="metric-row" key={row.name}><span>{row.name}</span><div className="metric-track"><div className="metric-fill" style={{width:`${Math.max(3,(row.count/maxStage)*100)}%`}}/></div><b>{row.count}</b></div>)}</div></section>
    <section className="report-section"><h2>Conversión comercial</h2><p className="section-sub">Resultado de oportunidades cerradas.</p><div className="winrate-wrap"><div className="winrate-ring" style={{'--rate':`${winRate}%`} as React.CSSProperties}><strong>{winRate}%</strong></div><div className="winrate-copy"><span>Ganadas</span><b>{wonOpps.length}</b><span>Perdidas</span><b>{lostOpps.length}</b></div></div><div className="report-footnote">La tasa considera únicamente oportunidades cerradas dentro del período.</div></section>
   </div>

   <div className="report-grid">
    <section className="report-section"><h2>Rendimiento por canal</h2><p className="section-sub">Origen de oportunidades y valor comercial generado.</p>{channelMetrics.length===0?<div className="report-empty">Todavía no hay oportunidades en este período.</div>:<div className="channel-table"><div className="report-table-row header"><span>Canal</span><span>Oportunidades</span><span>Valor</span></div>{channelMetrics.map(([name,v])=><div className="report-table-row" key={name}><strong>{labelChannel(name)}</strong><span>{v.count}</span><strong>{money(v.value)}</strong></div>)}</div>}</section>
    <section className="report-section"><h2>Salud de tareas</h2><p className="section-sub">Seguimientos creados durante el período.</p><div className="task-health"><div><span>Completadas</span><strong>{completed}</strong></div><div><span>Pendientes</span><strong>{pending}</strong></div><div><span>Urgentes abiertas</span><strong>{urgent}</strong></div></div></section>
   </div>

   <section className="report-section"><h2>Productos más vendidos</h2><p className="section-sub">Productos asociados a oportunidades ganadas en el período.</p>{productMetrics.length===0?<div className="report-empty">Todavía no hay productos en ventas ganadas para este período.</div>:<div className="product-table"><div className="report-table-row header"><span>Producto</span><span>Unidades</span><span>Venta</span></div>{productMetrics.map(p=><div className="report-table-row" key={p.name}><strong>{p.name}</strong><span>{p.qty}</span><strong>{money(p.value)}</strong></div>)}</div>}</section>
  </>}
 </div></AppShell>
}

function labelChannel(v:string){return ({instagram:'Instagram',facebook:'Facebook',mercadolibre:'Mercado Libre',whatsapp:'WhatsApp',tiktok:'TikTok',email:'Email',manual:'Manual','Sin canal':'Sin canal'} as Record<string,string>)[v]||v}
