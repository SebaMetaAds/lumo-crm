type AutomationEvent={
  workspaceId:string
  triggerType:string
  payload:Record<string,any>
}

type Condition={field:string;operator?:string;value:any}
type Action={type:string;config?:Record<string,any>}

export async function runAutomations(admin:any,event:AutomationEvent){
  const {data:rules,error}=await admin.from('automations')
    .select('id,name,condition_config,action_type,action_config')
    .eq('workspace_id',event.workspaceId)
    .eq('status','active')
    .eq('trigger_type',event.triggerType)
  if(error){console.error('Automation load error',error);return}

  for(const rule of rules||[]){
    if(!matchesConditions(rule.condition_config,event.payload))continue
    const startedAt=new Date().toISOString()
    const {data:run,error:runError}=await admin.from('automation_runs').insert({
      workspace_id:event.workspaceId,
      automation_id:rule.id,
      status:'running',
      trigger_payload:safePayload(event.payload),
      executed_at:startedAt,
    }).select('id').single()
    if(runError){console.error('Automation run insert error',runError);continue}

    try{
      const actions=normalizeActions(rule.action_type,rule.action_config)
      const results=[]
      for(let index=0;index<actions.length;index++){
        const action=actions[index]
        const result=await executeAction(admin,event.workspaceId,action.type,action.config||{},event.payload)
        results.push({index,type:action.type,result})
      }
      const finishedAt=new Date().toISOString()
      await admin.from('automation_runs').update({status:'success',action_result:{actions:results},finished_at:finishedAt}).eq('id',run.id)
      await admin.from('automations').update({last_run_at:finishedAt,updated_at:finishedAt}).eq('id',rule.id).eq('workspace_id',event.workspaceId)
    }catch(err:any){
      const finishedAt=new Date().toISOString()
      console.error('Automation action error',rule.id,err)
      await admin.from('automation_runs').update({status:'failed',error_message:err?.message||'Automation failed',finished_at:finishedAt}).eq('id',run.id)
      await admin.from('automations').update({last_run_at:finishedAt,updated_at:finishedAt}).eq('id',rule.id).eq('workspace_id',event.workspaceId)
    }
  }
}

function matchesConditions(config:any,payload:Record<string,any>){
  if(!config)return true
  const conditions:Condition[]=Array.isArray(config.conditions)?config.conditions:(config.field?[config]:[])
  if(!conditions.length)return true
  const logic=String(config.logic||'and').toLowerCase()
  const checks=conditions.map(c=>matchesOne(c,payload))
  return logic==='or'?checks.some(Boolean):checks.every(Boolean)
}

function matchesOne(config:Condition,payload:Record<string,any>){
  if(!config?.field)return true
  const actual=getPath(payload,String(config.field))
  const expected=config.value
  const operator=config.operator||'equals'
  if(['greater_than','greater_or_equal','less_than','less_or_equal'].includes(operator)){
    const a=Number(actual),e=Number(expected)
    if(!Number.isFinite(a)||!Number.isFinite(e))return false
    if(operator==='greater_than')return a>e
    if(operator==='greater_or_equal')return a>=e
    if(operator==='less_than')return a<e
    return a<=e
  }
  switch(operator){
    case 'not_equals':return String(actual??'').toLowerCase()!==String(expected??'').toLowerCase()
    case 'contains':return String(actual??'').toLowerCase().includes(String(expected??'').toLowerCase())
    case 'not_contains':return !String(actual??'').toLowerCase().includes(String(expected??'').toLowerCase())
    case 'equals':
    default:return String(actual??'').toLowerCase()===String(expected??'').toLowerCase()
  }
}

function normalizeActions(actionType:string,actionConfig:any):Action[]{
  if(Array.isArray(actionConfig?.actions))return actionConfig.actions.filter((a:any)=>a?.type)
  return [{type:actionType,config:actionConfig||{}}]
}

function getPath(obj:any,path:string){return path.split('.').reduce((acc,key)=>acc?.[key],obj)}

async function executeAction(admin:any,workspaceId:string,type:string,config:any,payload:Record<string,any>){
  const value=config?.value
  const conversationId=payload.conversation_id||payload.conversation?.id||null
  const contactId=payload.contact_id||payload.contact?.id||null

  if(type==='none')return {skipped:true}

  if(type==='set_priority'){
    if(!conversationId)throw new Error('La automatización necesita una conversación')
    const priority=String(value||'normal').toLowerCase()
    if(!['low','normal','high','urgent'].includes(priority))throw new Error(`Prioridad inválida: ${priority}`)
    const {error}=await admin.from('conversations').update({priority}).eq('id',conversationId).eq('workspace_id',workspaceId)
    if(error)throw error
    return {conversation_id:conversationId,priority}
  }

  if(type==='set_conversation_status'){
    if(!conversationId)throw new Error('La automatización necesita una conversación')
    const status=String(value||'open').toLowerCase()
    if(!['open','pending','closed'].includes(status))throw new Error(`Estado inválido: ${status}`)
    const {error}=await admin.from('conversations').update({status}).eq('id',conversationId).eq('workspace_id',workspaceId)
    if(error)throw error
    return {conversation_id:conversationId,status}
  }

  if(type==='assign_conversation'){
    if(!conversationId)throw new Error('La automatización necesita una conversación')
    if(!value)throw new Error('Falta el user_id a asignar')
    const {error}=await admin.from('conversations').update({assigned_user_id:String(value)}).eq('id',conversationId).eq('workspace_id',workspaceId)
    if(error)throw error
    return {conversation_id:conversationId,assigned_user_id:String(value)}
  }

  if(type==='add_tag'){
    if(!conversationId)throw new Error('La automatización necesita una conversación')
    const tag=String(value||'').trim()
    if(!tag)throw new Error('Falta la etiqueta a agregar')
    const {error}=await admin.from('conversation_tags').upsert({workspace_id:workspaceId,conversation_id:conversationId,tag},{onConflict:'conversation_id,tag',ignoreDuplicates:true})
    if(error)throw error
    return {conversation_id:conversationId,tag,added:true}
  }

  if(type==='remove_tag'){
    if(!conversationId)throw new Error('La automatización necesita una conversación')
    const tag=String(value||'').trim()
    if(!tag)throw new Error('Falta la etiqueta a quitar')
    const {error}=await admin.from('conversation_tags').delete().eq('workspace_id',workspaceId).eq('conversation_id',conversationId).eq('tag',tag)
    if(error)throw error
    return {conversation_id:conversationId,tag,removed:true}
  }

  if(type==='create_task'){
    const title=String(value||'Seguimiento de conversación').trim()
    const {data,error}=await admin.from('tasks').insert({
      workspace_id:workspaceId,
      title,
      contact_id:contactId,
      conversation_id:conversationId,
      priority:String(config?.priority||payload.suggested_priority||'normal'),
      status:'open',
    }).select('id,title').single()
    if(error)throw error
    return {task_id:data.id,title:data.title}
  }

  if(type==='create_opportunity'){
    if(!conversationId)throw new Error('La automatización necesita una conversación para crear la oportunidad')

    const {data:existing,error:existingError}=await admin.from('opportunities')
      .select('id,name,stage_id')
      .eq('workspace_id',workspaceId)
      .eq('conversation_id',conversationId)
      .is('closed_at',null)
      .limit(1)
      .maybeSingle()
    if(existingError)throw existingError
    if(existing)return {opportunity_id:existing.id,existing:true,name:existing.name}

    const {data:firstStage,error:stageError}=await admin.from('sales_stages')
      .select('id,name,probability')
      .eq('workspace_id',workspaceId)
      .eq('is_won',false)
      .eq('is_lost',false)
      .order('position',{ascending:true})
      .limit(1)
      .maybeSingle()
    if(stageError)throw stageError
    if(!firstStage)throw new Error('No hay una etapa inicial disponible en el Proceso de ventas')

    let ownerId=config?.owner_id||null
    const {data:conv}=await admin.from('conversations').select('assigned_user_id').eq('workspace_id',workspaceId).eq('id',conversationId).maybeSingle()
    if(!ownerId)ownerId=conv?.assigned_user_id||null

    const intentLabel=String(payload.intent_label||payload.intent||'Consulta comercial')
    const title=String(value||`${intentLabel} · ${payload.channel||'Inbox'}`).trim()
    const {data:opportunity,error}=await admin.from('opportunities').insert({
      workspace_id:workspaceId,
      name:title,
      contact_id:contactId,
      conversation_id:conversationId,
      stage_id:firstStage.id,
      owner_id:ownerId,
      amount:null,
      currency:String(config?.currency||'ARS'),
      probability:firstStage.probability,
      source_channel:payload.channel||null,
      notes:payload.summary?String(payload.summary).slice(0,1500):null,
    }).select('id,name,stage_id').single()
    if(error)throw error

    const {error:historyError}=await admin.from('opportunity_history').insert({
      workspace_id:workspaceId,
      opportunity_id:opportunity.id,
      event_type:'created',
      from_stage_id:null,
      to_stage_id:firstStage.id,
      metadata:{source:'automation',conversation_id:conversationId,intent:payload.intent||null},
    })
    if(historyError)console.error('Opportunity history insert error',historyError)
    return {opportunity_id:opportunity.id,existing:false,name:opportunity.name,stage_id:firstStage.id}
  }

  throw new Error(`Acción todavía no implementada: ${type}`)
}

function safePayload(payload:Record<string,any>){
  const copy={...payload}
  if('body' in copy)copy.body=String(copy.body||'').slice(0,500)
  if('summary' in copy)copy.summary=String(copy.summary||'').slice(0,500)
  return copy
}
