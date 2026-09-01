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
 const latestRaw=String(inbound[inbound.length-1]?.body||'').trim()
 const latestMessage=latestRaw.toLowerCase()
 const recentContext=inbound.slice(-3).map(m=>String(m.body||'').trim()).filter(Boolean)
 const contextText=recentContext.join(' ').toLowerCase()

 let best=intentRules[intentRules.length-1],bestScore=0,signals:string[]=[]
 for(const rule of intentRules){
  const matched=rule.words.filter(w=>latestMessage.includes(w))
  const score=matched.length
  if(score>bestScore){best=rule;bestScore=score;signals=matched.slice(0,4)}
 }
 if(bestScore===0){
  best={intent:'other',label:'Consulta general',words:[],priority:'normal'}
  signals=[]
 }

 const summary=buildSummary(recentContext,best.label)
 const urgencySignals=['urgente','hoy','ya','ahora','cuanto antes','cuánto antes','necesito resolver'].filter(w=>latestMessage.includes(w))
 let priority=best.priority
 if(best.intent==='complaint'&&urgencySignals.length)priority='urgent'
 else if(urgencySignals.length&&priority==='normal')priority='high'

 const contextMatches=best.intent==='other'?0:best.words.filter(w=>contextText.includes(w)).length
 const contextBonus=contextMatches>bestScore?0.04:0
 const confidence=Math.min(.95,.45+bestScore*.14+contextBonus+(urgencySignals.length?0.05:0))
 return {intent:best.intent,intent_label:best.label,confidence:Number(confidence.toFixed(2)),suggested_priority:priority,summary,suggested_replies:replySuggestions(best.intent,latestRaw),signals:[...signals,...urgencySignals].slice(0,6)}
}

function buildSummary(latest:string[],label:string){
 if(!latest.length)return 'Todavía no hay suficiente conversación para resumir.'
 const joined=latest.join(' · ').replace(/\s+/g,' ').trim()
 const trimmed=joined.length>220?joined.slice(0,217)+'...':joined
 return `${label}: ${trimmed}`
}

function includesAny(text:string,terms:string[]){return terms.some(t=>text.includes(t))}

function hasSpecificSubject(raw:string,intent:InboxIntent){
 let text=raw.toLowerCase()
 text=text.replace(/[¿?¡!.,]/g,' ')
 text=text.replace(/\b(hola|buen día|buen dia|buenas|por favor|gracias)\b/g,' ')
 const generic:Record<string,string[]>={
  availability:['tenés','tenes','tienen','hay','stock','disponible','disponibilidad','queda','agotado','agotada'],
  product:['qué','que','cuál','cual','medida','medidas','tamaño','tamano','color','material','modelo','producto','tiene','tienen','es','son'],
  price:['cuánto','cuanto','sale','precio','valor','cuesta','promo','promoción','oferta','descuento','del','de','la','el'],
  payment:['puedo','pagar','pago','cuotas','tarjeta','transferencia','mercado','mercadopago','efectivo','financiación','financiacion'],
 }
 for(const word of generic[intent]||[])text=text.replace(new RegExp(`\\b${word}\\b`,'g'),' ')
 text=text.replace(/\s+/g,' ').trim()
 return text.split(' ').filter(Boolean).length>=1
}

function replySuggestions(intent:InboxIntent,lastRaw:string){
 const last=lastRaw.toLowerCase()
 const hasSubject=hasSpecificSubject(lastRaw,intent)

 if(intent==='product'){
  if(includesAny(last,['medida','medidas','tamaño','tamano']))return hasSubject?[
   '¡Hola! Claro. Reviso las medidas de ese modelo y te las confirmo.',
   '¡Hola! Sí. Te confirmo las medidas exactas de ese producto.'
  ]:[
   '¡Hola! Claro. ¿Me indicás el modelo exacto que estás viendo? Así te confirmo las medidas.',
   '¡Hola! Sí. Decime qué modelo es y te paso las medidas correspondientes.'
  ]
  if(last.includes('material'))return hasSubject?[
   '¡Hola! Claro. Reviso el material de ese producto y te lo confirmo.',
   '¡Hola! Sí. Te confirmo de qué material está hecho ese modelo.'
  ]:[
   '¡Hola! Claro. ¿Me indicás qué producto o modelo estás viendo? Así te confirmo el material exacto.',
   '¡Hola! Sí. Pasame el nombre del producto y te confirmo de qué material está hecho.'
  ]
  if(last.includes('color'))return hasSubject?[
   '¡Hola! Claro. Reviso los colores disponibles para ese producto y te confirmo.',
   '¡Hola! Sí. Te confirmo las variantes de color disponibles para ese modelo.'
  ]:[
   '¡Hola! Claro. ¿Qué producto o modelo estás viendo? Así te confirmo los colores disponibles.',
   '¡Hola! Sí. Decime el modelo y te confirmo qué colores hay para ese producto.'
  ]
  if(last.includes('sirve para'))return [
   '¡Hola! Claro. Contame para qué lo querés usar y te digo si ese producto te sirve.',
   '¡Hola! Sí. Decime para qué espacio o uso lo necesitás y te oriento.'
  ]
  return hasSubject?['¡Hola! Claro. Reviso la información de ese producto y te ayudo con lo que necesites.','¡Hola! Sí. Te confirmo los datos de ese modelo.']:['¡Hola! Claro. Decime qué producto estás viendo y qué dato necesitás, así te paso la información correcta.','¡Hola! Sí. Pasame el nombre del producto y te ayudo con la información que necesites.']
 }

 if(intent==='availability')return hasSubject?[
  '¡Hola! Claro. Reviso esa variante y te confirmo la disponibilidad exacta.',
  '¡Hola! Sí. Verifico el stock de ese producto y te confirmo.'
 ]:[
  '¡Hola! Claro. ¿Me indicás el producto, medida y color que buscás? Así revisamos la disponibilidad exacta.',
  '¡Hola! Sí. Pasame el modelo y la variante que necesitás y verificamos el stock.'
 ]

 if(intent==='shipping'){
  const hasPostal=/(\bcp\b|código postal|codigo postal|\b[abceghjklmnprstuvxyz]\d{4}[a-z]{3}\b|\b\d{4}\b)/i.test(lastRaw)
  const hasLocation=includesAny(last,['rosario','córdoba','cordoba','mendoza','la plata','mar del plata','tucumán','tucuman','salta','santa fe','neuquén','neuquen','buenos aires','caba'])
  if(hasPostal)return ['¡Hola! Perfecto. Con ese código postal podemos revisar las opciones, costo y demora estimada del envío.','¡Hola! Gracias. Con ese código postal te confirmamos las alternativas de envío disponibles.']
  if(hasLocation)return ['¡Hola! Claro. Para confirmarte costo y demora exacta del envío, ¿me pasás tu código postal?','¡Hola! Sí. Pasame el código postal y te confirmamos las opciones de entrega para tu zona.']
  return ['¡Hola! Claro. ¿Me pasás tu localidad y código postal? Así te confirmamos opciones, costo y demora del envío.','¡Hola! Sí. Decime localidad y código postal y revisamos las alternativas de entrega.']
 }

 if(intent==='price'){
  if(includesAny(last,['promo','promoción','oferta','descuento']))return hasSubject?[
   '¡Hola! Claro. Reviso el precio actual de ese producto y si tiene alguna promoción vigente.',
   '¡Hola! Sí. Te confirmo el precio y las promociones vigentes para esa variante.'
  ]:[
   '¡Hola! Claro. ¿Qué producto o modelo estás viendo? Así te confirmo el precio y si tiene alguna promoción vigente.',
   '¡Hola! Sí. Pasame el producto y te confirmo el precio actual y las promociones que correspondan.'
  ]
  return hasSubject?['¡Hola! Claro. Reviso el precio de ese producto y te lo confirmo.','¡Hola! Sí. Te confirmo el precio actual de esa variante.']:['¡Hola! Claro. ¿Qué producto, modelo o medida estás viendo? Así te confirmo el precio exacto.','¡Hola! Sí. Pasame el nombre del producto o la variante y te confirmo el precio actual.']
 }

 if(intent==='payment'){
  if(last.includes('cuotas'))return hasSubject?[
   '¡Hola! Claro. Reviso las opciones de cuotas disponibles para ese producto y te confirmo.',
   '¡Hola! Sí. Te confirmo las alternativas de pago en cuotas para ese producto.'
  ]:[
   '¡Hola! Claro. ¿Qué producto estás viendo? Así te confirmo las opciones de cuotas disponibles.',
   '¡Hola! Sí. Decime qué producto querés comprar y te paso las alternativas de pago en cuotas.'
  ]
  if(last.includes('transferencia'))return [
   '¡Hola! Sí, podemos revisar la opción de pago por transferencia. ¿Querés que te pase el detalle?',
   '¡Hola! Claro. Te paso la información para pago por transferencia.'
  ]
  if(includesAny(last,['mercado pago','mercadopago']))return [
   '¡Hola! Claro. Te confirmo las opciones disponibles para pagar con Mercado Pago.',
   '¡Hola! Sí. Te paso el detalle de pago con Mercado Pago.'
  ]
  return ['¡Hola! Claro. ¿Qué medio de pago querés usar? Así te paso la opción correspondiente.','¡Hola! Sí. Decime si preferís tarjeta, transferencia u otro medio y te paso el detalle.']
 }

 const base={
  complaint:['Hola. Gracias por contarnos lo ocurrido. Quiero ayudarte a resolverlo: ¿podés pasarme el número de pedido y una breve descripción del problema?','Hola. Ya tomo el caso para revisarlo. Pasame por favor el número de pedido y, si aplica, una foto para poder darte una solución.'],
  purchase:['¡Genial! Te ayudo a completar la compra. Decime qué producto, medida y cantidad querés y te indico el siguiente paso.','¡Perfecto! Podemos avanzar con el pedido. ¿Qué modelo y cantidad necesitás?'],
  greeting:['¡Hola! ¿Cómo estás? Contame en qué te puedo ayudar.','¡Hola! Gracias por escribirnos. ¿Qué estás buscando?'],
  other:['¡Hola! Claro, contame un poco más y te ayudo.','¡Hola! Gracias por escribirnos. ¿En qué podemos ayudarte?'],
 } as Record<'complaint'|'purchase'|'greeting'|'other',string[]>
 return base[intent as keyof typeof base]||base.other
}
