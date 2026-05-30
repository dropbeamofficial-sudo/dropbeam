import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const EXPIRY_MINUTES = Number(Deno.env.get('EXPIRY_MINUTES')) || 15

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

function generateCode(): string {
  return String(100000 + Math.floor(Math.random() * 900000))
}

function generateKey(): string {
  const key = new Uint8Array(32)
  crypto.getRandomValues(key)
  return Array.from(key).map(b => b.toString(16).padStart(2, '0')).join('')
}

function generateIV(): string {
  const iv = new Uint8Array(16)
  crypto.getRandomValues(iv)
  return Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join('')
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    const { files } = await req.json()

    if (!files || files.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'No files provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Generate unique code
    let code: string
    let attempts = 0
    while (true) {
      code = generateCode()
      const { data: existing } = await supabase
        .from('transfers')
        .select('code')
        .eq('code', code)
        .maybeSingle()
      if (!existing) break
      attempts++
      if (attempts > 100) {
        return new Response(
          JSON.stringify({ success: false, error: 'Could not generate unique code' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Generate encryption keys and signed upload URLs for each file
    const fileEntries = []
    for (const file of files) {
      const key = generateKey()
      const iv = generateIV()
      const ext = file.name.split('.').pop() || 'bin'
      const storagePath = `${code}/${crypto.randomUUID()}.${ext}.enc`

      // Create signed upload URL
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('dropbeam-files')
        .createSignedUploadUrl(storagePath)

      if (uploadError || !uploadData) {
        console.error('[init-upload] Signed URL error:', uploadError)
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to create upload URL' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      fileEntries.push({
        originalName: file.name,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        storagePath,
        encryptionKey: key,
        encryptionIV: iv,
        signedUploadUrl: uploadData.signedUrl,
        token: uploadData.token,
      })
    }

    // Create transfer record
    const expiresAt = new Date(Date.now() + EXPIRY_MINUTES * 60 * 1000).toISOString()
    const { error: insertError } = await supabase
      .from('transfers')
      .insert({ code, status: 'pending', expires_at: expiresAt })

    if (insertError) {
      console.error('[init-upload] Insert error:', insertError)
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to create transfer' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        code,
        expiresAt,
        files: fileEntries.map(f => ({
          originalName: f.originalName,
          mimeType: f.mimeType,
          size: f.size,
          storagePath: f.storagePath,
          encryptionKey: f.encryptionKey,
          encryptionIV: f.encryptionIV,
          signedUploadUrl: f.signedUploadUrl,
          token: f.token,
        })),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('[init-upload] Error:', err)
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
