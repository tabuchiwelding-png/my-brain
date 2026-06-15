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
    if (request.method === 'OPTIONS') return new Response(null, {
