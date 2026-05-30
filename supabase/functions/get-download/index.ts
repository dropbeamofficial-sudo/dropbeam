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
    const { code } = await req.json()

    if (!code) {
      return new Response(
        JSON.stringify({ success: false, error: 'Code is required' }),
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
        JSON.stringify({ success: false, error: 'Code not found or expired' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if expired
    const now = new Date()
    const expiresAt = new Date(transfer.expires_at)
    if (now > expiresAt) {
      // Mark as expired
      await supabase.from('transfers').update({ status: 'expired' }).eq('code', code)
      return new Response(
        JSON.stringify({ success: false, error: 'Transfer code has expired' }),
        { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (transfer.status !== 'ready') {
      return new Response(
        JSON.stringify({ success: false, error: 'Transfer is not ready yet' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get file records
    const { data: files, error: filesError } = await supabase
      .from('transfer_files')
      .select('*')
      .eq('transfer_code', code)

    if (filesError || !files || files.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'No files found for this code' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Increment download count
    const newCount = (transfer.download_count || 0) + 1
    await supabase
      .from('transfers')
      .update({ download_count: newCount })
      .eq('code', code)

    // Generate signed download URLs for each file (10 min expiry)
    const fileEntries = []
    for (const file of files) {
      const { data: urlData, error: urlError } = await supabase.storage
        .from('dropbeam-files')
        .createSignedUrl(file.storage_path, 600)

      if (urlError || !urlData) {
        console.error('[get-download] Signed URL error:', urlError)
        continue
      }

      fileEntries.push({
        id: file.id,
        originalName: file.original_name,
        mimeType: file.mime_type,
        size: file.size,
        downloadUrl: urlData.signedUrl,
        encryptionKey: file.encryption_key,
        encryptionIV: file.encryption_iv,
      })
    }

    // Update status if first download
    if (transfer.download_count === 0) {
      await supabase.from('transfers').update({ status: 'downloaded' }).eq('code', code)
    }

    return new Response(
      JSON.stringify({
        success: true,
        code,
        downloadCount: newCount,
        expiresAt: transfer.expires_at,
        files: fileEntries,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('[get-download] Error:', err)
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
