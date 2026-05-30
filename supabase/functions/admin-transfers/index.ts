import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const ADMIN_TOKEN = Deno.env.get('ADMIN_TOKEN') || '727218'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // Verify admin token
  const authHeader = req.headers.get('Authorization') || ''
  const token = authHeader.replace('Bearer ', '')

  if (token !== ADMIN_TOKEN) {
    return new Response(
      JSON.stringify({ success: false, error: 'Unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // Get all transfers with their files
    const { data: transfers, error: transfersError } = await supabase
      .from('transfers')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)

    if (transfersError) throw transfersError

    // Get files for all transfers
    const result = []
    for (const transfer of transfers || []) {
      const { data: files } = await supabase
        .from('transfer_files')
        .select('original_name, mime_type, size, created_at')
        .eq('transfer_code', transfer.code)

      result.push({
        code: transfer.code,
        status: transfer.status,
        downloadCount: transfer.download_count,
        createdAt: transfer.created_at,
        expiresAt: transfer.expires_at,
        expired: new Date() > new Date(transfer.expires_at),
        fileCount: files?.length || 0,
        files: files?.map(f => ({ name: f.original_name, size: f.size, type: f.mime_type })) || [],
      })
    }

    return new Response(
      JSON.stringify({
        success: true,
        count: result.length,
        transfers: result,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('[admin-transfers] Error:', err)
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
