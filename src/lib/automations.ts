type AutomationEvent={
  workspaceId:string
  triggerType:string
  payload:Record<string,any>
}

export async function runAutomations(admin:any,event:AutomationEvent){
  const {data:rules,error}=await admin.from('automations')
    .select('id,name,condition_config,action_type,action_config')
    .eq('workspace_id',event.workspaceId)
    .eq('status','active')
    .eq('trigger_type',event.triggerType)
  if(error){console.error('Automation load error',error);return}

  for(const rule of rules||[]){
    if(!matchesCondition(rule.condition_config,event.payload))continue
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
      const result=await executeAction(admin,event.workspaceId,rule.action_type,rule.action_config||{},event.payload)
      const finishedAt=new Date().toISOString()
      await admin.from('automation_runs').update({status:'success',action_result:result,finished_at:finishedAt}).eq('id',run.id)
      await admin.from('automations').update({last_run_at:finishedAt,updated_at:finishedAt}).eq('id',rule.id).eq('workspace_id',event.workspaceId)
    }catch(err:any){
      const finishedAt=new Date().toISOString()
      console.error('Automation action error',rule.id,err)
      await admin.from('automation_runs').update({status:'failed',error_message:err?.message||'Automation failed',finished_at:finishedAt}).eq('id',run.id)
      await admin.from('automations').update({last_run_at:finishedAt,updated_at:finishedAt}).eq('id',rule.id).eq('workspace_id',event.workspaceId)
    }
  }
}

function matchesCondition(config:any,payload:Record<string,any>){
  if(!config||!config.field)return true
  const actual=getPath(payload,String(config.field))
  const expected=config.value
  switch(config.operator||'equals'){
    case 'not_equals':return String(actual??'')!==String(expected??'')
    case 'contains':return String(actual??'').toLowerCase().includes(String(expected??'').toLowerCase())
    case 'equals':
    default:return String(actual??'').toLowerCase()===String(expected??'').toLowerCase()
  }
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

  if(type==='create_task'){
    const title=String(value||'Seguimiento de conversación').trim()
    const {data,error}=await admin.from('tasks').insert({
      workspace_id:workspaceId,
      title,
      contact_id:contactId,
      conversation_id:conversationId,
      priority:'normal',
      status:'open',
    }).select('id,title').single()
    if(error)throw error
    return {task_id:data.id,title:data.title}
  }

  throw new Error(`Acción todavía no implementada: ${type}`)
}

function safePayload(payload:Record<string,any>){
  const copy={...payload}
  if('body' in copy)copy.body=String(copy.body||'').slice(0,500)
  return copy
}
