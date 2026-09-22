/* GitHub Gist 云同步 —— 让手机和电脑共用同一份历史数据
   数据存放在用户自己的「私密 Gist」里，只有持 token 的人能读写。
   token 与 gist id 保存在本机 localStorage，不会发给除 GitHub 以外的任何服务。 */
(function () {
  'use strict';

  var API = 'https://api.github.com';
  var DESC = 'cet6-coach-sync-data';
  var FILE = 'cet6-data.json';
  var TK = 'cet6_gh_token';
  var GK = 'cet6_gh_gist';
  var SK = 'cet6_sync_meta';
  var EK = 'cet6_ep_url';
  var CK = 'cet6_ep_code';

  var state = { lastSync: 0, lastError: '', busy: false };

  /* ---------- 本地凭据 ---------- */
  function getToken() { try { return localStorage.getItem(TK) || ''; } catch (e) { return ''; } }
  function setToken(t) { try { if (t) { localStorage.setItem(TK, t); } else { localStorage.removeItem(TK); } } catch (e) { } }
  function getGistId() { try { return localStorage.getItem(GK) || ''; } catch (e) { return ''; } }
  function setGistId(id) { try { if (id) { localStorage.setItem(GK, id); } else { localStorage.removeItem(GK); } } catch (e) { } }
  function getMeta() { try { return JSON.parse(localStorage.getItem(SK) || '{}'); } catch (e) { return {}; } }
  function setMeta(m) { try { localStorage.setItem(SK, JSON.stringify(m)); } catch (e) { } }

  /* 自建后端（无需 GitHub）：一个 URL + 一个自定的同步码 */
  function getEp() { try { return localStorage.getItem(EK) || ''; } catch (e) { return ''; } }
  function getCode() { try { return localStorage.getItem(CK) || ''; } catch (e) { return ''; } }
  function setEp(url, code) {
    try {
      if (url) { localStorage.setItem(EK, url); localStorage.setItem(CK, code || ''); }
      else { localStorage.removeItem(EK); localStorage.removeItem(CK); }
    } catch (e) { }
  }
  function epUrl() {
    var u = getEp(), c = getCode();
    return u + (u.indexOf('?') >= 0 ? '&' : '?') + 'code=' + encodeURIComponent(c);
  }

  /* 三种模式：自建后端 > GitHub Gist > 不同步 */
  function mode() {
    if (getEp()) return 'worker';
    if (getToken()) return 'gist';
    return 'none';
  }

  /* ---------- 网络 ---------- */
  function req(method, path, body) {
    var headers = { 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
    var tok = getToken();
    if (tok) headers['Authorization'] = 'Bearer ' + tok;
    var opt = { method: method, headers: headers, cache: 'no-store' };
    if (body) {
      headers['Content-Type'] = 'application/json';
      opt.body = JSON.stringify(body);
    }
    return fetch(API + path, opt).then(function (r) {
      return r.text().then(function (txt) {
        var j = null;
        try { j = JSON.parse(txt); } catch (e) { j = null; }
        if (!r.ok) {
          var msg = (j && j.message) || ('HTTP ' + r.status);
          if (r.status === 401) msg = 'Token 无效或已过期（401）';
          if (r.status === 403) msg = '无权限或被限流（403）：请确认 token 勾选了 gist 权限';
          var err = new Error(msg);
          err.status = r.status;
          throw err;
        }
        return j;
      });
    });
  }

  /* ---------- 定位或创建 gist ---------- */
  function ensureGist() {
    var id = getGistId();
    if (id) {
      return req('GET', '/gists/' + id).catch(function () { return findOrCreate(); });
    }
    return findOrCreate();
  }
  function blankFiles() {
    var f = {};
    f[FILE] = { content: '{"records":[],"deleted":[],"settings":{}}' };
    return f;
  }
  function findOrCreate() {
    return req('GET', '/gists?per_page=100').then(function (list) {
      var hit = null;
      (list || []).forEach(function (g) { if (g && g.description === DESC) hit = g; });
      // 列表接口不返回文件内容，必须再取一次详情，否则会误判为「云端为空」而覆盖掉已有数据
      if (hit) { setGistId(hit.id); return req('GET', '/gists/' + hit.id); }
      return req('POST', '/gists', { description: DESC, public: false, files: blankFiles() })
        .then(function (g) { setGistId(g.id); return g; });
    });
  }

  function readRemote(g) {
    var f = g && g.files && g.files[FILE];
    if (!f) return null;
    var txt = f.content;
    if (txt) {
      try { return JSON.parse(txt); } catch (e) { return null; }
    }
    // 内容被截断时回源取原始文本（secret gist 也带 Authorization）
    if (f.truncated && f.raw_url) {
      return fetch(f.raw_url, { headers: { Authorization: 'Bearer ' + getToken() }, cache: 'no-store' })
        .then(function (r) { return r.text(); })
        .then(function (t) { try { return JSON.parse(t); } catch (e) { return null; } });
    }
    return null;
  }

  /* ---------- 合并：按 id 取新，删除用墓碑 ---------- */
  function merge(local, remote) {
    remote = remote || { records: [], deleted: [] };
    var del = {};
    (local.deleted || []).forEach(function (id) { del[id] = 1; });
    (remote.deleted || []).forEach(function (id) { del[id] = 1; });

    var map = {};
    (remote.records || []).forEach(function (r) { if (r && r.id) map[r.id] = r; });
    (local.records || []).forEach(function (r) {
      if (!r || !r.id) return;
      var o = map[r.id];
      if (!o || (r.ts || 0) >= (o.ts || 0)) map[r.id] = r;
    });

    var records = Object.keys(map).map(function (k) { return map[k]; })
      .filter(function (r) { return !del[r.id]; })
      .sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); })
      .slice(0, 300);

    var ls = local.settings || {}, rs = remote.settings || {};
    var settings = ((rs.ts || 0) > (ls.ts || 0)) ? rs : ls;

    return { records: records, deleted: Object.keys(del).slice(-500), settings: settings, ts: Date.now() };
  }

  /* ---------- 读写远端（两种后端共用） ---------- */
  function remoteRead() {
    if (mode() === 'worker') {
      return fetch(epUrl(), { cache: 'no-store' }).then(function (r) {
        if (!r.ok) throw new Error('后端返回 HTTP ' + r.status);
        return r.text();
      }).then(function (t) {
        try { return JSON.parse(t); } catch (e) { return null; }
      }).catch(function (e) { throw new Error('读取后端失败：' + e.message); });
    }
    return ensureGist().then(function (g) { return Promise.resolve(readRemote(g)); });
  }

  function remoteWrite(merged) {
    if (mode() === 'worker') {
      return fetch(epUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(merged)
      }).then(function (r) {
        if (!r.ok) throw new Error('后端返回 HTTP ' + r.status);
        return true;
      });
    }
    return ensureGist().then(function (g) {
      var files = {};
      files[FILE] = { content: JSON.stringify(merged) };
      return req('PATCH', '/gists/' + g.id, { files: files });
    });
  }

  /* ---------- 同步一次 ---------- */
  function sync(snapshot) {
    if (mode() === 'none') {
      state.lastError = '未配置同步方式';
      return Promise.reject(new Error('请先配置 GitHub token 或自建后端'));
    }
    var tag = mode() === 'worker' ? getEp() : (getGistId() || '待创建');
    state.busy = true;
    return Promise.resolve(remoteRead()).then(function (remoteRaw) {
      var remote = remoteRaw || { records: [], deleted: [] };
      var merged = merge(snapshot, remote);
      var same = JSON.stringify(merged) === JSON.stringify(remote);
      if (same) {
        state.busy = false; state.lastSync = Date.now(); state.lastError = '';
        setMeta({ lastSync: state.lastSync, target: tag, mode: mode() });
        return { changed: false, data: merged, gist: tag };
      }
      return remoteWrite(merged).then(function () {
        state.busy = false; state.lastSync = Date.now(); state.lastError = '';
        setMeta({ lastSync: state.lastSync, target: tag, mode: mode() });
        return { changed: true, data: merged, gist: tag };
      });
    }).catch(function (e) {
      state.busy = false; state.lastError = e.message;
      throw e;
    });
  }

  function clear() {
    setToken(''); setGistId(''); setEp(''); setMeta({});
    state.lastSync = 0; state.lastError = '';
  }
  function clearEp() { setEp(''); setMeta({}); state.lastSync = 0; state.lastError = ''; }
  function clearGist() { setToken(''); setGistId(''); setMeta({}); state.lastSync = 0; state.lastError = ''; }

  window.CETSync = {
    ready: function () { return mode() !== 'none'; },
    mode: mode,
    token: getToken,
    setToken: setToken,
    gistId: getGistId,
    ep: getEp,
    code: getCode,
    setEp: setEp,
    meta: getMeta,
    state: state,
    sync: sync,
    merge: merge,
    clear: clear,
    clearEp: clearEp,
    clearGist: clearGist,
    FILE: FILE
  };
})();
