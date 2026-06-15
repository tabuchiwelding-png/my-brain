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
      'Access-Control-Allow-Origin': FRONT_URL,
      'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    if (request.method === 'OPTIONS') return new Response(null, {headers: cors});

    if (path === '/me') {
      const apiUrl = 'https://api.twitter.com/2/users/me';
      const params = {'user.fields': 'profile_image_url,username,name'};
      const r = await oAuth1Fetch('GET', apiUrl, params);
      return new Response(await r.text(), {headers: {...cors, 'Content-Type': 'application/json'}});
    }

    if (path === '/timeline') {
      const apiUrl = `https://api.twitter.com/2/users/${MY_ID}/tweets`;
      const params = {'max_results':'20','tweet.fields':'created_at,author_id,public_metrics','expansions':'author_id','user.fields':'name,username,profile_image_url'};
      const r = await oAuth1Fetch('GET', apiUrl, params);
      return new Response(await r.text(), {headers: {...cors, 'Content-Type': 'application/json'}});
    }

    if (path === '/tweet' && request.method === 'POST') {
      const body = await request.json();
      const r = await oAuth1Fetch('POST', 'https://api.twitter.com/2/tweets', {}, JSON.stringify(body));
      return new Response(await r.text(), {headers: {...cors, 'Content-Type': 'application/json'}});
    }

    if (path === '/like' && request.method === 'POST') {
      const body = await request.json();
      const r = await oAuth1Fetch('POST', `https://api.twitter.com/2/users/${MY_ID}/likes`, {}, JSON.stringify({tweet_id: body.tweetId}));
      return new Response(await r.text(), {headers: {...cors, 'Content-Type': 'application/json'}});
    }

    if (path === '/search') {
      const q = url.searchParams.get('q') || '';
      const apiUrl = 'https://api.twitter.com/2/tweets/search/recent';
      const params = {'query':q,'max_results':'10','tweet.fields':'created_at,author_id,public_metrics','expansions':'author_id','user.fields':'name,username,profile_image_url'};
      const r = await oAuth1Fetch('GET', apiUrl, params);
      return new Response(await r.text(), {headers: {...cors, 'Content-Type': 'application/json'}});
    }

    return new Response('Not found', {status: 404});
  }
};

async function oAuth1Fetch(method, baseUrl, queryParams = {}, body = null) {
  const oauthParams = {
    oauth_consumer_key: CONSUMER_KEY,
    oauth_nonce: Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b => b.toString(16).padStart(2,'0')).join(''),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: ACCESS_TOKEN,
    oauth_version: '1.0',
  };

  const sigParams = method === 'GET' ? {...queryParams, ...oauthParams} : {...oauthParams};
  const paramStr = Object.keys(sigParams).sort()
    .map(k => `${rfc3986(k)}=${rfc3986(sigParams[k])}`)
    .join('&');

  const sigBase = `${method}&${rfc3986(baseUrl)}&${rfc3986(paramStr)}`;
  const sigKey = `${rfc3986(CONSUMER_SECRET)}&${rfc3986(ACCESS_TOKEN_SECRET)}`;
  const signature = await hmacSha1Base64(sigKey, sigBase);
  oauthParams.oauth_signature = signature;

  const authHeader = 'OAuth ' + Object.keys(oauthParams).sort()
    .map(k => `${rfc3986(k)}="${rfc3986(oauthParams[k])}"`)
    .join(', ');

  let finalUrl = baseUrl;
  if (method === 'GET' && Object.keys(queryParams).length > 0) {
    finalUrl += '?' + Object.keys(queryParams).map(k => `${rfc3986(k)}=${rfc3986(queryParams[k])}`).join('&');
  }

  const fetchOpts = {method, headers: {'Authorization': authHeader}};
  if (body) {
    fetchOpts.headers['Content-Type'] = 'application/json';
    fetchOpts.body = body;
  }

  return fetch(finalUrl, fetchOpts);
}

function rfc3986(str) {
  return encodeURIComponent(String(str))
    .replace(/!/g,'%21').replace(/'/g,'%27').replace(/\(/g,'%28')
    .replace(/\)/g,'%29').replace(/\*/g,'%2A');
}

async function hmacSha1Base64(key, message) {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw', enc.encode(key),
    {name: 'HMAC', hash: {name: 'SHA-1'}},
    false, ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(message));
  const bytes = new Uint8Array(signature);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}
