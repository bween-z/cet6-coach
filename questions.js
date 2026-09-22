/* 原创 CET-6 题库
   依据 cet-skill 的版权与原创性政策：全部题目为原创 CET-style 仿真训练，
   不复制、不重构、不复现任何真实四六级真题内容。
   主题分布参照六级取向：科技与社会、教育、公共议题、职业发展、
   文化传播、伦理选择、可持续性、社会变迁。 */
(function (global) {
  'use strict';

  var LABEL = '以下为原创 CET-style 仿真模拟训练，不是官方真题。';

  /* ---------- 写作题库 ---------- */
  var WRITING = [
    {
      id: 'w1', type: 'opinion', difficulty: 'medium', focus: ['coherence', 'sentence'],
      title: 'Should universities give practical training priority over academic research?',
      brief: '高校应优先提供实践训练还是学术研究？',
      prompt: 'Some people believe universities should give practical training priority over academic research. To what extent do you agree or disagree?'
    },
    {
      id: 'w2', type: 'phenomenon', difficulty: 'hard', focus: ['content', 'vocab'],
      title: 'Short-video platforms and the decline of sustained reading',
      brief: '短视频平台对深度阅读习惯的影响',
      prompt: 'Short-video platforms have become the main source of information for many young people, while sustained reading is said to be declining. Write an essay analysing this phenomenon and its implications.'
    },
    {
      id: 'w3', type: 'problem-solution', difficulty: 'hard', focus: ['organization', 'coherence'],
      title: 'Ageing populations and the pressure on urban public services',
      brief: '城市老龄化给公共服务带来的压力与对策',
      prompt: 'Many cities are ageing rapidly, which places heavy pressure on healthcare, transport and community services. Analyse the problem and propose feasible solutions.'
    },
    {
      id: 'w4', type: 'advantage-disadvantage', difficulty: 'medium', focus: ['sentence', 'vocab'],
      title: 'Remote work: gain or loss for young professionals?',
      brief: '远程办公对职场新人的利弊',
      prompt: 'Remote work has been widely adopted since the pandemic. Discuss its advantages and disadvantages for young professionals at the start of their careers.'
    },
    {
      id: 'w5', type: 'suggestion', difficulty: 'medium', focus: ['content', 'template'],
      title: 'How should graduates respond to AI reshaping entry-level jobs?',
      brief: '毕业生如何应对 AI 重塑初级岗位',
      prompt: 'Artificial intelligence is reshaping many entry-level jobs. What should university graduates do to remain competitive? Give specific suggestions.'
    },
    {
      id: 'w6', type: 'practical', difficulty: 'medium', focus: ['organization', 'naturalness'],
      title: 'A proposal to your university for a carbon-neutral campus',
      brief: '给学校写一份建设碳中和校园的倡议',
      prompt: 'Write a proposal to the president of your university, suggesting three concrete measures to move the campus towards carbon neutrality. Explain why each measure matters.'
    },
    {
      id: 'w7', type: 'opinion', difficulty: 'hard', focus: ['vocab', 'content'],
      title: 'Is digitisation the best way to promote a national culture abroad?',
      brief: '数字化是否是向海外传播本国文化的最佳方式',
      prompt: 'Some argue that digitising cultural heritage is the most effective way to promote a national culture abroad. Discuss the extent to which you agree, and what may be lost in the process.'
    },
    {
      id: 'w8', type: 'phenomenon', difficulty: 'medium', focus: ['content', 'template'],
      title: 'The rise of "reverse consumption" among young people',
      brief: '年轻人中的“反向消费”现象',
      prompt: 'A growing number of young people deliberately buy fewer but more durable goods, a trend described as "reverse consumption". Analyse the causes and significance of this shift.'
    },
    {
      id: 'w9', type: 'opinion', difficulty: 'hard', focus: ['sentence', 'coherence'],
      title: 'Do recommendation algorithms undermine autonomous choice?',
      brief: '推荐算法是否削弱了自主选择能力',
      prompt: 'Recommendation algorithms now decide what news, music and products we see. Do they undermine our capacity for autonomous choice? Argue your position with reasons and examples.'
    },
    {
      id: 'w10', type: 'problem-solution', difficulty: 'hard', focus: ['organization', 'vocab'],
      title: 'The urban-rural gap in basic education resources',
      brief: '城乡基础教育资源配置差距',
      prompt: 'Basic education resources remain unevenly distributed between cities and rural areas. Analyse the consequences of this gap and suggest practical ways to narrow it.'
    },
    {
      id: 'w11', type: 'practical', difficulty: 'medium', focus: ['naturalness', 'organization'],
      title: 'A letter to the city council on smart transport',
      brief: '给市议会写一封关于智慧交通的建议信',
      prompt: 'Write a letter to your city council, commenting on the current traffic situation and proposing two data-based measures to improve urban mobility.'
    },
    {
      id: 'w12', type: 'opinion', difficulty: 'hard', focus: ['content', 'coherence'],
      title: 'Personal data privacy versus public health research',
      brief: '个人数据隐私与公共健康研究之间的张力',
      prompt: 'Public health research increasingly relies on personal data. Discuss whether the collective benefit justifies the erosion of personal data privacy, and where the line should be drawn.'
    }
  ];

  /* ---------- 翻译题库 ---------- */
  var TRANSLATION = [
    {
      id: 't1', topic: '数字治理', difficulty: 'medium', focus: ['info', 'structure'],
      zh: '近年来，越来越多的地方政府把政务服务搬到线上。居民只需一部手机，就能完成社保查询、证件办理和税费缴纳。这种做法既减少了排队等候的时间，也让办事流程更加透明。不过，数字政务的推广仍需照顾不熟悉智能设备的老年群体，保留必要的线下窗口。',
      points: ['政务服务', '社保查询', '线下窗口', '透明']
    },
    {
      id: 't2', topic: '文化遗产', difficulty: 'hard', focus: ['structure', 'naturalness'],
      zh: '剪纸是中国最具代表性的民间艺术之一，其历史可以追溯至一千五百多年前。艺人仅用一把剪刀或刻刀，便能在红纸上呈现出花鸟、人物与吉祥图案。如今，剪纸不仅出现在节日装饰中，也被运用到服装设计和书籍插画里，成为连接传统与现代的桥梁。',
      points: ['剪纸', '民间艺术', '吉祥图案', '追溯']
    },
    {
      id: 't3', topic: '生态文明', difficulty: 'hard', focus: ['info', 'vocab'],
      zh: '湿地被称为“地球之肾”，在调节气候、净化水质和维护生物多样性方面发挥着不可替代的作用。过去几十年里，由于城市扩张和农业开发，全球湿地面积大幅减少。近年来，中国已建立数百处湿地保护区，并通过立法加强对湿地的系统性修复。',
      points: ['湿地', '地球之肾', '生物多样性', '湿地保护区']
    },
    {
      id: 't4', topic: '智慧城市', difficulty: 'medium', focus: ['info', 'structure'],
      zh: '智慧交通系统通过摄像头与传感器实时采集路况数据，再由算法动态调整信号灯时长。试点城市的统计显示，主干道通行效率提高了约百分之二十，高峰期拥堵时间明显缩短。这套系统还能优先放行救护车与消防车，为应急救援争取宝贵时间。',
      points: ['智慧交通', '传感器', '百分之二十', '应急救援']
    },
    {
      id: 't5', topic: '教育公平', difficulty: 'medium', focus: ['naturalness', 'structure'],
      zh: '为了缩小城乡教育差距，许多地区实施了教师轮岗制度，鼓励优秀教师到乡村学校任教。同时，远程直播课堂让农村学生能够与城市学生共享优质课程资源。这些措施在一定程度上缓解了师资不足的问题，但长期效果仍取决于当地的经济条件与政策支持。',
      points: ['城乡教育差距', '教师轮岗', '直播课堂', '师资']
    },
    {
      id: 't6', topic: '创新', difficulty: 'hard', focus: ['info', 'vocab'],
      zh: '长期以来，大量科研成果停留在论文阶段，未能转化为实际生产力。为解决这一问题，多地建立了产学研合作平台，让企业直接参与高校课题的立项与评估。统计表明，参与合作的企业研发投入回报率显著提高，新产品上市周期也缩短了近三分之一。',
      points: ['产学研', '研发投入', '三分之一', '转化']
    },
    {
      id: 't7', topic: '跨文化交流', difficulty: 'medium', focus: ['structure', 'naturalness'],
      zh: '博物馆正从单纯的文物收藏机构转变为跨文化交流的空间。通过数字复原与沉浸式展览，观众可以近距离观察文物的细节，甚至“走进”已经消失的历史场景。这种转变不仅吸引了更多年轻人，也使不同文化背景的观众更容易理解文物背后的故事。',
      points: ['博物馆', '数字复原', '沉浸式展览', '文物']
    },
    {
      id: 't8', topic: '公共服务', difficulty: 'medium', focus: ['info', 'grammar'],
      zh: '社区养老服务中心为老年人提供日间照料、康复训练和营养配餐，使他们能够在熟悉的环境中安度晚年。与机构养老相比，这种模式既减轻了子女的照护压力，也降低了社会养老成本。目前，中心的专业护理人员仍然短缺，需要更多政策与培训支持。',
      points: ['社区养老', '日间照料', '康复训练', '护理人员']
    },
    {
      id: 't9', topic: '现代化', difficulty: 'medium', focus: ['info', 'structure'],
      zh: '中国的高铁网络在二十年间从零起步，运营里程已超过四万公里，位居世界第一。高铁不仅缩短了城市之间的时空距离，也带动了沿线中小城市的旅游与投资。与此同时，如何保持高速度下的安全性与经济性，依然是运营方面临的长期挑战。',
      points: ['高铁', '四万公里', '运营里程', '时空距离']
    },
    {
      id: 't10', topic: '生态文明', difficulty: 'hard', focus: ['info', 'vocab'],
      zh: '为恢复长江流域的鱼类资源，相关部门实施了为期十年的禁渔政策，数以万计的渔民转产上岸。监测数据显示，部分江段的鱼类种类与数量已出现回升迹象。这项政策表明，生态修复往往需要长期投入，其成效也需以十年为单位来衡量。',
      points: ['长江', '禁渔', '转产', '生态修复']
    },
    {
      id: 't11', topic: '数字治理', difficulty: 'hard', focus: ['structure', 'naturalness'],
      zh: '随着各类应用不断收集用户的位置、偏好与社交关系，数据安全已成为公众关注的焦点。专家指出，仅靠用户的个人警惕远远不够，企业必须遵循“最小必要”原则采集信息，监管部门也应建立明确的责任追溯机制。只有多方共同承担，才能构建可信的数字环境。',
      points: ['数据安全', '最小必要', '责任追溯', '数字环境']
    },
    {
      id: 't12', topic: '文化传播', difficulty: 'hard', focus: ['vocab', 'structure'],
      zh: '近五年，中国影视作品在海外流媒体平台的播放量持续增长。相较于宏大的历史叙事，海外观众更容易被贴近日常生活的家庭故事所打动。这一现象提示创作者，文化出海的关键不在于刻意迎合，而在于用真实、具体的情感引发共鸣。',
      points: ['影视作品', '流媒体', '文化出海', '共鸣']
    }
  ];

  /* ---------- 按薄弱点推荐 ---------- */
  function pickByWeak(weakKeys, bank, n) {
    var keys = weakKeys || [];
    function scoreItem(it) {
      var s = 0;
      (it.focus || []).forEach(function (f) {
        var idx = keys.indexOf(f);
        if (idx >= 0) s += (keys.length - idx) * 10;
      });
      return s + Math.random() * 3;
    }
    var sorted = bank.slice().sort(function (a, b) { return scoreItem(b) - scoreItem(a); });
    return sorted.slice(0, n || 2);
  }

  function recommend(weakKeys) {
    return {
      writing: pickByWeak(weakKeys, WRITING, 3),
      translation: pickByWeak(weakKeys, TRANSLATION, 2)
    };
  }

  global.CETBank = {
    LABEL: LABEL,
    writing: WRITING,
    translation: TRANSLATION,
    recommend: recommend
  };
})(window);
