export type InboxIntent='price'|'shipping'|'availability'|'complaint'|'purchase'|'product'|'payment'|'greeting'|'other'
export type InboxInsight={intent:InboxIntent;intent_label:string;confidence:number;suggested_priority:'low'|'normal'|'high'|'urgent';summary:string;suggested_replies:string[];signals:string[]}

type Msg={direction?:string;body?:string|null;sent_at?:string}

const intentRules:Array<{intent:InboxIntent;label:string;words:string[];priority:InboxInsight['suggested_priority']}>= [
 {intent:'complaint',label:'Reclamo / problema',words:['reclamo','problema','roto','rota','fallo','falló','mal','devolver','devolución','cambio','no llegó','no llego','demora','queja'],priority:'high'},
 {intent:'purchase',label:'Intención de compra',words:['quiero comprar','lo compro','comprar','me interesa','quiero uno','quiero una','cómo compro','como compro','link de compra','hacer pedido','pedido'],priority:'high'},
 {intent:'price',label:'Consulta de precio',words:['precio','cuánto sale','cuanto sale','valor','cuesta','promo','promoción','oferta','descuento'],priority:'high'},
 {intent:'shipping',label:'Envío / entrega',words:['envío','envio','entrega','andreani','correo','llega','demora','costo de envío','costo de envio','retiro'],priority:'normal'},
 {intent:'availability',label:'Stock / disponibilidad',words:['stock','disponible','hay en','queda','tenés','tienen','agotado','disponibilidad'],priority:'normal'},
 {intent:'payment',label:'Pago / cuotas',words:['cuotas','tarjeta','transferencia','mercado pago','mercadopago','pago','efectivo','financiación','financiacion'],priority:'normal'},
 {intent:'product',label:'Consulta de producto',words:['medida','medidas','tamaño','tamano','color','material','sirve para','producto','modelo'],priority:'normal'},
 {intent:'greeting',label:'Saludo',words:['hola','buen día','buen dia','buenas','buenas tardes','buenas noches'],priority:'low'},
]

export function analyzeConversation(messages:Msg[]):InboxInsight{
 const inbound=messages.filter(m=>m.direction!=='outgoing'&&m.body?.trim())
 const all=inbound.map(m=>String(m.body||'')).join(' ').toLowerCase()
 let best=intentRules[intentRules.length-1],bestScore=0,signals:string[]=[]
 for(const rule of intentRules){
  const matched=rule.words.filter(w=>all.includes(w))
  const score=matched.length
  if(score>bestScore){best=rule;bestScore=score;signals=matched.slice(0,4)}
 }
 if(bestScore===0){
  best={intent:'other',label:'Consulta general',words:[],priority:'normal'}
  signals=[]
 }
 const latest=inbound.slice(-3).map(m=>String(m.body||'').trim()).filter(Boolean)
 const summary=buildSummary(latest,best.label)
 const urgencySignals=['urgente','hoy','ya','ahora','cuanto antes','cuánto antes','necesito resolver'].filter(w=>all.includes(w))
 let priority=best.priority
 if(best.intent==='complaint'&&urgencySignals.length)priority='urgent'
 else if(urgencySignals.length&&priority==='normal')priority='high'
 const confidence=Math.min(.95,.45+bestScore*.14+(urgencySignals.length?0.05:0))
 return {intent:best.intent,intent_label:best.label,confidence:Number(confidence.toFixed(2)),suggested_priority:priority,summary,suggested_replies:replySuggestions(best.intent,latest[latest.length-1]||''),signals:[...signals,...urgencySignals].slice(0,6)}
}

function buildSummary(latest:string[],label:string){
 if(!latest.length)return 'Todavía no hay suficiente conversación para resumir.'
 const joined=latest.join(' · ').replace(/\s+/g,' ').trim()
 const trimmed=joined.length>220?joined.slice(0,217)+'...':joined
 return `${label}: ${trimmed}`
}

function replySuggestions(intent:InboxIntent,last:string){
 const base={
  price:['¡Hola! Claro, te paso el precio y las opciones disponibles. ¿Qué medida o modelo estás buscando?','¡Hola! Sí, tenemos opciones disponibles. Te comparto precio, promo y medios de pago.'],
  shipping:['¡Hola! Claro. Decime tu localidad o código postal y te confirmo opciones, costo y plazo de entrega.','¡Hola! Te ayudo con el envío. ¿A qué localidad sería la entrega?'],
  availability:['¡Hola! Sí, te confirmo stock. ¿Qué modelo, medida y color necesitás?','¡Hola! Revisemos disponibilidad. Decime cuál producto estás buscando y te confirmo ahora.'],
  complaint:['Hola. Gracias por contarnos lo ocurrido. Quiero ayudarte a resolverlo: ¿podés pasarme el número de pedido y una breve descripción del problema?','Hola. Ya tomo el caso para revisarlo. Pasame por favor el número de pedido y, si aplica, una foto para poder darte una solución.'],
  purchase:['¡Genial! Te ayudo a completar la compra. Decime qué producto, medida y cantidad querés y te indico el siguiente paso.','¡Perfecto! Podemos avanzar con el pedido. ¿Qué modelo y cantidad necesitás?'],
  payment:['¡Hola! Te cuento los medios de pago disponibles. ¿Querés pagar con tarjeta o transferencia?','¡Hola! Sí, tenemos distintas opciones de pago. Decime cuál preferís y te paso el detalle.'],
  product:['¡Hola! Claro, te ayudo. ¿Qué dato necesitás del producto: medidas, material, colores o usos?','¡Hola! Sí, contame qué producto estás viendo y te paso toda la información.'],
  greeting:['¡Hola! ¿Cómo estás? Contame en qué te puedo ayudar.','¡Hola! Gracias por escribirnos. ¿Qué estás buscando?'],
  other:['¡Hola! Claro, contame un poco más y te ayudo.','¡Hola! Gracias por escribirnos. ¿En qué podemos ayudarte?'],
 } as Record<InboxIntent,string[]>
 const arr=base[intent]||base.other
 return last.includes('?')?arr:[arr[0],arr[1]]
}
