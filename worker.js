const CONSUMER_KEY = 'AwVbYEP0hblISfSyhr0PmgFYb';
const CONSUMER_SECRET = '0lqIAbL1WtstIP4jguVgAHsUxT5HxQb725KwUQZbo96gLe1sxQ';
const ACCESS_TOKEN = '1687110196689342464-ySKWicaEpFXhRs8wh60d060Jz4yPdx';
const ACCESS_TOKEN_SECRET = 'u7Ok4AAXhUA5gW06B8YnAco8Hu26N6p3VYxtdg00lKrTj';
const FRONT_URL = 'https://tabuchiwelding-png.github.io/my-brain';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const cors = {
      'Access-Control-Allow-Origin': FRONT_URL,
      'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });

    if (path === '/me') {
      const r = await oauthFetch('GET', 'https://api.twitter.com/2/users/me', {'user.fields':'profile_image_url,username,name'});
      const data = await r.json();
      return new Response(JSON.stringify(data), { headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    if (path === '/timeline') {
      const me = await getMyId();
      const r = await oauthFetch('GET', `https://api.twitter.com/2/users/${me}/tweets`, {
        'max_results': '20',
        'tweet.fields': 'created_at,author_id,public_metrics',
        'expansions': 'author_id',
        'user.fields': 'name,username,profile_image_url'
      });
      const data = await r.json();
      return new Response(JSON.stringify(data), { headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    if (path === '/tweet' && request.method === 'POST') {
      const body = await request.json();
      const r = await oauthFetch('POST', 'https://api.twitter.com/2/tweets', {}, body);
      const data = await r.json();
      return new Response(JSON.stringify(data), { headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    if (path === '/like' && request.method === 'POST') {
      const body = await request.json();
      const me = await getMyId();
      const r = await oauthFetch('POST', `https://api.twitter.com/2/users/${me}/likes`, {}, { tweet_id: body.tweetId });
      const data = await r.json();
      return new Response(JSON.stringify(data), { headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    if (path === '/retweet' && request.method === 'POST') {
      const body = await request.json();
      const me = await getMyId();
      const r = await oauthFetch('POST', `https://api.twitter.com/2/users/${me}/retweets`, {}, { tweet_id: body.tweetId });
      const data = await r.json();
      return new Response(JSON.stringify(data), { headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    if (path === '/search') {
      const q = url.searchParams.get('q') || '';
      const r = await oauthFetch('GET', 'https://api.twitter.com/2/tweets/search/recent', {
        'query': q,
        'max_results': '10',
        'tweet.fields': 'created_at,author_id,public_metrics',
        'expansions': 'author_id',
        'user.fields': 'name,username,profile_image_url'
      });
      const data = await r.json();
      return new Response(JSON.stringify(data), { headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    return new Response('Not found', { status: 404 });
  }
};

let cachedMyId = null;
async function getMyId() {
  if (cachedMyId) return cachedMyId;
  const r = await oauthFetch('GET', 'https://api.twitter.com/2/users/me', {});
  const d = await r.json();
  cachedMyId = d.data?.id;
  return cachedMyId;
}

async function oauthFetch(method, baseUrl, params = {}, body = null) {
  const op = {
    oauth_consumer_key: CONSUMER_KEY,
    oauth_nonce: crypto.randomUUID().replace(/-/g, ''),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: ACCESS_TOKEN,
    oauth_version: '1.0',
  };
  const ap = method === 'GET' ? { ...params, ...op } : { ...op };
  const sp = Object.keys(ap).sort().map(k => `${pct(k)}=${pct(ap[k])}`).join('&');
  const bs = [method.toUpperCase(), pct(baseUrl), pct(sp)].join('&');
  const sk = `${pct(CONSUMER_SECRET)}&${pct(ACCESS_TOKEN_SECRET)}`;
  const sig = await hmac(sk, bs);
  op.oauth_signature = sig;
  const ah = 'OAuth ' + Object.keys(op).sort().map(k => `${pct(k)}="${pct(op[k])}"`).join(', ');
  let fu = baseUrl;
  if (method === 'GET' && Object.keys(params).length > 0) {
    fu += '?' + Object.keys(params).map(k => `${pct(k)}=${pct(params[k])}`).join('&');
  }
  const fo = { method, headers: { 'Authorization': ah } };
  if (body && method !== 'GET') {
    fo.headers['Content-Type'] = 'application/json';
    fo.body = JSON.stringify(body);
  }
  return fetch(fu, fo);
}

function pct(s) {
  return encodeURIComponent(String(s)).replace(/!/g,'%21').replace(/'/g,'%27').replace(/\(/g,'%28').replace(/\)/g,'%29').replace(/\*/g,'%2A');
}

async function hmac(key, msg) {
  const enc = new TextEncoder();
  const k = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const s = await crypto.subtle.sign('HMAC', k, enc.encode(msg));
  return btoa(String.fromCharCode(...new Uint8Array(s)));
}
