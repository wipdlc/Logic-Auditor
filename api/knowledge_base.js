// api/knowledge_base.js
export const KNOWLEDGE_BASE = {
    // 1. 学术/答辩/论文
    "academic": `
[标准:GB/T 7713-1987 学术论文编写规则]
1. 论据充分性：核心论点必须有数据(Data)或文献(Citation)支撑，禁止主观臆断。
2. 词汇客观性：严禁使用“完全”、“百分之百”、“绝对”等无绝对数据支撑的极端词汇。
3. 逻辑推导链：前提(Premise)与结论(Conclusion)之间必须存在必然联系，避免跳跃性推论。
4. 定义一致性：核心专有名词首次出现须定义，且全文内涵保持一致。
    `,

    // 2. 商业计划书 (BP)
    "business": `
[标准:中国"互联网+"大学生创新创业大赛评审规则(2024版)]
1. 市场规模(TAM/SAM/SOM)：必须引用IDC、艾瑞咨询等第三方权威数据，严禁"拍脑袋"虚构市场。
2. 商业闭环：必须清晰阐述盈利模式(获客->转化->留存->变现)，禁止只谈情怀不谈钱。
3. 需求真伪：产品必须解决具体的"真痛点"，而非"伪需求"，需提供用户调研或试用数据。
4. 竞品分析：必须列举具体竞品并通过SWOT分析体现差异化壁垒。
    `,

    // 3. 通用逻辑
    "general": `
[标准:通用逻辑与批判性思维法则]
1. 循环论证：论据不能是论点的同义反复。
2. 数据相关性：引用的数据必须与当前时间点和场景强相关，避免过时数据。
3. 归因谬误：避免将简单的相关性强行解释为因果性。
    `
};

export const detectScenario = (text) => {
    if (!text) return 'general';
    const t = text.substring(0, 1000).toLowerCase(); // 只读前1000字判断场景
    
    const academicKeywords = ['论文', '答辩', '研究', '文献', '实验', '摘要', '参考文献', '导师'];
    const businessKeywords = ['商业', '计划书', '市场', '盈利', '用户', '痛点', '竞品', '融资', 'bp'];
    
    let academicScore = 0;
    let businessScore = 0;

    academicKeywords.forEach(k => { if(t.includes(k)) academicScore++; });
    businessKeywords.forEach(k => { if(t.includes(k)) businessScore++; });

    if (academicScore === 0 && businessScore === 0) return 'general';
    return academicScore > businessScore ? 'academic' : 'business';
};
