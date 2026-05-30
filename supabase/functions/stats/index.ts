import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    const now = new Date().toISOString()

    // Count active transfers
    const { count: activeCount, error: activeError } = await supabase
      .from('transfers')
      .select('*', { count: 'exact', head: true })
      .in('status', ['pending', 'ready'])
      .gte('expires_at', now)

    if (activeError) throw activeError

    // Count total transfers today
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const { count: todayCount } = await supabase
      .from('transfers')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', todayStart.toISOString())

    // Get total download count
    const { data: totalDownloads } = await supabase
      .from('transfers')
      .select('download_count')
      .gte('expires_at', now)

    const totalDownloadCount = totalDownloads?.reduce((sum, t) => sum + (t.download_count || 0), 0) || 0

    // Get total data transferred
    const { data: activeFiles } = await supabase
      .from('transfer_files')
      .select('size')

    const totalDataSize = activeFiles?.reduce((sum, f) => sum + Number(f.size), 0) || 0

    return new Response(
      JSON.stringify({
        success: true,
        activeTransfers: activeCount || 0,
        totalTransfers: activeCount || 0,
        todayTransfers: todayCount || 0,
        totalDownloads: totalDownloadCount,
        totalDataSize,
        totalDataTransferred: totalDataSize,
        uptime: 'operational',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('[stats] Error:', err)
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
