import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    const { code, files: uploadedFiles } = await req.json()

    if (!code || !uploadedFiles || uploadedFiles.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Code and files are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify transfer exists and is in pending state
    const { data: transfer, error: lookupError } = await supabase
      .from('transfers')
      .select('*')
      .eq('code', code)
      .single()

    if (lookupError || !transfer) {
      return new Response(
        JSON.stringify({ success: false, error: 'Transfer not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (transfer.status !== 'pending') {
      return new Response(
        JSON.stringify({ success: false, error: 'Transfer already confirmed or expired' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Insert file records
    const fileRecords = uploadedFiles.map(f => ({
      transfer_code: code,
      original_name: f.originalName,
      mime_type: f.mimeType || 'application/octet-stream',
      size: f.size,
      storage_path: f.storagePath,
      encryption_key: f.encryptionKey,
      encryption_iv: f.encryptionIV,
    }))

    const { error: insertError } = await supabase
      .from('transfer_files')
      .insert(fileRecords)

    if (insertError) {
      console.error('[confirm-upload] Insert files error:', insertError)
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to save file records' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Update transfer status to ready
    const { error: updateError } = await supabase
      .from('transfers')
      .update({ status: 'ready' })
      .eq('code', code)

    if (updateError) {
      console.error('[confirm-upload] Update error:', updateError)
    }

    return new Response(
      JSON.stringify({ success: true, code, status: 'ready' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('[confirm-upload] Error:', err)
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
