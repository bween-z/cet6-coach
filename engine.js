/* CET-6 写作 / 翻译 评分引擎
   规则与评分维度遵循 cet-skill 的 rubric：
   写作 = 内容切题 20% + 结构 15% + 连贯 15% + 语法 15% + 词汇 10% + 句式 10% + 自然度 10% + 模板痕迹 5%
   翻译 = 信息完整 / 准确性 / 语法 / 自然度 / 术语 / 语序
   说明：本地引擎为规则诊断，不联网、不调用大模型。 */
(function (global) {
  'use strict';

  /* ============ 词表 ============ */

  // 逻辑连接与衔接标记（连贯性）
  var CONNECTIVES = ['however', 'moreover', 'furthermore', 'therefore', 'thus', 'consequently',
    'nevertheless', 'whereas', 'although', 'though', 'while', 'in addition', 'additionally',
    'for instance', 'for example', 'in contrast', 'by contrast', 'on the contrary', 'as a result',
    'in other words', 'that is', 'meanwhile', 'similarly', 'likewise', 'in particular',
    'to begin with', 'first and foremost', 'firstly', 'secondly', 'finally', 'ultimately',
    'in conclusion', 'to sum up', 'overall', 'despite', 'in spite of', 'because of', 'due to',
    'thanks to', 'in this case', 'as a consequence', 'on the one hand', 'on the other hand',
    'what is more', 'besides', 'namely', 'in fact', 'indeed', 'rather than', 'instead of',
    // 隐性 / 高阶衔接手段
    'that said', 'even so', 'all the same', 'at the same time', 'admittedly', 'granted',
    'hence', 'accordingly', 'as such', 'in turn', 'after all', 'in effect', 'in practice',
    'to be sure', 'to this end', 'above all', 'more importantly', 'conversely', 'alternatively',
    'put simply', 'not surprisingly', 'of course', 'in this sense', 'by the same token'];

  // 学术 / 进阶词汇（词汇丰富度，六级取向）
  var ADVANCED = ['significant', 'substantial', 'considerable', 'inevitable', 'profound',
    'crucial', 'essential', 'vital', 'inevitably', 'remarkable', 'dramatic', 'gradual',
    'undermine', 'facilitate', 'foster', 'cultivate', 'enhance', 'diminish', 'exacerbate',
    'alleviate', 'mitigate', 'restrict', 'promote', 'stimulate', 'hinder', 'sustain',
    'accelerate', 'generate', 'transform', 'reshape', 'integrate', 'prioritize', 'emphasize',
    'acknowledge', 'demonstrate', 'indicate', 'reveal', 'suggest', 'illustrate', 'argue',
    'maintain', 'perceive', 'interpret', 'assess', 'evaluate', 'implement', 'adopt',
    'phenomenon', 'perspective', 'dimension', 'implication', 'consequence', 'factor',
    'attribute', 'challenge', 'opportunity', 'tendency', 'capacity', 'efficiency',
    'sustainability', 'equality', 'equity', 'innovation', 'initiative', 'institution',
    'mechanism', 'framework', 'strategy', 'approach', 'measure', 'policy', 'awareness',
    'responsibility', 'well-being', 'autonomy', 'resilience', 'adaptability', 'literacy',
    'nevertheless', 'consequently', 'furthermore', 'moreover', 'whereas', 'thereby',
    'widespread', 'prevalent', 'inefficient', 'ineffective', 'controversial', 'debatable',
    'beneficial', 'detrimental', 'adverse', 'favorable', 'feasible', 'accessible',
    'inexpensive', 'affordable', 'reliable', 'flexible', 'diverse', 'various', 'numerous',
    'contemporary', 'conventional', 'traditional', 'emerging', 'potential', 'fundamental'];

  // 常见中式英语 / 搭配错误
  var CHINGLISH = [
    { re: /learn\s+(?:more\s+)?knowledge/i, t: 'learn knowledge', f: 'acquire / gain knowledge', d: 'knowledge 不与 learn 搭配。' },
    { re: /open\s+(?:the\s+)?(?:light|lights|tv|television|radio)/i, t: 'open the light', f: 'turn on the light', d: '“开灯”是 turn on，不是 open。' },
    { re: /improve\s+the\s+level/i, t: 'improve the level', f: 'raise standards / improve quality', d: 'level 不与 improve 搭配。' },
    { re: /make\s+\w+\s+to\s+\w+/i, t: 'make sb to do', f: 'make sb do', d: 'make 后接不带 to 的不定式。' },
    { re: /according\s+to\s+(?:my|his|her|their)\s+(?:opinion|view)/i, t: 'according to my opinion', f: 'in my opinion', d: 'according to 后不接 my opinion。' },
    { re: /the\s+reason\s+(?:is|was)\s+because/i, t: 'the reason is because', f: 'the reason is that', d: 'reason 与 because 语义重复。' },
    { re: /more\s+better|more\s+easier|most\s+best/i, t: 'more better', f: 'better', d: '双重比较级。' },
    { re: /can\s+be\s+able\s+to|could\s+be\s+able\s+to/i, t: 'can be able to', f: 'can / be able to', d: '语义重复，二选一。' },
    { re: /there\s+(?:are|is)\s+\w+\s+people\s+(?:think|believe|argue)/i, t: 'there are people think', f: 'some people think / there are people who think', d: 'there be 后不能直接跟谓语动词。' },
    { re: /contact\s+with/i, t: 'contact with', f: 'contact（及物）', d: 'contact 作动词时直接接宾语。' },
    { re: /very\s+like\s+\w+/i, t: 'very like sth', f: 'like sth very much', d: 'like 是动词，不用 very 修饰。' },
    { re: /\bpay\s+attention\s+on\b/i, t: 'pay attention on', f: 'pay attention to', d: '固定搭配是 to。' },
    { re: /\bin\s+the\s+society\b/i, t: 'in the society', f: 'in society', d: 'society 表泛指时无冠词。' },
    { re: /\bwith\s+the\s+development\s+of\s+(?:the\s+)?(?:society|science|technology|economy)/i, t: 'with the development of society', f: 'As society evolves / As technology advances', d: '高度模板化开头，阅卷易被视为套话。' },
    { re: /\bevery\s+coin\s+has\s+two\s+sides\b/i, t: 'every coin has two sides', f: 'there are trade-offs / it has both merits and drawbacks', d: '已被过度使用的陈词。' },
    { re: /\bas\s+we\s+all\s+know\b|\bas\s+is\s+known\s+to\s+all\b/i, t: 'as we all know', f: '删去，直接陈述观点', d: '模板痕迹重，不承载信息。' },
    { re: /\bin\s+a\s+word\b|\ball\s+in\s+all\b|\bin\s+short\b/i, t: 'in a word / all in all', f: 'Overall / In conclusion', d: '略显陈旧，可替换为更自然的收束语。' },
    { re: /\bI\s+think\s+(?:that\s+)?/i, t: 'I think（高频）', f: 'I would argue / From my perspective', d: 'I think 反复出现会显得表达单薄。' },
    { re: /\bmore\s+and\s+more\s+\w+/i, t: 'more and more + 名词', f: 'an increasing number of / a growing amount of', d: 'more and more 在六级作文中使用过密会拉低词汇分。' },
    { re: /\bvery\s+important\b/i, t: 'very important', f: 'crucial / essential / vital', d: '可用更精确的词替代。' },
    { re: /\bgood\s+(?:for|to)\s+(?:our|the)\s+health\b/i, t: 'good for our health', f: 'beneficial to health', d: '表达可以更有层次。' },
    { re: /\bbroaden\s+(?:my|our|their)\s+eyes\b/i, t: 'broaden my eyes', f: 'broaden my horizons', d: '中式直译，英语习惯用 horizons。' },
    { re: /\bimprove\s+(?:my|our|their)\s+ability\s+of\b/i, t: 'improve ability of', f: 'improve the ability to do / enhance competence in', d: 'ability 后接 to do 或 in。' }
  ];

  // 模板 / 套话痕迹
  var CLICHE = [
    { re: /\bwith\s+the\s+development\s+of\b/i, t: 'with the development of…' },
    { re: /\bas\s+we\s+all\s+know\b/i, t: 'as we all know' },
    { re: /\bevery\s+coin\s+has\s+two\s+sides\b/i, t: 'every coin has two sides' },
    { re: /\bfirst(?:ly)?[,.]\s*\w+\s+.{0,80}second(?:ly)?[,.]/i, t: 'Firstly…Secondly… 机械三段' },
    { re: /\bin\s+a\s+word\b/i, t: 'in a word' },
    { re: /\blast\s+but\s+not\s+least\b/i, t: 'last but not least' },
    { re: /\bno\s+pains,?\s+no\s+gains\b/i, t: 'no pains no gains' },
    { re: /\bwhere\s+there\s+is\s+a\s+will/i, t: 'where there is a will…' },
    { re: /\bto\s+sum\s+up\b|\bin\s+conclusion\b|\ball\s+in\s+all\b/i, t: '程式化结尾' },
    { re: /\bthere\s+is\s+no\s+doubt\s+that\b/i, t: 'there is no doubt that' },
    { re: /\bit\s+is\s+well[- ]known\s+that\b/i, t: 'it is well-known that' },
    { re: /\bplays?\s+an?\s+important\s+role\s+in\b/i, t: 'play an important role in' }
  ];

  // 常见拼写错误
  var TYPOS = [
    ['recieve', 'receive'], ['seperate', 'separate'], ['occured', 'occurred'],
    ['definately', 'definitely'], ['accomodate', 'accommodate'], ['begining', 'beginning'],
    ['beleive', 'believe'], ['calender', 'calendar'], ['cemetary', 'cemetery'],
    ['concious', 'conscious'], ['enviroment', 'environment'], ['existance', 'existence'],
    ['foriegn', 'foreign'], ['goverment', 'government'], ['independant', 'independent'],
    ['neccessary', 'necessary'], ['occassion', 'occasion'], ['persistant', 'persistent'],
    ['publically', 'publicly'], ['recomend', 'recommend'], ['succesful', 'successful'],
    ['tommorow', 'tomorrow'], ['untill', 'until'], ['writting', 'writing'],
    ['benifit', 'benefit'], ['developement', 'development'], ['importent', 'important'],
    ['societyal', 'social'], ['nowdays', 'nowadays'], ['alot', 'a lot'],
    ['althrough', 'although'], ['eventhough', 'even though'], ['inspite', 'in spite']
  ];

  // 六级常考专有名词（翻译术语检测）
  var TERMS = [
    { zh: '丝绸之路', en: ['silk road'] },
    { zh: '京剧', en: ['peking opera', 'beijing opera'] },
    { zh: '故宫', en: ['forbidden city', 'palace museum'] },
    { zh: '长城', en: ['great wall'] },
    { zh: '端午节', en: ['dragon boat festival'] },
    { zh: '中秋节', en: ['mid-autumn festival'] },
    { zh: '春节', en: ['spring festival', 'chinese new year'] },
    { zh: '太极拳', en: ['tai chi'] },
    { zh: '孔子', en: ['confucius'] },
    { zh: '儒家', en: ['confucian'] },
    { zh: '书法', en: ['calligraphy'] },
    { zh: '瓷器', en: ['porcelain', 'china'] },
    { zh: '中医药', en: ['traditional chinese medicine'] },
    { zh: '高铁', en: ['high-speed rail', 'high-speed railway'] },
    { zh: '移动支付', en: ['mobile payment'] },
    { zh: '电子商务', en: ['e-commerce', 'electronic commerce'] },
    { zh: '人工智能', en: ['artificial intelligence'] },
    { zh: '碳中和', en: ['carbon neutrality', 'carbon neutral'] },
    { zh: '生态文明', en: ['ecological civilization'] },
    { zh: '可持续发展', en: ['sustainable development'] },
    { zh: '乡村振兴', en: ['rural revitalization'] },
    { zh: '共同富裕', en: ['common prosperity'] },
    { zh: '数字经济', en: ['digital economy'] },
    { zh: '智慧城市', en: ['smart city'] },
    { zh: '社会保障', en: ['social security'] },
    { zh: '基础设施', en: ['infrastructure'] },
    { zh: '一带一路', en: ['belt and road'] },
    { zh: '改革开放', en: ['reform and opening-up'] },
    { zh: '小康社会', en: ['moderately prosperous society'] },
    { zh: '非物质文化遗产', en: ['intangible cultural heritage'] }
  ];

  /* ============ 基础工具 ============ */

  function clean(t) { return (t || '').replace(/\r/g, ''); }

  function words(t) {
    return (clean(t).match(/[A-Za-z][A-Za-z'-]*/g) || []);
  }

  function sentences(t) {
    var s = clean(t).replace(/([.!?])\s+(?=[A-Z"'])/g, '$1\u0001')
      .split('\u0001')
      .map(function (x) { return x.trim(); })
      .filter(function (x) { return x.length > 1; });
    return s;
  }

  function paragraphs(t) {
    return clean(t).split(/\n\s*\n|\n/).map(function (x) { return x.trim(); })
      .filter(function (x) { return x.length > 0; });
  }

  function lowerSet(arr) {
    var s = {};
    arr.forEach(function (w) { s[w.toLowerCase()] = 1; });
    return s;
  }

  // 主谓一致：覆盖代词与名词主语（如 This method reduce / the government put）
  var BASE_V = 'put|use|make|take|think|want|need|say|do|have|know|like|work|play|study|give|see|come|look|feel|become|show|leave|bring|keep|begin|seem|help|talk|turn|start|find|reduce|improve|increase|provide|allow|require|change|develop|create|offer|carry|build|grow|hold|pay|send|spend|stand|reach|remain|appear|include|involve|produce|support|affect|depend|vary|tend|seek|mean|lead|cause|face|meet|save|cost|run|move|open|close|stop|stay|finish|complete|explain|describe|compare|consider|expect|decide|choose|avoid|prevent|protect|encourage|enable|ensure|reflect|reveal|suggest';

  function detectSVA(text) {
    var out = [];
    var re = new RegExp('\\b(?:this|that|it|the|a|an|our|their|its|his|her|my)\\s+([a-z]{3,})\\s+(' + BASE_V + ')\\b', 'gi');
    var m;
    while ((m = re.exec(text))) {
      var noun = m[1].toLowerCase();
      // 排除明显复数名词，但保留 process / class / business 等以 s 结尾的单数
      if (/[^s]s$/.test(noun) && !/(ss|us|is|sis|ness)$/.test(noun)) continue;
      out.push(m[0]);
    }
    return out;
  }

  function countHits(text, list) {
    var low = clean(text).toLowerCase(), n = 0, hits = [];
    list.forEach(function (p) {
      var re = new RegExp('\\b' + p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'g');
      var m = low.match(re);
      if (m) { n += m.length; hits.push(p); }
    });
    return { count: n, hits: hits };
  }

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function round1(v) { return Math.round(v * 10) / 10; }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ============ 写作评分 ============ */

  function assessWriting(text, topic) {
    var raw = clean(text);
    var ws = words(raw);
    var wc = ws.length;
    var sens = sentences(raw);
    var sc = sens.length;
    var paras = paragraphs(raw);
    var pc = paras.length;
    var lowRaw = raw.toLowerCase();

    var issues = [];   // {level:'bad'|'warn'|'good', t, d}
    var revs = [];     // {o,n,r}
    var strengths = [];

    /* --- 篇幅 --- */
    var lenScore, lenNote;
    if (wc === 0) { lenScore = 0; lenNote = '未检测到文本。'; }
    else if (wc < 150) { lenScore = 45; lenNote = wc + ' 词，低于六级建议的 150–220 词，内容展开不足。'; }
    else if (wc < 170) { lenScore = 72; lenNote = wc + ' 词，略低于六级建议下限，可再展开一层论证。'; }
    else if (wc <= 220) { lenScore = 100; lenNote = wc + ' 词，处在六级建议的 150–220 词区间。'; }
    else if (wc <= 260) { lenScore = 88; lenNote = wc + ' 词，略超建议区间，注意是否有冗余。'; }
    else { lenScore = 72; lenNote = wc + ' 词，明显超长，六级作文更看重密度而非篇幅。'; }

    /* --- 内容切题度（20%） --- */
    var contentScore, contentNote;
    if (topic && topic.trim()) {
      var kw = words(topic).filter(function (w) { return w.length > 3; });
      var uniq = {};
      kw.forEach(function (w) { uniq[w.toLowerCase()] = 1; });
      var kwList = Object.keys(uniq);
      var wset = lowerSet(ws);
      var hit = kwList.filter(function (k) { return wset[k]; });
      var rate = kwList.length ? hit.length / kwList.length : 0;
      contentScore = clamp(40 + rate * 70, 30, 100);
      contentNote = '题目关键词命中 ' + hit.length + '/' + kwList.length +
        '。切题度依赖你对题目核心词的实际回应，请确认每个关键词都在文中被正面讨论。';
      issues.push({
        level: rate >= .6 ? 'good' : 'warn', t: '题目关键词覆盖 ' + hit.length + '/' + kwList.length,
        d: kwList.length ? ('已覆盖：' + esc(hit.join('、')) + '。未直接出现：' +
          esc(kwList.filter(function (k) { return hit.indexOf(k) < 0; }).join('、'))) : '未识别到题目关键词。'
      });
    } else {
      contentScore = 70;
      contentNote = '未填写题目，无法做关键词切题检测。建议填入题目以获得更准确的切题度评分。';
      issues.push({
        level: 'warn', t: '未提供题目关键词',
        d: '在上方“题目/关键词”中填入作文题，系统会检测核心词是否被正面回应。'
      });
    }
    if (wc > 0 && wc < 150) contentScore = clamp(contentScore - 12, 20, 100);

    /* --- 组织结构（15%） --- */
    var orgScore, orgNote;
    if (pc === 1) { orgScore = 52; orgNote = '只有 1 段。六级作文建议 3–4 段：引入+立场、论证、收束。'; }
    else if (pc === 2) { orgScore = 70; orgNote = '共 2 段。建议拆成引入 / 论证 / 结论三段。'; }
    else if (pc === 3) { orgScore = 95; orgNote = '共 3 段，符合六级常见的引入–论证–收束结构。'; }
    else if (pc === 4) { orgScore = 100; orgNote = '共 4 段，层次清晰，注意段间逻辑递进。'; }
    else { orgScore = 78; orgNote = '共 ' + pc + ' 段，段落偏多，注意每段是否有独立且完整的分论点。'; }
    issues.push({ level: pc >= 3 ? 'good' : 'warn', t: '段落结构：' + pc + ' 段', d: orgNote });

    /* --- 逻辑连贯（15%） --- */
    var conn = countHits(raw, CONNECTIVES);
    var connDensity = sc ? conn.count / sc : 0;
    var cohScore, cohNote;
    if (conn.count === 0) { cohScore = 40; cohNote = '未检测到逻辑连接词，句间关系依赖读者推断。'; }
    else if (connDensity < .25) { cohScore = 66; cohNote = '连接词 ' + conn.count + ' 处，密度偏低，可适当增加转折与因果标记。'; }
    else if (connDensity <= .75) { cohScore = 100; cohNote = '连接词 ' + conn.count + ' 处，密度合理，逻辑关系有显式标记。'; }
    else { cohScore = 74; cohNote = '连接词 ' + conn.count + ' 处，密度偏高，可能显得机械，可改用语义衔接。'; }
    if (conn.hits.length) {
      issues.push({ level: 'good', t: '已使用衔接手段', d: conn.hits.slice(0, 8).join('、') });
    } else {
      issues.push({
        level: 'warn', t: '缺少显式衔接词',
        d: '建议在转折处用 however / nevertheless，因果处用 therefore / as a result，举例处用 for instance。'
      });
    }
    // 代词指代
    var pronouns = (raw.match(/\b(it|this|that|these|those|they)\b/gi) || []).length;
    if (sc && pronouns / sc > 1.2) {
      issues.push({
        level: 'warn', t: '指示代词偏密（' + pronouns + ' 处）',
        d: 'it / this / that 出现频繁，注意指代对象是否明确，避免读者无法判断所指。'
      });
      cohScore = clamp(cohScore - 8, 20, 100);
    }

    /* --- 语法准确性（15%） --- */
    var gProblems = [];
    // 中文标点
    var cnPunct = raw.match(/[，。；？！、：（）《》""'']/g);
    if (cnPunct && cnPunct.length) {
      gProblems.push({ t: '混用中文标点（' + cnPunct.length + ' 处）', d: '英文写作请统一使用半角标点，这是最容易被扣印象分的问题。', fix: '替换为 , . ; ? !' });
    }
    // a/an
    var anErr = raw.match(/\ba\s+[aeiouAEIOU]\w+/g);
    if (anErr && anErr.length) {
      gProblems.push({ t: '冠词 a/an 可能误用', d: '检测到 ' + anErr.slice(0, 3).join('、') + '，元音音素前应用 an。', fix: 'a university / an hour 需按发音判断' });
    }
    var aErr = raw.match(/\ban\s+[bcdfgjklmnpqrstvwxyzBCDFGJKLMNPQRSTVWXYZ]\w+/g);
    if (aErr && aErr.length) {
      gProblems.push({ t: '冠词 an 后接辅音', d: '检测到 ' + aErr.slice(0, 3).join('、') + '，辅音音素前应用 a。', fix: '' });
    }
    // 主谓一致（第三人称单数，含名词主语）
    var sva = detectSVA(raw);
    if (sva && sva.length) {
      gProblems.push({
        t: '疑似主谓一致问题（' + sva.length + ' 处）', d: '检测到 ' + sva.slice(0, 3).join('、') +
          '。第三人称单数的一般现在时动词需加 -s/-es。', fix: 'he goes / she thinks / it makes'
      });
    }
    // 重复词
    var dup = raw.match(/\b(\w+)\s+\1\b/gi);
    if (dup && dup.length) {
      gProblems.push({ t: '相邻重复词（' + dup.length + ' 处）', d: '检测到 ' + dup.slice(0, 3).join('、') + '，多为笔误。', fix: '' });
    }
    // 拼写
    var typoList = [];
    TYPOS.forEach(function (p) {
      var re = new RegExp('\\b' + p[0] + '\\b', 'gi');
      if (re.test(raw)) typoList.push(p);
    });
    if (typoList.length) {
      gProblems.push({
        t: '疑似拼写错误（' + typoList.length + ' 处）',
        d: typoList.map(function (p) { return p[0] + ' → ' + p[1]; }).join('；'), fix: ''
      });
      typoList.forEach(function (p) {
        var m = raw.match(new RegExp('[^.!?]{0,60}\\b' + p[0] + '\\b[^.!?]{0,60}', 'i'));
        if (m) revs.push({ o: m[0].trim(), n: m[0].trim().replace(new RegExp('\\b' + p[0] + '\\b', 'i'), p[1]), r: '拼写修正：' + p[0] + ' → ' + p[1] });
      });
    }
    // 长句与短句
    var longS = sens.filter(function (s) { return words(s).length > 40; }).length;
    var shortS = sens.filter(function (s) { return words(s).length < 8; }).length;
    if (longS > 0) gProblems.push({ t: '超长句 ' + longS + ' 句', d: '超过 40 词的句子容易失控，建议拆成两句或改用分号/从句分层。', fix: '' });
    if (sc >= 5 && shortS / sc > .45) {
      gProblems.push({ t: '短句占比偏高（' + shortS + '/' + sc + '）', d: '大量短句会让文章显得破碎，六级作文建议适当使用从句合并信息。', fix: '' });
    }
    // 句末标点
    var noEnd = sens.filter(function (s) { return !/[.!?]["')]?$/.test(s); }).length;
    if (noEnd > 0) gProblems.push({ t: '句末缺标点（' + noEnd + ' 处）', d: '每个句子需以句号、问号或感叹号结束。', fix: '' });

    var gramScore = clamp(100 - gProblems.length * 13, 25, 100);
    var gramNote = gProblems.length ? '检测到 ' + gProblems.length + ' 类语法/形式问题。' : '未检测到明显的语法形式问题（本地检测为规则级，不能替代人工精批）。';
    gProblems.forEach(function (p) {
      issues.push({ level: 'bad', t: p.t, d: p.d + (p.fix ? ' 建议：<code>' + p.fix + '</code>' : '') });
    });

    /* --- 词汇丰富度（10%） --- */
    var adv = countHits(raw, ADVANCED);
    var uniqWords = {};
    ws.forEach(function (w) { uniqWords[w.toLowerCase()] = 1; });
    var uniqCount = Object.keys(uniqWords).length;
    var ttr = wc ? uniqCount / wc : 0;
    // Guiraud 指数 = 类符数 / √形符数：对文本长度不敏感，避免短文本 TTR 天然偏高导致虚高
    var guiraud = wc > 0 ? uniqCount / Math.sqrt(wc) : 0;
    var advRate = wc ? adv.count / wc : 0;
    var vocabScore = clamp(20 + (guiraud - 4.2) * 14
      + Math.min(advRate * 100, 1) * 35
      + Math.min(adv.hits.length, 15) * 1.8, 25, 100);
    var vocabNote = '词汇密度指数 ' + guiraud.toFixed(2) + '（类符 ' + uniqCount + ' / 形符 ' + wc +
      '），进阶词汇命中 ' + adv.hits.length + ' 个（' + adv.count +
      ' 次）。六级作文建议在准确前提下使用更精确的词，而非堆砌难词。';
    if (adv.hits.length >= 8) {
      issues.push({ level: 'good', t: '进阶词汇使用 ' + adv.hits.length + ' 个', d: adv.hits.slice(0, 10).join('、') });
      strengths.push('已能调用一定数量的进阶词汇：' + adv.hits.slice(0, 6).join('、'));
    } else {
      issues.push({
        level: 'warn', t: '进阶词汇偏少（' + adv.hits.length + ' 个）',
        d: '可替换部分高频词：important→crucial/vital，many→numerous/a host of，change→transform/reshape，bad→detrimental/adverse。'
      });
    }

    /* --- 句式多样性（10%） --- */
    var lens = sens.map(function (s) { return words(s).length; }).filter(function (n) { return n > 0; });
    var avg = lens.length ? lens.reduce(function (a, b) { return a + b; }, 0) / lens.length : 0;
    var varr = lens.length ? Math.sqrt(lens.reduce(function (a, n) { return a + (n - avg) * (n - avg); }, 0) / lens.length) : 0;
    var subMark = (raw.match(/\b(which|that|although|though|because|since|while|whereas|if|when|unless|provided|given that|in that|so that|even if|as if)\b/gi) || []).length;
    var partMark = (raw.match(/[a-z]+ing\b/gi) || []).length;
    var senScore = clamp(30 + varr * 7 + Math.min(subMark, 15) * 2.6 + Math.min(partMark, 8) * 1.5, 25, 100);
    var senNote = '平均句长 ' + avg.toFixed(1) + ' 词，句长标准差 ' + varr.toFixed(1) +
      '，从句标记 ' + subMark + ' 处。六级理想的句长应有明显起伏，长句承载论证、短句强调结论。';
    if (varr < 4 && lens.length > 4) {
      issues.push({ level: 'warn', t: '句长变化不足（标准差 ' + varr.toFixed(1) + '）', d: '所有句子长度接近，读起来缺乏节奏。尝试把两句合并为含从句的复合句。' });
    } else if (varr >= 6) {
      issues.push({ level: 'good', t: '句长有起伏（标准差 ' + varr.toFixed(1) + '）', d: '长短句交替，节奏感较好。' });
      strengths.push('句长控制有起伏，具备节奏意识');
    }

    /* --- 语言自然度（10%） --- */
    var ching = [];
    CHINGLISH.forEach(function (c) {
      if (c.re.test(raw)) ching.push(c);
    });
    var natScore = clamp(100 - ching.length * 17, 30, 100);
    var natNote = ching.length ? '检测到 ' + ching.length + ' 处中式英语或搭配问题。' : '未命中常见中式搭配库，表达整体通顺。';
    ching.forEach(function (c) {
      issues.push({ level: 'bad', t: '中式英语：<code>' + c.t + '</code>', d: c.d + ' 建议改为 <span class="fix">' + c.f + '</span>' });
      var m = raw.match(new RegExp('[^.!?]{0,70}' + c.re.source + '[^.!?]{0,70}', 'i'));
      if (m) revs.push({ o: m[0].trim(), n: '（替换 ' + c.t + ' → ' + c.f + ' 后通读）', r: c.d });
    });
    if (!ching.length) strengths.push('未命中常见中式搭配，语言相对自然');

    /* --- 模板痕迹（5%） --- */
    var clicheHits = [];
    CLICHE.forEach(function (c) { if (c.re.test(raw)) clicheHits.push(c.t); });
    var tplScore = clamp(100 - clicheHits.length * 22, 20, 100);
    var tplNote = clicheHits.length ? '检测到 ' + clicheHits.length + ' 处模板化表达：' + clicheHits.join('、') + '。六级高分作文更看重针对性论证。'
      : '未检测到明显模板套话。';
    if (clicheHits.length) {
      issues.push({ level: 'warn', t: '模板痕迹 ' + clicheHits.length + ' 处', d: clicheHits.join('、') + ' —— 建议换成针对本题的具体表述。' });
    } else {
      issues.push({ level: 'good', t: '无明显模板套话', d: '表达有针对性，未使用通用开头/结尾。' });
    }

    /* --- 加权 --- */
    var dims = [
      { key: 'content', name: '内容切题度', w: .20, s: contentScore, note: contentNote },
      { key: 'organization', name: '组织结构', w: .15, s: orgScore, note: orgNote },
      { key: 'coherence', name: '逻辑连贯性', w: .15, s: cohScore, note: cohNote },
      { key: 'grammar', name: '语法准确性', w: .15, s: gramScore, note: gramNote },
      { key: 'vocab', name: '词汇丰富度', w: .10, s: vocabScore, note: vocabNote },
      { key: 'sentence', name: '句式多样性', w: .10, s: senScore, note: senNote },
      { key: 'naturalness', name: '语言自然度', w: .10, s: natScore, note: natNote },
      { key: 'template', name: '模板痕迹', w: .05, s: tplScore, note: tplNote }
    ];
    var total = dims.reduce(function (a, d) { return a + d.s * d.w; }, 0);
    // 篇幅作为硬性修正项
    total = total * (0.72 + 0.28 * (lenScore / 100));
    // 极短文本须趋近 0 分，否则空输入也会拿到基础分
    if (wc < 30) total = total * (wc / 30);
    if (wc === 0) {
      issues.unshift({
        level: 'bad', t: '未检测到英文文本',
        d: '请粘贴或输入英文作文后再批改。系统未识别到任何英文单词。'
      });
    }

    var score15 = round1(clamp(total / 100 * 15, 0, 15));
    var score710 = Math.round(total / 100 * 106.5); // 写作占 710 分的 15%

    var level, levelCls;
    if (score15 >= 13) { level = '优秀'; levelCls = 'good'; }
    else if (score15 >= 11) { level = '良好'; levelCls = 'good'; }
    else if (score15 >= 8.5) { level = '中等'; levelCls = 'warn'; }
    else if (score15 >= 5) { level = '及格边缘'; levelCls = 'warn'; }
    else { level = '需加强'; levelCls = 'bad'; }

    return {
      type: 'writing',
      score15: score15, score100: Math.round(total), score710: score710,
      level: level, levelCls: levelCls,
      wordCount: wc, sentCount: sc, paraCount: pc,
      dims: dims, issues: issues, revisions: revs, strengths: strengths,
      lengthNote: lenNote,
      polished: null // 本地引擎不做全文改写，交由 AI 通道或模板化建议
    };
  }

  /* ============ 翻译评分 ============ */

  function assessTranslation(zh, en) {
    var zhTxt = clean(zh), enTxt = clean(en);
    var zhChars = (zhTxt.match(/[\u4e00-\u9fa5]/g) || []).length;
    var ws = words(enTxt);
    var wc = ws.length;
    var sens = sentences(enTxt);
    var sc = sens.length;

    var issues = [], revs = [], strengths = [];

    /* 信息完整度：数字 / 专名 / 句数 */
    var zhNums = zhTxt.match(/\d+(?:\.\d+)?%?|\d+年|\d+世纪|\d+年代/g) || [];
    var enNums = enTxt.match(/\d+(?:\.\d+)?%?|\b\d+\b/g) || [];
    var numMiss = zhNums.filter(function (n) {
      var core = n.replace(/[年世纪%]/g, '');
      return enNums.indexOf(core) < 0 && enTxt.indexOf(core) < 0;
    });

    var termHit = [], termMiss = [];
    TERMS.forEach(function (t) {
      if (zhTxt.indexOf(t.zh) >= 0) {
        var ok = t.en.some(function (e) { return enTxt.toLowerCase().indexOf(e) >= 0; });
        (ok ? termHit : termMiss).push({ zh: t.zh, en: t.en[0] });
      }
    });

    var zhClauses = (zhTxt.match(/[，。；：！？、]/g) || []).length + 1;
    var ratio = zhChars ? wc / zhChars : 0;
    // 信息单元：先按句末标点分句，再按逗号细分，供漏译自查逐条对照
    var units = [];
    zhTxt.split(/[。；！？]/).forEach(function (s) {
      s.split(/[，、：]/).forEach(function (x) {
        x = x.trim();
        if (x.length > 1) units.push(x);
      });
    });

    var infoScore = 100;
    var infoNote = [];
    if (zhChars === 0) { infoScore = 0; infoNote.push('未填写中文原文，无法判断信息完整度。'); }
    if (numMiss.length) {
      infoScore -= numMiss.length * 16;
      infoNote.push('数字/年份疑似漏译：' + numMiss.join('、'));
      issues.push({ level: 'bad', t: '数字或年份漏译', d: '中文出现 ' + esc(numMiss.join('、')) + '，译文中未找到对应。数字是翻译评分的硬信息点。' });
    }
    if (termMiss.length) {
      infoScore -= termMiss.length * 20;
      infoNote.push('专有名词可疑：' + esc(termMiss.map(function (t) { return t.zh + '（建议 ' + t.en + '）'; }).join('、')));
      issues.push({
        level: 'bad', t: '专有名词处理不当（' + termMiss.length + ' 处）',
        d: termMiss.map(function (t) { return t.zh + ' → 建议译为 ' + t.en; }).join('；') + '。六级翻译中文化专有名词需使用通行译法，拼音直译会失分。'
      });
    }
    if (termHit.length) {
      strengths.push('专有名词处理得当：' + termHit.map(function (t) { return t.zh; }).join('、'));
      issues.push({ level: 'good', t: '专有名词译法正确', d: termHit.map(function (t) { return t.zh + ' → ' + t.en; }).join('；') });
    }
    if (zhChars > 0) {
      if (ratio < .45) {
        infoScore -= 22;
        infoNote.push('译文偏短（英词数/中文字数 = ' + ratio.toFixed(2) + '），可能有漏译。');
        issues.push({ level: 'bad', t: '译文长度明显偏短', d: '比值 ' + ratio.toFixed(2) + '。中译英的常见区间约 0.55–0.85，过低通常意味着信息丢失。' });
      } else if (ratio > 1.05) {
        infoScore -= 10;
        infoNote.push('译文偏长（比值 ' + ratio.toFixed(2) + '），可能有冗余或过度解释。');
        issues.push({ level: 'warn', t: '译文偏长', d: '比值 ' + ratio.toFixed(2) + '。检查是否加入了原文没有的信息或重复修饰。' });
      } else {
        infoNote.push('篇幅比值 ' + ratio.toFixed(2) + '，处在合理区间。');
      }
      if (sc < zhClauses * .35) {
        infoScore -= 12;
        issues.push({
          level: 'warn', t: '句数偏少（英 ' + sc + ' 句 / 中 ' + zhClauses + ' 个分句）',
          d: '中文长句常需拆分。若译文句子数远少于原文分句数，检查是否把多个信息点挤在了一句里导致逻辑不清。'
        });
      }
    }
    infoScore = clamp(infoScore, 15, 100);

    /* 语法 */
    var gProblems = [];
    var cnPunct = enTxt.match(/[，。；？！、：（）《》]/g);
    if (cnPunct && cnPunct.length) gProblems.push({ t: '译文中混入中文标点（' + cnPunct.length + ' 处）', d: '请统一使用半角标点。' });
    var sva = detectSVA(enTxt);
    if (sva && sva.length) gProblems.push({ t: '疑似主谓一致问题（' + sva.length + ' 处）', d: sva.slice(0, 3).join('、') + '，第三人称单数需加 -s/-es。' });
    var anErr = enTxt.match(/\ba\s+[aeiou]\w+/gi);
    if (anErr && anErr.length) gProblems.push({ t: '冠词 a/an 可能误用', d: anErr.slice(0, 3).join('、') });
    var noEnd = sens.filter(function (s) { return !/[.!?]["')]?$/.test(s); }).length;
    if (noEnd > 0) gProblems.push({ t: '句末缺标点（' + noEnd + ' 处）', d: '每个句子需以句号结束。' });
    var dup = enTxt.match(/\b(\w+)\s+\1\b/gi);
    if (dup && dup.length) gProblems.push({ t: '重复词（' + dup.length + ' 处）', d: dup.slice(0, 3).join('、') });
    var typoList = [];
    TYPOS.forEach(function (p) {
      if (new RegExp('\\b' + p[0] + '\\b', 'gi').test(enTxt)) typoList.push(p);
    });
    if (typoList.length) {
      gProblems.push({ t: '拼写错误（' + typoList.length + ' 处）', d: typoList.map(function (p) { return p[0] + ' → ' + p[1]; }).join('；') });
      typoList.forEach(function (p) {
        var m = enTxt.match(new RegExp('[^.!?]{0,60}\\b' + p[0] + '\\b[^.!?]{0,60}', 'i'));
        if (m) revs.push({ o: m[0].trim(), n: m[0].trim().replace(new RegExp('\\b' + p[0] + '\\b', 'i'), p[1]), r: '拼写修正' });
      });
    }
    var gramScore = clamp(100 - gProblems.length * 14, 25, 100);
    gProblems.forEach(function (p) { issues.push({ level: 'bad', t: p.t, d: p.d }); });
    if (!gProblems.length) strengths.push('语法形式层面未发现明显错误');

    /* 自然度 / 中式英语 */
    var ching = [];
    CHINGLISH.forEach(function (c) { if (c.re.test(enTxt)) ching.push(c); });
    var natScore = clamp(100 - ching.length * 18, 25, 100);
    ching.forEach(function (c) {
      issues.push({ level: 'bad', t: '中式英语：<code>' + c.t + '</code>', d: c.d + ' 建议 <span class="fix">' + c.f + '</span>' });
      var m = enTxt.match(new RegExp('[^.!?]{0,70}' + c.re.source + '[^.!?]{0,70}', 'i'));
      if (m) revs.push({ o: m[0].trim(), n: '（' + c.t + ' → ' + c.f + '）', r: c.d });
    });
    if (!ching.length) strengths.push('未命中常见中式搭配');

    /* 句法结构（语序 / 复杂度） */
    var subMark = (enTxt.match(/\b(which|that|although|because|since|while|whereas|if|when|so that|as|with)\b/gi) || []).length;
    var structScore = clamp(45 + Math.min(subMark, 12) * 4.5, 30, 100);
    issues.push({
      level: subMark >= 4 ? 'good' : 'warn',
      t: '句式复杂度：从句/连接标记 ' + subMark + ' 处',
      d: subMark >= 4 ? '使用了从句或介词结构承载逻辑关系，符合六级翻译的表达层次。'
        : '译文以简单句为主。六级翻译建议用分词结构、定语从句、with 复合结构整合信息。'
    });

    /* 加权：信息 40% / 语法 25% / 自然 20% / 句法 15% */
    var dims = [
      { key: 'info', name: '信息完整度', w: .40, s: infoScore, note: infoNote.join(' ') || '未填写中文原文，无法评估。' },
      { key: 'grammar', name: '语法准确性', w: .25, s: gramScore, note: gProblems.length ? '检测到 ' + gProblems.length + ' 类问题。' : '未检测到明显语法形式错误。' },
      { key: 'naturalness', name: '表达自然度', w: .20, s: natScore, note: ching.length ? '检测到 ' + ching.length + ' 处中式英语。' : '未命中常见中式搭配。' },
      { key: 'structure', name: '句法与语序', w: .15, s: structScore, note: '从句/连接标记 ' + subMark + ' 处。' }
    ];
    var total = dims.reduce(function (a, d) { return a + d.s * d.w; }, 0);
    if (wc === 0) total = 0;
    else if (wc < 15) total = total * (wc / 15);

    var score15 = round1(clamp(total / 100 * 15, 0, 15));
    var score710 = Math.round(total / 100 * 106.5);
    var level, levelCls;
    if (score15 >= 13) { level = '优秀'; levelCls = 'good'; }
    else if (score15 >= 11) { level = '良好'; levelCls = 'good'; }
    else if (score15 >= 8.5) { level = '中等'; levelCls = 'warn'; }
    else if (score15 >= 5) { level = '及格边缘'; levelCls = 'warn'; }
    else { level = '需加强'; levelCls = 'bad'; }

    return {
      type: 'translation',
      score15: score15, score100: Math.round(total), score710: score710,
      level: level, levelCls: levelCls,
      wordCount: wc, sentCount: sc, zhChars: zhChars, ratio: round1(ratio * 100) / 100,
      dims: dims, issues: issues, revisions: revs, strengths: strengths,
      terms: { hit: termHit, miss: termMiss }, units: units
    };
  }

  /* ============ 薄弱点诊断 ============ */

  var DIM_LABEL = {
    content: { name: '内容切题度', drill: '练习“审题—列提纲—扣关键词”三步法，写前先圈出题目中的核心名词并逐段回应。' },
    organization: { name: '组织结构', drill: '固定使用“引入+立场 / 2–3 个分论点 / 收束”结构，每段只承载一个分论点。' },
    coherence: { name: '逻辑连贯性', drill: '每段内部按“观点—原因—例证—小结”推进，段间用转折或因果连接词衔接。' },
    grammar: { name: '语法准确性', drill: '建立个人错题本，重点攻克主谓一致、冠词、时态与标点。写完务必通读一遍。' },
    vocab: { name: '词汇丰富度', drill: '按话题整理替换词表（important→crucial/vital/indispensable），每次写作强制替换 5 处。' },
    sentence: { name: '句式多样性', drill: '刻意练习把两个短句合并为含定语从句或分词结构的复合句，并保留 1–2 个短句做强调。' },
    naturalness: { name: '语言自然度', drill: '背诵 30 组高频搭配（动宾、形名），避免逐字直译中文。' },
    template: { name: '模板痕迹', drill: '删掉所有通用开头结尾，用题目具体信息开头，直接给出你的判断。' },
    info: { name: '信息完整度', drill: '翻译前先标出中文的数字、专有名词与分句，译完逐项核对，确保无漏译。' },
    structure: { name: '句法与语序', drill: '练习中文长句拆分：先找主干，再用从句、分词或 with 结构补充修饰信息。' }
  };

  function diagnose(records) {
    var acc = {};
    (records || []).forEach(function (r) {
      (r.dims || []).forEach(function (d) {
        if (!acc[d.key]) acc[d.key] = { key: d.key, sum: 0, n: 0, min: 100 };
        acc[d.key].sum += d.s; acc[d.key].n++;
        acc[d.key].min = Math.min(acc[d.key].min, d.s);
      });
    });
    var list = Object.keys(acc).map(function (k) {
      var a = acc[k];
      return { key: k, avg: a.sum / a.n, n: a.n, name: (DIM_LABEL[k] && DIM_LABEL[k].name) || k };
    }).sort(function (x, y) { return x.avg - y.avg; });

    return {
      ranked: list,
      weak: list.slice(0, 3),
      strong: list.slice(-2).reverse(),
      sampleSize: (records || []).length
    };
  }

  global.CETEngine = {
    assessWriting: assessWriting,
    assessTranslation: assessTranslation,
    diagnose: diagnose,
    DIM_LABEL: DIM_LABEL,
    CHINGLISH: CHINGLISH,
    TERMS: TERMS
  };
})(window);
