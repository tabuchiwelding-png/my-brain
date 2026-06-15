// OAuth 1.0a - ログイン不要、直接動作
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

    // /me
    if (path === '/me') {
      const r = await oauthFetch('GET', 'https://api.twitter.com/2/users/me', { 'user.fields': 'profile_image_url,username,name' });
      const data = await r.json();
      return new Response(JSON.stringify(data), { headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    // /timeline
    if (path === '/timeline') {
      const me = await getMyId();
      const r = await oauthFetch('GET', `https://api.twitter.com/2/users/${me}/timelines/reverse_chronological`, {
        'max_results': '20',
        'tweet.fields': 'created_at,author_id,public_metrics',
        'expansions': 'author_id',
        'user.fields': 'name,username,profile_image_url'
      });
      const data = await r.json();
      return new Response(JSON.stringify(data), { headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    // /tweet
    if (path === '/tweet' && request.method === 'POST') {
      const body = await request.json();
      const r = await oauthFetch('POST', 'https://api.twitter.com/2/tweets', {}, body);
      const data = await r.json();
      return new Response(JSON.stringify(data), { headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    // /like
    if (path === '/like' && request.method === 'POST') {
      const body = await request.json();
      const me = await getMyId();
      const r = await oauthFetch('POST', `https://api.twitter.com/2/users/${me}/likes`, {}, { tweet_id: body.tweetId });
      const data = await r.json();
      return new Response(JSON.stringify(data), { headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    // /retweet
    if (path === '/retweet' && request.method === 'POST') {
      const body = await request.json();
      const me = await getMyId();
      const r = await oauthFetch('POST', `https://api.twitter.com/2/users/${me}/retweets`, {}, { tweet_id: body.tweetId });
      const data = await r.json();
      return new Response(JSON.stringify(data), { headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    // /search
    if (path === '/search') {
      const q = url.searchParams.get('q') || '';
      const r = await oauthFetch('GET', 'https://api.twitter.com/2/tweets/search/recent', {
        'query': q,
        'max_results': '20',
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
  const oauthParams = {
    oauth_consumer_key: CONSUMER_KEY,
    oauth_nonce: crypto.randomUUID().replace(/-/g, ''),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: ACCESS_TOKEN,
    oauth_version: '1.0',
  };

  const allParams = method === 'GET' ? { ...params, ...oauthParams } : { ...oauthParams };
  const sortedParams = Object.keys(allParams).sort().map(k =>
    `${pct(k)}=${pct(allParams[k])}`
  ).join('&');

  const baseString = [
    method.toUpperCase(),
    pct(baseUrl),
    pct(sortedParams)
  ].join('&');

  const signingKey = `${pct(CONSUMER_SECRET)}&${pct(ACCESS_TOKEN_SECRET)}`;
  const signature = await hmacSha1(signingKey, baseString);
  oauthParams.oauth_signature = signature;

  const authHeader = 'OAuth ' + Object.keys(oauthParams).sort().map(k =>
    `${pct(k)}="${pct(oauthParams[k])}"`
  ).join(', ');

  let fetchUrl = baseUrl;
  if (method === 'GET' && Object.keys(params).length > 0) {
    fetchUrl += '?' + Object.keys(params).map(k => `${pct(k)}=${pct(params[k])}`).join('&');
  }

  const fetchOptions = {
    method,
    headers: { 'Authorization': authHeader }
  };

  if (body && method !== 'GET') {
    fetchOptions.headers['Content-Type'] = 'application/json';
    fetchOptions.body = JSON.stringify(body);
  }

  return fetch(fetchUrl, fetchOptions);
}

function pct(str) {
  return encodeURIComponent(String(str)).replace(/!/g,'%21').replace(/'/g,'%27').replace(/\(/g,'%28').replace(/\)/g,'%29').replace(/\*/g,'%2A');
}

async function hmacSha1(key, message) {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(message));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}
