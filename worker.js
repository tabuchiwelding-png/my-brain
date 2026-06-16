const CONSUMER_KEY = 'AwVbYEP0hblISfSyhr0PmgFYb';
const CONSUMER_SECRET = '0lqIAbL1WtstIP4jguVgAHsUxT5HxQb725KwUQZbo96gLe1sxQ';
const ACCESS_TOKEN = '1687110196689342464-ySKWicaEpFXhRs8wh60d060Jz4yPdx';
const ACCESS_TOKEN_SECRET = 'u7Ok4AAXhUA5gW06B8YnAco8Hu26N6p3VYxtdg00lKrTj';
const FRONT_URL = 'https://tabuchiwelding-png.github.io/my-brain';
const MY_ID = '1687110196689342464';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    if (request.method === 'OPTIONS') return new Response(null, {headers: cors});

    if (path === '/me') {
      const params = {'user.fields': 'profile_image_url,username,name'};
      const r = await go('GET', 'https://api.twitter.com/2/users/me', params);
      const text = await r.text();
      return new Response(text, {headers: {...cors, 'Content-Type': 'application/json'}});
    }

    if (path === '/timeline') {
      const params = {
        'max_results': '20',
        'tweet.fields': 'created_at,author_id,public_metrics',
        'expansions': 'author_id',
        'user.fields': 'name,username,profile_image_url'
      };
      const r = await go('GET', `https://api.twitter.com/2/users/${MY_ID}/tweets`, params);
      const text = await r.text();
      return new Response(text, {headers: {...cors, 'Content-Type': 'application/json'}});
    }

    if (path === '/tweet' && request.method === 'POST') {
      const b = await request.json();
      const r = await go('POST', 'https://api.twitter.com/2/tweets', {}, JSON.stringify(b));
      const text = await r.text();
      return new Response(text, {headers: {...cors, 'Content-Type': 'application/json'}});
    }

    if (path === '/like' && request.method === 'POST') {
      const b = await request.json();
      const r = await go('POST', `https://api.twitter.com/2/users/${MY_ID}/likes`, {}, JSON.stringify({tweet_id: b.tweetId}));
      const text = await r.text();
      return new Response(text, {headers: {...cors, 'Content-Type': 'application/json'}});
    }

    if (path === '/retweet' && request.method === 'POST') {
      const b = await request.json();
      const r = await go('POST', `https://api.twitter.com/2/users/${MY_ID}/retweets`, {}, JSON.stringify({tweet_id: b.tweetId}));
      const text = await r.text();
      return new Response(text, {headers: {...cors, 'Content-Type': 'application/json'}});
    }

    if (path === '/search') {
      const q = url.searchParams.get('q') || '';
      const params = {
        'query': q,
        'max_results': '10',
        'tweet.fields': 'created_at,author_id,public_metrics',
        'expansions': 'author_id',
        'user.fields': 'name,username,profile_image_url'
      };
      const r = await go('GET', 'https://api.twitter.com/2/tweets/search/recent', params);
      const text = await r.text();
      return new Response(text, {headers: {...cors, 'Content-Type': 'application/json'}});
    }

    return new Response('Not found', {status: 404, headers: cors});
  }
};

// ===== OAuth 1.0a =====
async function go(method, baseUrl, queryParams, body) {
  queryParams = queryParams || {};

  const oauthParams = {
    oauth_consumer_key: CONSUMER_KEY,
    oauth_nonce: nonce(),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: ts(),
    oauth_token: ACCESS_TOKEN,
    oauth_version: '1.0',
  };

  // 署名ベース文字列: GETのクエリパラメータのみ含める（POSTのbodyは含めない）
  const allParams = method === 'GET'
    ? Object.assign({}, queryParams, oauthParams)
    : Object.assign({}, oauthParams);

  const paramStr = Object.keys(allParams)
    .sort()
    .map(k => pct(k) + '=' + pct(allParams[k]))
    .join('&');

  const signatureBase = method + '&' + pct(baseUrl) + '&' + pct(paramStr);
  const signingKey = pct(CONSUMER_SECRET) + '&' + pct(ACCESS_TOKEN_SECRET);
  oauthParams.oauth_signature = await sign(signingKey, signatureBase);

  const authHeader = 'OAuth ' + Object.keys(oauthParams)
    .sort()
    .map(k => pct(k) + '="' + pct(oauthParams[k]) + '"')
    .join(', ');

  // GETはURLにクエリパラメータを付ける
  let fetchUrl = baseUrl;
  if (method === 'GET' && Object.keys(queryParams).length > 0) {
    fetchUrl += '?' + Object.keys(queryParams)
      .map(k => encodeURIComponent(k) + '=' + encodeURIComponent(queryParams[k]))
      .join('&');
  }

  const options = {
    method,
    headers: { 'Authorization': authHeader }
  };
  if (body) {
    options.headers['Content-Type'] = 'application/json';
    options.body = body;
  }

  return fetch(fetchUrl, options);
}

// RFC 3986 パーセントエンコード
function pct(s) {
  return encodeURIComponent(String(s))
    .replace(/!/g, '%21')
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
    .replace(/\*/g, '%2A');
}

function nonce() {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return Array.from(a).map(b => b.toString(16).padStart(2, '0')).join('');
}

function ts() {
  return Math.floor(Date.now() / 1000).toString();
}

async function sign(key, msg) {
  const enc = new TextEncoder();
  const k = await crypto.subtle.importKey(
    'raw', enc.encode(key),
    { name: 'HMAC', hash: 'SHA-1' },
    false, ['sign']
  );
  const s = await crypto.subtle.sign('HMAC', k, enc.encode(msg));
  const b = new Uint8Array(s);
  let r = '';
  for (let i = 0; i < b.length; i++) r += String.fromCharCode(b[i]);
  return btoa(r);
