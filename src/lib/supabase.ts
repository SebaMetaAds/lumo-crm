import { createClient } from '@supabase/supabase-js'

const url = 'https://nkwuodqtdskhokilqdcr.supabase.co'
const key = 'sb_publishable_CqH9WhkNxi6FFrs1ZGiBCw_QrnooTze'

export const supabase = createClient(url, key)
