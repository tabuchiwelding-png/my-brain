const TWITTER_CLIENT_ID = 'TlhmY2hNaHlCbGFFNTdMRVRLdkc6MTpjaQ';
const TWITTER_CLIENT_SECRET = 'KLFz3K5E5SVEoSUg3dAik8xQpFd0doJT1IJJu7TTsJOrjPK1q9';
const REDIRECT_URI = 'https://my-brain.tabuchi-welding.workers.dev/callback';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    const corsHeaders = {
      'Access-Control-Allow-Origin': 'https://tabuchiwelding-png.github.io',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // OAuth開始
    if (path === '/auth') {
      const state = crypto.randomUUID();
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = await generateCodeChallenge(codeVerifier);
      
      const params = new URLSearchParams({
        response_type: 'code',
        client_id: TWITTER_CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        scope: 'tweet.read tweet.write users.read follows.read like.write offline.access',
        state,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
      });

      await env.MYBRAIN_KV.put(`state_${state}`, codeVerifier, { expirationTtl: 600 });

      return Response.redirect(`https://twitter.com/i/oauth2/authorize?${params}`, 302);
    }

    // OAuthコールバック
    if (path === '/callback') {
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const codeVerifier = await env.MYBRAIN_KV.get(`state_${state}`);

      if (!codeVerifier) {
        return new Response('State mismatch', { status: 400 });
      }

      const tokenRes = await fetch('https://api.twitter.com/2/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': 'Basic ' + btoa(`${TWITTER_CLIENT_ID}:${TWITTER_CLIENT_SECRET}`),
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: REDIRECT_URI,
          code_verifier: codeVerifier,
        }),
      });

      const tokens = await tokenRes.json();
      const sessionId = crypto.randomUUID();
      await env.MYBRAIN_KV.put(`session_${sessionId}`, JSON.stringify(tokens), { expirationTtl: 7200 });
      await env.MYBRAIN_KV.delete(`state_${state}`);

      return Response.redirect(
        `https://tabuchiwelding-png.github.io/my-brain/?session=${sessionId}`, 302
      );
    }

    // タイムライン取得
    if (path === '/timeline') {
      const token = await getToken(request, env);
      if (!token) return new Response('Unauthorized', { status: 401, headers: corsHeaders });

      const res = await fetch(
        'https://api.twitter.com/2/users/me/timelines/reverse_chronological?max_results=20&tweet.fields=created_at,author_id,public_metrics&expansions=author_id&user.fields=name,username,profile_image_url',
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      const data = await res.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 投稿
    if (path === '/tweet' && request.method === 'POST') {
      const token = await getToken(request, env);
      if (!token) return new Response('Unauthorized', { status: 401, headers: corsHeaders });

      const body = await request.json();
      const res = await fetch('https://api.twitter.com/2/tweets', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: body.text }),
      });
      const data = await res.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // いいね
    if (path === '/like' && request.method === 'POST') {
      const token = await getToken(request, env);
      if (!token) return new Response('Unauthorized', { status: 401, headers: corsHeaders });

      const body = await request.json();
      const userId = await getUserId(token);
      const res = await fetch(`https://api.twitter.com/2/users/${userId}/likes`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tweet_id: body.tweetId }),
      });
      const data = await res.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // リツイート
    if (path === '/retweet' && request.method === 'POST') {
      const token = await getToken(request, env);
      if (!token) return new Response('Unauthorized', { status: 401, headers: corsHeaders });

      const body = await request.json();
      const userId = await getUserId(token);
      const res = await fetch(`https://api.twitter.com/2/users/${userId}/retweets`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tweet_id: body.tweetId }),
      });
      const data = await res.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response('Not found', { status: 404 });
  }
};

async function getToken(request, env) {
  const sessionId = request.headers.get('X-Session-Id');
  if (!sessionId) return null;
  const session = await env.MYBRAIN_KV.get(`session_${sessionId}`);
  if (!session) return null;
  return JSON.parse(session).access_token;
}

async function getUserId(token) {
  const res = await fetch('https://api.twitter.com/2/users/me', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await res.json();
  return data.data.id;
}

function generateCodeVerifier() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function generateCodeChallenge(verifier) {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
