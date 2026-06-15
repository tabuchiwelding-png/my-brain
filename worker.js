const CLIENT_ID = 'TlhmY2hNaHlCbGFFNTdMRVRLdkc6MTpjaQ';
const CLIENT_SECRET = 'KLFz3K5E5SVEoSUg3dAik8xQpFd0doJT1IJJu7TTsJOrjPK1q9';
const REDIRECT_URI = 'https://my-brain.tabuchi-welding.workers.dev/callback';
const FRONT_URL = 'https://tabuchiwelding-png.github.io/my-brain';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const cors = {
      'Access-Control-Allow-Origin': FRONT_URL,
      'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,X-Session-Id',
    };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });

    // /auth
    if (path === '/auth') {
      const state = crypto.randomUUID();
      const cv = genVerifier();
      const cc = await genChallenge(cv);
      await env.MYBRAIN_KV.put('s_' + state, cv, { expirationTtl: 600 });
      const p = new URLSearchParams({
        response_type: 'code', client_id: CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        scope: 'tweet.read tweet.write users.read follows.read like.write offline.access',
        state, code_challenge: cc, code_challenge_method: 'S256',
      });
      return Response.redirect('https://twitter.com/i/oauth2/authorize?' + p, 302);
    }

    // /callback
    if (path === '/callback') {
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const cv = await env.MYBRAIN_KV.get('s_' + state);
      if (!cv) return new Response('State error', { status: 400 });
      const r = await fetch('https://api.twitter.com/2/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Authorization': 'Basic ' + btoa(CLIENT_ID + ':' + CLIENT_SECRET) },
        body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: REDIRECT_URI, code_verifier: cv }),
      });
      const tokens = await r.json();
      if (!tokens.access_token) return new Response('Token error: ' + JSON.stringify(tokens), { status: 400 });
      const sid = crypto.randomUUID();
      await env.MYBRAIN_KV.put('sess_' + sid, JSON.stringify(tokens), { expirationTtl: 7200 });
      await env.MYBRAIN_KV.delete('s_' + state);
      return Response.redirect(FRONT_URL + '/?session=' + sid, 302);
    }

    // /me
    if (path === '/me') {
      const token = await getToken(request, env);
      if (!token) return new Response('Unauthorized', { status: 401, headers: cors });
      const r = await fetch('https://api.twitter.com/2/users/me?user.fields=profile_image_url,username,name', {
        headers: { Authorization: 'Bearer ' + token }
      });
      const data = await r.json();
      return new Response(JSON.stringify(data), { headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    // /timeline
    if (path === '/timeline') {
      const token = await getToken(request, env);
      if (!token) return new Response('Unauthorized', { status: 401, headers: cors });
      const me = await getMe(token);
      const r = await fetch(
        'https://api.twitter.com/2/users/' + me + '/timelines/reverse_chronological?max_results=20&tweet.fields=created_at,author_id,public_metrics&expansions=author_id&user.fields=name,username,profile_image_url',
        { headers: { Authorization: 'Bearer ' + token } }
      );
      const data = await r.json();
      return new Response(JSON.stringify(data), { headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    // /tweet
    if (path === '/tweet' && request.method === 'POST') {
      const token = await getToken(request, env);
      if (!token) return new Response('Unauthorized', { status: 401, headers: cors });
      const body = await request.json();
      const r = await fetch('https://api.twitter.com/2/tweets', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: body.text }),
      });
      const data = await r.json();
      return new Response(JSON.stringify(data), { headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    // /like
    if (path === '/like' && request.method === 'POST') {
      const token = await getToken(request, env);
      if (!token) return new Response('Unauthorized', { status: 401, headers: cors });
      const body = await request.json();
      const me = await getMe(token);
      const r = await fetch('https://api.twitter.com/2/users/' + me + '/likes', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ tweet_id: body.tweetId }),
      });
      const data = await r.json();
      return new Response(JSON.stringify(data), { headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    // /retweet
    if (path === '/retweet' && request.method === 'POST') {
      const token = await getToken(request, env);
      if (!token) return new Response('Unauthorized', { status: 401, headers: cors });
      const body = await request.json();
      const me = await getMe(token);
      const r = await fetch('https://api.twitter.com/2/users/' + me + '/retweets', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ tweet_id: body.tweetId }),
      });
      const data = await r.json();
      return new Response(JSON.stringify(data), { headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    // /search
    if (path === '/search') {
      const token = await getToken(request, env);
      if (!token) return new Response('Unauthorized', { status: 401, headers: cors });
      const q = url.searchParams.get('q') || '';
      const r = await fetch(
        'https://api.twitter.com/2/tweets/search/recent?query=' + encodeURIComponent(q) + '&max_results=20&tweet.fields=created_at,author_id,public_metrics&expansions=author_id&user.fields=name,username,profile_image_url',
        { headers: { Authorization: 'Bearer ' + token } }
      );
      const data = await r.json();
      return new Response(JSON.stringify(data), { headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    return new Response('Not found', { status: 404 });
  }
};

async function getToken(request, env) {
  const sid = request.headers.get('X-Session-Id');
  if (!sid) return null;
  const sess = await env.MYBRAIN_KV.get('sess_' + sid);
  if (!sess) return null;
  return JSON.parse(sess).access_token;
}

async function getMe(token) {
  const r = await fetch('https://api.twitter.com/2/users/me', { headers: { Authorization: 'Bearer ' + token } });
  const d = await r.json();
  return d.data?.id;
}

function genVerifier() {
  const a = new Uint8Array(32);
  crypto.getRandomValues(a);
  return btoa(String.fromCharCode(...a)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
}

async function genChallenge(v) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(v));
  return btoa(String.fromCharCode(...new Uint8Array(d))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
}
