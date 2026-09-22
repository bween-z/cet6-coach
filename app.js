/* CET-6 写作 / 翻译备考台 —— 应用逻辑
   数据保存在 localStorage，不联网、不上传。 */
(function () {
  'use strict';

  var KEY = 'cet6_coach_v1';
  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };

  /* ---------- 存储 ---------- */
  var DB = { goal: 570, examDate: '', dailyTime: '', ai: { base: '', model: '', key: '' }, records: [], deleted: [], settingsTs: 0 };

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var d = JSON.parse(raw);
        DB.goal = d.goal || 570;
        DB.examDate = d.examDate || '';
        DB.dailyTime = d.dailyTime || '';
        DB.ai = d.ai || { base: '', model: '', key: '' };
        DB.records = d.records || [];
        DB.deleted = d.deleted || [];
        DB.settingsTs = d.settingsTs || 0;
      }
    } catch (e) { console.warn('读取本地数据失败', e); }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(DB)); }
    catch (e) { toast('保存失败：本地存储空间不足'); }
  }

  /* ---------- 工具 ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  var toastTimer;
  function toast(msg) {
    var t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2000);
  }
  function fmtDate(ts) {
    var d = new Date(ts);
    var p = function (n) { return n < 10 ? '0' + n : '' + n; };
    return (d.getMonth() + 1) + '/' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  function wordCount(t) { return (t.match(/[A-Za-z][A-Za-z'-]*/g) || []).length; }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  /* 简易 markdown 渲染（够用即可） */
  function md(src) {
    var h = esc(src || '');
    h = h.replace(/^### (.*)$/gm, '<h3 style="font-size:14.5px;margin:14px 0 6px">$1</h3>');
    h = h.replace(/^## (.*)$/gm, '<h2 style="font-size:16px;margin:18px 0 6px">$1</h2>');
    h = h.replace(/^# (.*)$/gm, '<h2 style="font-size:17px;margin:18px 0 6px">$1</h2>');
    h = h.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
    h = h.replace(/`([^`]+)`/g, '<code style="background:var(--surface-2);border:1px solid var(--line);border-radius:4px;padding:1px 5px">$1</code>');
    h = h.replace(/^\|(.+)\|$/gm, function (m, row) {
      var cells = row.split('|').map(function (c) { return c.trim(); });
      return '<tr>' + cells.map(function (c) { return '<td style="border-bottom:1px solid var(--line-soft);padding:6px 8px">' + c + '</td>'; }).join('') + '</tr>';
    });
    h = h.replace(/(<tr>[\s\S]*?<\/tr>)+/g, function (m) {
      return '<table style="width:100%;border-collapse:collapse;font-size:13.5px;margin:8px 0">' + m + '</table>';
    });
    h = h.replace(/^[-*] (.*)$/gm, '<li style="margin-bottom:5px">$1</li>');
    h = h.replace(/(<li[\s\S]*?<\/li>)+/g, function (m) { return '<ul style="padding-left:18px;margin:6px 0">' + m + '</ul>'; });
    h = h.replace(/\n{2,}/g, '<br><br>').replace(/\n/g, '<br>');
    return h;
  }

  /* ---------- 结果渲染 ---------- */
  function scoreBox(r, extra) {
    return '<div class="score-box">' +
      '<div><span class="big-score">' + r.score15 + '<small> / 15</small></span>' +
      '<span class="level-tag ' + r.levelCls + '">' + r.level + '</span></div>' +
      '<div class="score-meta">' +
      '折合 710 分制约 <b>' + r.score710 + '</b> 分（本项满分 106.5）<br>' +
      '综合得分 <b>' + r.score100 + '</b> / 100' + (extra ? '<br>' + extra : '') +
      '</div></div>';
  }

  function dimBars(r) {
    return r.dims.map(function (d) {
      var pct = Math.max(0, Math.min(100, d.s));
      var cls = pct >= 80 ? 'background:var(--good)' : (pct >= 60 ? 'background:var(--warn)' : 'background:var(--bad)');
      return '<div class="dim"><div class="dim-head">' +
        '<span class="nm">' + esc(d.name) + ' <span class="wt">权重 ' + Math.round(d.w * 100) + '%</span></span>' +
        '<span class="vl">' + Math.round(d.s) + '</span></div>' +
        '<div class="bar"><i style="width:' + pct + '%;' + cls + '"></i></div>' +
        '<div class="dim-note">' + esc(d.note) + '</div></div>';
    }).join('');
  }

  function issueList(r) {
    if (!r.issues.length) return '<div class="empty">未检测到明显问题。</div>';
    return r.issues.map(function (i) {
      return '<div class="issue ' + i.level + '"><div class="t">' + i.t + '</div>' +
        (i.d ? '<div class="d">' + i.d + '</div>' : '') + '</div>';
    }).join('');
  }

  function revList(r) {
    if (!r.revisions.length) return '<div class="empty">本次未生成逐句替换建议。可启用 AI 深度批改获得完整改写。</div>';
    return r.revisions.slice(0, 12).map(function (v) {
      return '<div class="rev"><div class="o">' + esc(v.o) + '</div>' +
        '<div class="n">' + esc(v.n) + '</div>' +
        '<div class="r">' + esc(v.r) + '</div></div>';
    }).join('');
  }

  function strengthList(r) {
    if (!r.strengths.length) return '<div class="empty">暂无显著优点记录，继续练习。</div>';
    return '<ul class="plain">' + r.strengths.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul>';
  }

  function resultHTML(r) {
    var extra = r.type === 'writing'
      ? '词数 <b>' + r.wordCount + '</b> · ' + r.sentCount + ' 句 · ' + r.paraCount + ' 段'
      : '中文字数 <b>' + r.zhChars + '</b> · 译文 ' + r.wordCount + ' 词' +
        '<br><span style="color:var(--warn)">形式层得分，未含语义与漏译评估</span>';
    var limit = r.type === 'translation'
      ? '<div class="banner warn-b">本地引擎只覆盖形式层：语法、拼写、中式搭配、数字与专有名词核对。' +
        '译文的<b>语义准确性与是否漏译</b>需要语义判断，完整批改请切换到「AI 深度批改」。</div>'
      : '<div class="banner warn-b">本地引擎为规则级诊断，覆盖结构、衔接、搭配与统计特征，' +
        '不能替代对论证深度的语义评判。如需逐句润色与高分改写，请切换「AI 深度批改」。</div>';
    return '<div class="card">' +
      '<h2>批改结果</h2>' +
      '<p class="hint">' + esc(r.lengthNote || (r.type === 'translation' ? '篇幅比值 ' + r.ratio : '')) + '</p>' +
      limit +
      scoreBox(r, extra) +
      '<div class="section-title">分项评分</div>' + dimBars(r) +
      '<div class="section-title">主要优点</div>' + strengthList(r) +
      '<div class="section-title">主要问题</div>' + issueList(r) +
      '<div class="section-title">重点句修改</div>' + revList(r) +
      (r.type === 'translation' ? checkList(r) : '') +
      '</div>';
  }

  function checkList(r) {
    if (!r.units || !r.units.length) return '';
    return '<div class="section-title">漏译自查清单</div>' +
      '<p class="hint">本地引擎无法判断语义是否译对，请逐条对照自己的译文，确认每个信息点都已译出。</p>' +
      r.units.map(function (u, i) {
        return '<label class="chk"><input type="checkbox" data-i="' + i + '"><span>' + esc(u) + '</span></label>';
      }).join('');
  }

  /* ---------- 写作 ---------- */
  function runWriting(isAuto) {
    var text = $('#wText').value.trim();
    var topic = $('#wTopic').value.trim();
    if (!text) { if (!isAuto) toast('请先输入作文内容'); return; }
    if ($('#wDepth').value === 'ai') { runWritingAI(text, topic); return; }

    var r = window.CETEngine.assessWriting(text, topic);
    $('#wResult').innerHTML = resultHTML(r);
    addRecord({
      type: 'writing', title: topic || text.slice(0, 40),
      topic: topic, text: text, score15: r.score15, score710: r.score710,
      score100: r.score100, dims: r.dims, wordCount: r.wordCount,
      strengths: r.strengths, level: r.level
    });
    toast('已评分并保存到历史');
    if (!isAuto) $('#wResult').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function runWritingAI(text, topic) {
    if (!DB.ai.base || !DB.ai.key) { toast('请先在「设置」中填写接口地址与 API Key'); return; }
    var btn = $('#wRun'); btn.disabled = true; btn.textContent = 'AI 批改中…';
    var sys = '你是大学英语六级（CET-6）写作评阅专家。请严格按以下维度批改：内容切题度20%、组织结构15%、逻辑连贯性15%、语法准确性15%、词汇丰富度10%、句式多样性10%、语言自然度10%、模板痕迹5%。输出中文，使用 markdown，依次包含：1)估分（15分制，并给出折合710分制的分数）2)总体评价 3)分项评分表（维度|得分|说明）4)主要优点 5)主要问题 6)逐句重点修改（原文→改后→理由）7)高分改写版全文 8)可复用表达 9)个性化模板 10)下一步重写任务。作文分值对应：13-15优秀，11-12良好，8.5-10中等。';
    var usr = '作文题目：' + (topic || '（未提供）') + '\n\n学生作文：\n' + text;
    callAI(sys, usr).then(function (out) {
      $('#wResult').innerHTML = '<div class="card"><h2>AI 深度批改</h2>' +
        '<div class="banner">' + esc(window.CETBank.LABEL) + '</div>' +
        '<div style="font-size:14px;line-height:1.8">' + md(out) + '</div></div>';
      var r = window.CETEngine.assessWriting(text, topic);
      addRecord({
        type: 'writing', title: topic || text.slice(0, 40), topic: topic, text: text,
        score15: r.score15, score710: r.score710, score100: r.score100, dims: r.dims,
        wordCount: r.wordCount, strengths: r.strengths, level: r.level, ai: out
      });
      toast('AI 批改完成并已保存');
      $('#wResult').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }).catch(function (e) {
      $('#wResult').innerHTML = '<div class="card"><div class="issue bad"><div class="t">AI 批改失败</div>' +
        '<div class="d">' + esc(e.message || String(e)) + '</div></div></div>';
    }).then(function () { btn.disabled = false; btn.textContent = '开始批改'; });
  }

  /* ---------- 翻译 ---------- */
  function runTranslation(isAuto) {
    var zh = $('#tZh').value.trim();
    var en = $('#tEn').value.trim();
    if (!en) { if (!isAuto) toast('请先输入英文译文'); return; }
    if (!zh && !isAuto) { toast('建议同时填写中文原文，否则无法评估信息完整度'); }
    if ($('#tDepth').value === 'ai') { runTranslationAI(zh, en); return; }

    var r = window.CETEngine.assessTranslation(zh, en);
    $('#tResult').innerHTML = resultHTML(r);
    addRecord({
      type: 'translation', title: zh ? zh.slice(0, 40) : en.slice(0, 40),
      zh: zh, text: en, score15: r.score15, score710: r.score710, score100: r.score100,
      dims: r.dims, wordCount: r.wordCount, strengths: r.strengths, level: r.level
    });
    toast('已评分并保存到历史');
    if (!isAuto) $('#tResult').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function runTranslationAI(zh, en) {
    if (!DB.ai.base || !DB.ai.key) { toast('请先在「设置」中填写接口地址与 API Key'); return; }
    var btn = $('#tRun'); btn.disabled = true; btn.textContent = 'AI 批改中…';
    var sys = '你是大学英语六级（CET-6）翻译评阅专家。批改时按：信息完整度、意义准确性、语法、地道表达、术语与文化表达、信息顺序、中式英语。输出中文，使用 markdown，依次包含：1)估分（15分制并折合710分制）2)信息完整度 3)主要误译或漏译 4)中式英语问题 5)句法拆解 6)标准译文 7)高分译文 8)可复用表达 9)针对性小练习。';
    var usr = '中文原文：\n' + (zh || '（未提供）') + '\n\n学生译文：\n' + en;
    callAI(sys, usr).then(function (out) {
      $('#tResult').innerHTML = '<div class="card"><h2>AI 深度批改</h2>' +
        '<div class="banner">' + esc(window.CETBank.LABEL) + '</div>' +
        '<div style="font-size:14px;line-height:1.8">' + md(out) + '</div></div>';
      var r = window.CETEngine.assessTranslation(zh, en);
      addRecord({
        type: 'translation', title: zh ? zh.slice(0, 40) : en.slice(0, 40), zh: zh, text: en,
        score15: r.score15, score710: r.score710, score100: r.score100, dims: r.dims,
        wordCount: r.wordCount, strengths: r.strengths, level: r.level, ai: out
      });
      toast('AI 批改完成并已保存');
      $('#tResult').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }).catch(function (e) {
      $('#tResult').innerHTML = '<div class="card"><div class="issue bad"><div class="t">AI 批改失败</div>' +
        '<div class="d">' + esc(e.message || String(e)) + '</div></div></div>';
    }).then(function () { btn.disabled = false; btn.textContent = '开始批改'; });
  }

  function callAI(sys, usr) {
    var base = DB.ai.base.replace(/\/+$/, '');
    return fetch(base + '/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + DB.ai.key },
      body: JSON.stringify({
        model: DB.ai.model || 'gpt-4o-mini',
        messages: [{ role: 'system', content: sys }, { role: 'user', content: usr }],
        temperature: 0.4
      })
    }).then(function (res) {
      if (!res.ok) return res.text().then(function (t) { throw new Error('HTTP ' + res.status + '：' + t.slice(0, 200)); });
      return res.json();
    }).then(function (j) {
      var c = j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
      if (!c) throw new Error('接口未返回内容');
      return c;
    });
  }

  /* ---------- 记录 ---------- */
  function addRecord(rec) {
    rec.id = uid();
    rec.ts = Date.now();
    DB.records.unshift(rec);
    if (DB.records.length > 300) DB.records.length = 300;
    save();
    scheduleSync();
  }

  function renderHistory() {
    var list = $('#hList');
    $('#hCount').textContent = '（' + DB.records.length + ' 条）';
    if (!DB.records.length) {
      list.innerHTML = '<div class="empty">还没有记录。去「写作批改」或「翻译批改」提交一篇试试。</div>';
    } else {
      list.innerHTML = DB.records.map(function (r) {
        return '<div class="hist-item" data-id="' + r.id + '">' +
          '<div class="hs" style="color:' + (r.score15 >= 11 ? 'var(--good)' : (r.score15 >= 8.5 ? 'var(--warn)' : 'var(--bad)')) + '">' + r.score15 + '</div>' +
          '<div class="hb"><div class="ht">' + esc(r.title || '未命名') + '</div>' +
          '<div class="hm">' + (r.type === 'writing' ? '写作' : '翻译') + ' · ' + fmtDate(r.ts) +
          ' · ' + (r.wordCount || 0) + ' 词 · 折合 ' + r.score710 + ' 分</div></div>' +
          '<div class="ha"><button class="icon-btn sm" data-act="view">查看</button>' +
          '<button class="icon-btn sm" data-act="del">删除</button></div></div>';
      }).join('');
    }
    renderTrend();
  }

  function renderTrend() {
    var arr = DB.records.slice(0, 12).reverse();
    var box = $('#hTrend');
    if (arr.length < 2) { box.innerHTML = '<div class="empty">至少 2 条记录后显示趋势。</div>'; return; }
    var max = 15;
    box.innerHTML = '<div class="trend">' + arr.map(function (r) {
      return '<div class="col"><i style="height:' + Math.max(3, r.score15 / max * 88) + '%"></i>' +
        '<span>' + r.score15 + '</span></div>';
    }).join('') + '</div>' +
      '<div style="font-size:12.5px;color:var(--ink-3);text-align:center">最近 ' + arr.length + ' 次（15 分制）</div>';
  }

  function viewRecord(id) {
    var r = DB.records.filter(function (x) { return x.id === id; })[0];
    if (!r) return;
    var html = '<div class="card"><h2>' + esc(r.title || '未命名') + '</h2>' +
      '<p class="hint">' + (r.type === 'writing' ? '写作' : '翻译') + ' · ' + fmtDate(r.ts) +
      ' · ' + r.score15 + '/15 · 折合 ' + r.score710 + ' 分 · ' + (r.level || '') + '</p>';
    if (r.ai) {
      html += '<div style="font-size:14px;line-height:1.8">' + md(r.ai) + '</div>';
    } else {
      html += dimBars({ dims: r.dims });
    }
    if (r.zh) html += '<div class="section-title">中文原文</div><div style="font-size:14px;line-height:1.8">' + esc(r.zh) + '</div>';
    html += '<div class="section-title">' + (r.type === 'writing' ? '作文' : '译文') + '</div>' +
      '<div style="font-size:14px;line-height:1.8;white-space:pre-wrap">' + esc(r.text) + '</div>' +
      '<div class="row" style="margin-top:12px"><button class="btn ghost sm" onclick="this.closest(\'.card\').remove()">关闭</button></div></div>';
    var box = document.createElement('div');
    box.innerHTML = html;
    $('#hList').parentNode.insertBefore(box, $('#hList'));
    box.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ---------- 诊断 ---------- */
  function runDiagnose() {
    var box = $('#dResult');
    if (DB.records.length === 0) {
      box.innerHTML = '<div class="card"><div class="empty">还没有数据。先提交 1–2 篇作文或翻译，系统才能诊断薄弱点。</div></div>';
      return;
    }
    var d = window.CETEngine.diagnose(DB.records);
    var rec = window.CETBank.recommend(d.weak.map(function (w) { return w.key; }));

    var rankHTML = d.ranked.map(function (x, i) {
      var cls = x.avg >= 80 ? 'good' : (x.avg >= 60 ? 'warn' : 'bad');
      return '<div class="kv"><span>' + (i + 1) + '. ' + esc(x.name) +
        ' <span style="color:var(--ink-3);font-size:12px">（' + x.n + ' 次）</span></span>' +
        '<b><span class="tag ' + cls + '">' + Math.round(x.avg) + '</span></b></div>';
    }).join('');

    var weakHTML = d.weak.map(function (w) {
      var lab = window.CETEngine.DIM_LABEL[w.key] || { name: w.name, drill: '' };
      return '<div class="issue ' + (w.avg < 60 ? 'bad' : 'warn') + '">' +
        '<div class="t">' + esc(lab.name) + ' — 均分 ' + Math.round(w.avg) + '</div>' +
        '<div class="d">' + esc(lab.drill) + '</div></div>';
    }).join('');

    var wqHTML = rec.writing.map(function (q) {
      return '<div class="practice">' +
        '<div class="pl">' + esc(window.CETBank.LABEL) + '</div>' +
        '<div class="pt">' + esc(q.prompt) + '</div>' +
        '<div class="pm">' + esc(q.brief) + ' · 类型 ' + q.type + ' · 难度 ' + q.difficulty +
        ' · 建议 150–220 词</div>' +
        '<div class="row" style="margin-top:8px"><button class="btn ghost sm" data-usew="' + q.id + '">用这道题练习</button></div>' +
        '</div>';
    }).join('');

    var tqHTML = rec.translation.map(function (q) {
      return '<div class="practice">' +
        '<div class="pl">' + esc(window.CETBank.LABEL) + '</div>' +
        '<div class="zh">' + esc(q.zh) + '</div>' +
        '<div class="pm">' + esc(q.topic) + ' · 难度 ' + q.difficulty +
        ' · 重点：' + q.points.map(esc).join('、') + '</div>' +
        '<div class="row" style="margin-top:8px"><button class="btn ghost sm" data-uset="' + q.id + '">用这段练习</button></div>' +
        '</div>';
    }).join('');

    box.innerHTML =
      '<div class="card"><h2>维度画像</h2><p class="hint">基于 ' + d.sampleSize + ' 条记录，按各维度均分从低到高排列。</p>' +
      rankHTML + '</div>' +
      '<div class="card"><h2>需要优先解决的薄弱点</h2><p class="hint">针对最低的三项，下面是具体训练动作。</p>' +
      weakHTML + '</div>' +
      '<div class="card"><h2>针对性写作模拟题</h2><p class="hint">按你的薄弱维度匹配，均为原创 CET-style 仿真训练。</p>' +
      wqHTML + '</div>' +
      '<div class="card"><h2>针对性翻译模拟题</h2><p class="hint">先自己翻译，再回到「翻译批改」提交译文。</p>' +
      tqHTML + '</div>';

    $$('[data-usew]').forEach(function (b) {
      b.onclick = function () {
        var q = window.CETBank.writing.filter(function (x) { return x.id === b.dataset.usew; })[0];
        $('#wTopic').value = q.prompt;
        $('#wText').value = '';
        switchTab('writing');
        toast('已载入题目，开始写作吧');
      };
    });
    $$('[data-uset]').forEach(function (b) {
      b.onclick = function () {
        var q = window.CETBank.translation.filter(function (x) { return x.id === b.dataset.uset; })[0];
        $('#tZh').value = q.zh;
        $('#tEn').value = '';
        switchTab('translation');
        toast('已载入中文原文，请先自己翻译');
      };
    });
    box.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ---------- 导入导出 ---------- */
  function exportData() {
    var blob = new Blob([JSON.stringify(DB, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'cet6-backup-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    toast('已导出备份文件');
  }
  function importData(file) {
    var fr = new FileReader();
    fr.onload = function () {
      try {
        var d = JSON.parse(fr.result);
        if (!d || !d.records) throw new Error('文件格式不正确');
        DB = { goal: d.goal || 570, examDate: d.examDate || '', dailyTime: d.dailyTime || '', ai: d.ai || { base: '', model: '', key: '' }, records: d.records };
        save(); syncSettingsUI(); renderHistory();
        toast('已导入 ' + DB.records.length + ' 条记录');
      } catch (e) { toast('导入失败：' + e.message); }
    };
    fr.readAsText(file);
  }

  /* ---------- 云同步（GitHub Gist） ---------- */
  var syncTimer;

  function snapshot() {
    return {
      records: DB.records,
      deleted: DB.deleted,
      settings: { goal: DB.goal, examDate: DB.examDate, dailyTime: DB.dailyTime, ts: DB.settingsTs || 0 }
    };
  }

  function applySnapshot(data) {
    if (!data) return;
    if (data.records) DB.records = data.records;
    if (data.deleted) DB.deleted = data.deleted;
    if (data.settings && (data.settings.ts || 0) > (DB.settingsTs || 0)) {
      DB.goal = data.settings.goal || DB.goal;
      DB.examDate = data.settings.examDate || '';
      DB.dailyTime = data.settings.dailyTime || '';
      DB.settingsTs = data.settings.ts;
    }
    save(); syncSettingsUI(); renderHistory();
  }

  function syncAutoOn() {
    try { return localStorage.getItem('cet6_sync_auto') === '1'; } catch (e) { return false; }
  }
  function syncCfg(on) {
    try { localStorage.setItem('cet6_sync_auto', on ? '1' : '0'); } catch (e) { }
  }

  function doSync(silent) {
    if (!window.CETSync) return;
    if (!window.CETSync.ready()) { renderSyncStat(); if (!silent) toast('请先填写 token'); return; }
    if (!silent) $('#syncStat').textContent = '同步中…';
    window.CETSync.sync(snapshot()).then(function (res) {
      applySnapshot(res.data);
      renderSyncStat();
      if (!silent) toast(res.changed ? '已同步到云端' : '已是最新');
    }).catch(function (e) {
      renderSyncStat();
      if (!silent) toast('同步失败：' + e.message);
    });
  }

  function scheduleSync() {
    if (!window.CETSync || !window.CETSync.ready() || !syncAutoOn()) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(function () { doSync(true); }, 2500);
  }

  function renderSyncStat() {
    var el = $('#syncStat');
    if (!el || !window.CETSync) return;
    var on = window.CETSync.ready();
    var meta = window.CETSync.meta();
    var gzip = window.CETSync.gistId();
    var html = '<div class="kv"><span>状态</span><b style="color:' + (on ? 'var(--good)' : 'var(--muted)') + '">' +
      (on ? '已连接' : '未连接') + '</b></div>';
    if (on) {
      html += '<div class="kv"><span>云端位置</span><b>私密 Gist ' + (gzip ? gzip.slice(0, 8) + '…' : '待创建') + '</b></div>' +
        '<div class="kv"><span>上次同步</span><b>' + (meta.lastSync ? fmtDate(meta.lastSync) : '尚未同步') + '</b></div>' +
        '<div class="kv"><span>本机记录</span><b>' + DB.records.length + ' 条</b></div>';
    }
    if (window.CETSync.state.lastError) {
      html += '<div style="color:var(--bad);font-size:13px;margin-top:6px">' + esc(window.CETSync.state.lastError) + '</div>';
    }
    if (location.protocol === 'file:') {
      html += '<div style="color:var(--warn);font-size:13px;margin-top:6px">' +
        '当前是本地文件方式打开，浏览器可能拦截网络请求。云同步建议使用网址版。</div>';
    }
    el.innerHTML = html;
  }

  /* ---------- 文件读取 ---------- */
  function bindDrop(dropSel, fileSel, targetSel) {
    var drop = $(dropSel), file = $(fileSel);
    drop.onclick = function () { file.click(); };
    file.onchange = function () { if (file.files[0]) readInto(file.files[0], targetSel); };
    ['dragenter', 'dragover'].forEach(function (ev) {
      drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); });
    });
    drop.addEventListener('drop', function (e) {
      if (e.dataTransfer.files[0]) readInto(e.dataTransfer.files[0], targetSel);
    });
  }
  function readInto(f, sel) {
    var fr = new FileReader();
    fr.onload = function () {
      $(sel).value = fr.result;
      updateCount();
      toast('已读取：' + f.name + '，正在自动批改…');
      if (sel === '#wText') runWriting(true);
      else runTranslation(true);
    };
    fr.readAsText(f, 'utf-8');
  }

  function updateCount() {
    $('#wCount').textContent = '已输入 ' + wordCount($('#wText').value) + ' 词';
    $('#tCount').textContent = '已输入 ' + wordCount($('#tEn').value) + ' 词';
  }

  /* ---------- 设置 ---------- */
  function syncSettingsUI() {
    $('#sGoal').value = DB.goal;
    $('#sDate').value = DB.examDate;
    $('#sTime').value = DB.dailyTime;
    $('#sBase').value = DB.ai.base;
    $('#sModel').value = DB.ai.model;
    $('#sKey').value = DB.ai.key;
    $('#goalShown').textContent = DB.goal;
    var n = DB.records.length;
    var bytes = 0;
    try { bytes = (localStorage.getItem(KEY) || '').length; } catch (e) { }
    $('#sStat').innerHTML = '<div class="kv"><span>记录条数</span><b>' + n + '</b></div>' +
      '<div class="kv"><span>占用空间</span><b>' + (bytes / 1024).toFixed(1) + ' KB</b></div>';
  }

  function switchTab(name) {
    $$('nav.tabs button').forEach(function (b) {
      b.classList.toggle('active', b.dataset.panel === name);
    });
    $$('.panel').forEach(function (p) { p.classList.remove('active'); });
    $('#panel-' + name).classList.add('active');
    if (name === 'history') renderHistory();
    if (name === 'diagnose') runDiagnose();
    window.scrollTo(0, 0);
  }

  /* ---------- 初始化 ---------- */
  function init() {
    load();
    syncSettingsUI();

    document.addEventListener('change', function (e) {
      if (e.target.matches && e.target.matches('.chk input')) {
        e.target.closest('.chk').classList.toggle('checked', e.target.checked);
      }
    });

    $$('nav.tabs button').forEach(function (b) {
      b.onclick = function () { switchTab(b.dataset.panel); };
    });

    $('#wRun').onclick = function () { runWriting(false); };
    $('#tRun').onclick = function () { runTranslation(false); };
    $('#wClear').onclick = function () { $('#wText').value = ''; $('#wTopic').value = ''; $('#wResult').innerHTML = ''; updateCount(); };
    $('#tClear').onclick = function () { $('#tZh').value = ''; $('#tEn').value = ''; $('#tResult').innerHTML = ''; updateCount(); };
    $('#wText').addEventListener('input', updateCount);
    $('#tEn').addEventListener('input', updateCount);
    $('#tZh').addEventListener('input', updateCount);

    // 粘贴后自动批改（打字过程不打断，避免半成品刷进历史）
    var autoTimer;
    function scheduleAuto(which) {
      clearTimeout(autoTimer);
      autoTimer = setTimeout(function () {
        if (which === 'w') runWriting(true); else runTranslation(true);
      }, 1200);
    }
    $('#wText').addEventListener('paste', function () { scheduleAuto('w'); });
    $('#tEn').addEventListener('paste', function () { scheduleAuto('t'); });

    $('#tSample').onclick = function () {
      var q = window.CETBank.translation[Math.floor(Math.random() * window.CETBank.translation.length)];
      $('#tZh').value = q.zh;
      $('#tEn').value = '';
      toast('已载入一道原创翻译题（' + q.topic + '）');
    };

    bindDrop('#wDrop', '#wFile', '#wText');
    bindDrop('#tDrop', '#tFile', '#tEn');

    $('#dRun').onclick = runDiagnose;

    $('#hRefresh').onclick = renderHistory;
    $('#hExport').onclick = exportData;
    $('#hClear').onclick = function () {
      if (confirm('确定清空全部 ' + DB.records.length + ' 条记录？此操作不可恢复。')) {
        DB.records.forEach(function (r) { DB.deleted.push(r.id); });
        if (DB.deleted.length > 500) DB.deleted = DB.deleted.slice(-500);
        DB.records = []; save(); renderHistory(); syncSettingsUI(); scheduleSync(); toast('已清空');
      }
    };
    $('#hList').addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-act]');
      if (!btn) return;
      var id = btn.closest('.hist-item').dataset.id;
      if (btn.dataset.act === 'view') viewRecord(id);
      else {
        if (confirm('删除这条记录？')) {
          DB.records = DB.records.filter(function (x) { return x.id !== id; });
          DB.deleted.push(id);
          if (DB.deleted.length > 500) DB.deleted = DB.deleted.slice(-500);
          save(); renderHistory(); scheduleSync(); toast('已删除');
        }
      }
    });

    $('#sSave').onclick = function () {
      DB.goal = parseInt($('#sGoal').value, 10) || 570;
      DB.examDate = $('#sDate').value.trim();
      DB.dailyTime = $('#sTime').value.trim();
      DB.settingsTs = Date.now();
      save(); syncSettingsUI(); scheduleSync();
      $('#sTip').innerHTML = '<span style="color:var(--good)">已保存。目标 ' + DB.goal +
        ' 分：写作与翻译合计约需 ' + Math.round(DB.goal * 0.30) + ' 分，即两科各约 ' +
        (Math.round(DB.goal * 0.15 / 106.5 * 15 * 10) / 10) + '/15。</span>';
    };
    $('#sSaveAI').onclick = function () {
      DB.ai = { base: $('#sBase').value.trim(), model: $('#sModel').value.trim(), key: $('#sKey').value.trim() };
      save();
      $('#sTipAI').innerHTML = '<span style="color:var(--good)">已保存到本机。</span>';
    };
    $('#sTestAI').onclick = function () {
      DB.ai = { base: $('#sBase').value.trim(), model: $('#sModel').value.trim(), key: $('#sKey').value.trim() };
      $('#sTipAI').textContent = '测试中…';
      callAI('You reply with exactly: OK', 'ping').then(function () {
        $('#sTipAI').innerHTML = '<span style="color:var(--good)">连接成功。</span>';
      }).catch(function (e) {
        $('#sTipAI').innerHTML = '<span style="color:var(--bad)">失败：' + esc(e.message) + '</span>';
      });
    };

    $('#btnExport').onclick = exportData;
    $('#sExport').onclick = exportData;
    $('#btnImport').onclick = function () { $('#fileImport').click(); };
    $('#sImport').onclick = function () { $('#fileImport').click(); };
    $('#fileImport').onchange = function () { if (this.files[0]) importData(this.files[0]); };
    $('#sWipe').onclick = function () {
      if (confirm('将清除所有记录与设置，确定继续？')) {
        DB.records.forEach(function (r) { DB.deleted.push(r.id); });
        if (DB.deleted.length > 500) DB.deleted = DB.deleted.slice(-500);
        DB = { goal: 570, examDate: '', dailyTime: '', ai: { base: '', model: '', key: '' }, records: [], deleted: DB.deleted, settingsTs: Date.now() };
        save(); syncSettingsUI(); renderHistory(); scheduleSync(); toast('已重置');
      }
    };

    /* 云同步 */
    if (window.CETSync) {
      try { $('#syncAuto').checked = syncAutoOn(); } catch (e) { }
      $('#syncAuto').onchange = function () { syncCfg(this.checked); };
      $('#syncSave').onclick = function () {
        var t = $('#syncToken').value.trim();
        if (!t) { toast('请先粘贴 GitHub token'); return; }
        window.CETSync.setToken(t);
        syncCfg(true); $('#syncAuto').checked = true;
        doSync(false);
      };
      $('#syncNow').onclick = function () { doSync(false); };
      $('#syncOff').onclick = function () {
        if (!confirm('断开后不再同步，本机数据保留。确定？')) return;
        window.CETSync.clear(); $('#syncToken').value = '';
        renderSyncStat(); toast('已断开');
      };
      renderSyncStat();
    }

    updateCount();
    renderHistory();

    // 已配置过 token：打开网页时自动拉取云端数据
    if (window.CETSync && window.CETSync.ready()) doSync(true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
