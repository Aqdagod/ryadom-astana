import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface TelegramAuthPayload {
  id: number | string;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number | string;
  hash: string;
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function verifyTelegramSignature(
  payload: TelegramAuthPayload,
  botToken: string
): Promise<boolean> {
  const entries = Object.entries(payload)
    .filter(([key, val]) => key !== 'hash' && val !== undefined && val !== null && val !== '')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, val]) => `${key}=${val}`);

  const dataCheckString = entries.join('\n');
  const encoder = new TextEncoder();

  const secretKeyRaw = await crypto.subtle.digest('SHA-256', encoder.encode(botToken));
  const hmacKey = await crypto.subtle.importKey(
    'raw',
    secretKeyRaw,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', hmacKey, encoder.encode(dataCheckString));
  const expectedHex = toHex(signature);
  return timingSafeEqualHex(expectedHex, String(payload.hash).toLowerCase());
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ code: 'METHOD_NOT_ALLOWED', message: 'Use POST' }, 405);
  }

  try {
    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');

    if (!botToken || !supabaseUrl || !serviceRoleKey || !anonKey) {
      return jsonResponse({ code: 'SERVICE_UNAVAILABLE', message: 'Missing server secrets' }, 503);
    }

    const payload = (await req.json()) as TelegramAuthPayload;
    if (!payload?.id || !payload?.auth_date || !payload?.hash) {
      return jsonResponse(
        { code: 'VALIDATION_FAILED', message: 'Missing Telegram auth fields (id, auth_date, hash)' },
        400
      );
    }

    const authAgeSec = Math.floor(Date.now() / 1000) - Number(payload.auth_date);
    if (!Number.isFinite(authAgeSec) || authAgeSec > 86400 || authAgeSec < -300) {
      return jsonResponse({ code: 'SESSION_EXPIRED', message: 'Telegram auth_date expired' }, 401);
    }

    const valid = await verifyTelegramSignature(payload, botToken);
    if (!valid) {
      return jsonResponse({ code: 'UNAUTHORIZED', message: 'Invalid Telegram HMAC signature' }, 401);
    }

    const telegramId = String(payload.id);
    const fullName = [payload.first_name, payload.last_name].filter(Boolean).join(' ').trim() || `User ${telegramId}`;
    const username = payload.username ? (payload.username.startsWith('@') ? payload.username : `@${payload.username}`) : null;
    const initials = fullName
      .split(/\s+/)
      .map((p) => p[0]?.toUpperCase() || '')
      .join('')
      .slice(0, 2) || 'TG';
    const syntheticEmail = `tg_${telegramId}@telegram.ryadom.local`;

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: existingProfile, error: profileReadErr } = await adminClient
      .from('users')
      .select('*')
      .eq('telegram_id', telegramId)
      .maybeSingle();

    if (profileReadErr) {
      return jsonResponse({ code: 'INTERNAL_ERROR', message: profileReadErr.message }, 500);
    }

    if (existingProfile?.is_blocked) {
      return jsonResponse(
        { code: 'USER_DEACTIVATED', message: 'Аккаунт заблокирован администратором' },
        403
      );
    }

    let authUserId = existingProfile?.id as string | undefined;

    if (!authUserId) {
      const { data: createdAuth, error: createAuthErr } = await adminClient.auth.admin.createUser({
        email: syntheticEmail,
        email_confirm: true,
        user_metadata: { telegram_id: telegramId, name: fullName, username },
      });

      if (createAuthErr) {
        const { data: linkProbe } = await adminClient.auth.admin.generateLink({
          type: 'magiclink',
          email: syntheticEmail,
        });
        authUserId = linkProbe?.user?.id;
        if (!authUserId) {
          return jsonResponse({ code: 'INTERNAL_ERROR', message: createAuthErr.message }, 500);
        }
      } else {
        authUserId = createdAuth.user.id;
      }
    }

    const { data: userRow, error: upsertErr } = await adminClient
      .from('users')
      .upsert(
        {
          id: authUserId,
          telegram_id: telegramId,
          name: fullName,
          username,
          avatar_initials: initials,
          role: existingProfile?.role || 'user',
          is_blocked: false,
        },
        { onConflict: 'telegram_id' }
      )
      .select('*')
      .single();

    if (upsertErr) {
      return jsonResponse({ code: 'INTERNAL_ERROR', message: upsertErr.message }, 500);
    }

    const { data: linkData, error: linkErr } = await adminClient.auth.admin.generateLink({
      type: 'magiclink',
      email: syntheticEmail,
    });

    if (linkErr || !linkData?.properties?.hashed_token) {
      return jsonResponse(
        { code: 'INTERNAL_ERROR', message: linkErr?.message || 'Failed to generate JWT link' },
        500
      );
    }

    const anonClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: verified, error: verifyErr } = await anonClient.auth.verifyOtp({
      token_hash: linkData.properties.hashed_token,
      type: 'magiclink',
    });

    if (verifyErr || !verified.session) {
      return jsonResponse(
        { code: 'INTERNAL_ERROR', message: verifyErr?.message || 'Failed to issue JWT session' },
        500
      );
    }

    return jsonResponse({
      access_token: verified.session.access_token,
      refresh_token: verified.session.refresh_token,
      session: verified.session,
      user: userRow,
    });
  } catch (err) {
    return jsonResponse(
      { code: 'INTERNAL_ERROR', message: err instanceof Error ? err.message : 'Unexpected error' },
      500
    );
  }
});
