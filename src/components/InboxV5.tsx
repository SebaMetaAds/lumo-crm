'use client'
import InboxOpportunityBar from '@/components/InboxOpportunityBar'
import InboxV4 from '@/components/InboxV4'

export default function InboxV5(){
 return <>
  <div style={{padding:'0 24px',marginTop:16}}><InboxOpportunityBar/></div>
  <InboxV4/>
 </>
}
