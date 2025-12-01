// api/knowledge_base.js

/**
 * 【核心竞争力】
 * 这里构建了一个静态的“专家规则库”。
 * 相比于向量检索的随机性，这种确定性的规则注入能保证审计的专业度。
 */

export const KNOWLEDGE_BASE = {
    // 1. 学术/答辩/论文 场景
    "academic": `
[核心校验标准 - 学术规范] 依据 GB/T 7713 及教育部学位论文抽检要素：
1. 论点支撑性：每一个核心结论必须有明确的数据(Data)、引用(Citation)或实验结果支撑，严禁仅凭主观推测。
2. 词汇严谨度：严禁使用“完全”、“绝对”、“百分之百”等无数据支撑的极端词汇。
3. 逻辑连贯性：段落之间必须有过渡(Transition)，前提(Premise)必须能必然推导出结论(Conclusion)。
4. 定义清晰：核心专有名词在首次出现时必须进行定义或解释。
    `,

    // 2. 商业/创业/互联网+ 场景
    "business": `
[核心校验标准 - 商业计划书(BP)] 依据"互联网+"大赛金奖项目评审维度：
1. 市场数据(TAM/SAM/SOM)：必须基于第三方权威报告推算市场规模，严禁拍脑袋虚构数据。
2. 商业闭环：必须清晰阐述"如何赚钱"，逻辑链条需包含：获客 -> 转化 -> 留存 -> 变现。
3. 痛点匹配：产品功能必须直接对应解决用户痛点，避免"伪需求"。
4. 竞争壁垒：必须分析直接竞品，并提出不可复制的差异化优势（技术护城河）。
    `,

    // 3. 通用逻辑谬误字典 (兜底策略)
    "general": `
[核心校验标准 - 通用逻辑] 基于经典逻辑学体系：
1. 循环论证(Circular Reasoning)：论据不能是论点的重复描述。
2. 滑坡谬误(Slippery Slope)：不能在没有证据的情况下将因果无限外推。
3. 幸存者偏差：引用的案例必须具有普适性，而非个例。
4. 前后一致性：上下文中的核心概念定义、数据口径必须保持一致。
    `
};

// 简单的语义路由 (Semantic Router)
// 依据关键词权重判断文本所属的领域
export const detectScenario = (text) => {
    if (!text) return 'general';
    const t = text.toLowerCase();
    
    const academicKeywords = ['论文', '答辩', '研究', '文献', '实验', '综述', '摘要', '参考文献', '导师', '课题'];
    const businessKeywords = ['商业', '计划书', '市场', '盈利', '用户', '痛点', '竞品', '融资', 'bp', '赛道', '运营'];
    
    let academicScore = 0;
    let businessScore = 0;

    academicKeywords.forEach(k => { if(t.includes(k)) academicScore++; });
    businessKeywords.forEach(k => { if(t.includes(k)) businessScore++; });

    // 设定阈值，防止误判
    if (academicScore === 0 && businessScore === 0) return 'general';
    
    return academicScore > businessScore ? 'academic' : 'business';
};