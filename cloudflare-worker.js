/* CET-6 备考台 · 自建同步后端（Cloudflare Workers，免费）
 *
 * 部署：Workers & Pages → Create Worker → 粘贴本文件 → Deploy
 * 然后：Settings → Variables → KV Namespace Bindings → 变量名 CET6_DATA，绑定一个 KV 命名空间
 *
 * 接口（同步码即共享密钥，知道码就能读写，请自己起一串不容易被猜到的）：
 *   GET  /?code=xxx   读取数据
 *   POST /?code=xxx   写入数据（body 为 JSON）
 */
export default {
  async fetch(request, env) {
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Content-Type': 'application/json'
    };

    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });

    const code = new URL(request.url).searchParams.get('code');
    if (!code) return new Response(JSON.stringify({ error: 'missing code' }), { status: 400, headers: cors });

    const key = 'cet6:' + code;

    if (request.method === 'GET') {
      const v = await env.CET6_DATA.get(key);
      return new Response(v || '{"records":[],"deleted":[],"settings":{}}', { headers: cors });
    }

    if (request.method === 'POST') {
      const body = await request.text();
      // KV 单值上限 25MB，这里限制 900KB，足够约 300 条完整批改记录
      if (body.length > 900000) {
        return new Response(JSON.stringify({ error: 'too large' }), { status: 413, headers: cors });
      }
      await env.CET6_DATA.put(key, body);
      return new Response(JSON.stringify({ ok: true, size: body.length }), { headers: cors });
    }

    return new Response(JSON.stringify({ error: 'method not allowed' }), { status: 405, headers: cors });
  }
};
