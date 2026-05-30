import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    const url = new URL(req.url)
    const code = url.searchParams.get('code')

    if (!code) {
      return new Response(
        JSON.stringify({ success: false, error: 'Code parameter is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Look up transfer
    const { data: transfer, error: lookupError } = await supabase
      .from('transfers')
      .select('*')
      .eq('code', code)
      .single()

    if (lookupError || !transfer) {
      return new Response(
        JSON.stringify({ success: false, error: 'Code not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check expiration
    const now = new Date()
    const expiresAt = new Date(transfer.expires_at)
    if (now > expiresAt) {
      await supabase.from('transfers').update({ status: 'expired' }).eq('code', code)
      return new Response(
        JSON.stringify({ success: false, error: 'Transfer code has expired' }),
        { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get file metadata
    const { data: files } = await supabase
      .from('transfer_files')
      .select('original_name, mime_type, size')
      .eq('transfer_code', code)

    return new Response(
      JSON.stringify({
        success: true,
        code,
        status: transfer.status,
        downloadCount: transfer.download_count,
        expiresAt: transfer.expires_at,
        createdAt: transfer.created_at,
        fileCount: files?.length || 0,
        files: files?.map(f => ({
          originalName: f.original_name,
          mimeType: f.mime_type,
          size: f.size,
        })) || [],
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('[file-info] Error:', err)
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
