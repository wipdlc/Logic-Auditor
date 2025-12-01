
import rulesData from './data/rules.json' with { type: 'json' };


export const detectScenario = (text) => {
    if (!text) return 'general';
    const t = text.substring(0, 1000).toLowerCase();
    
    // 关键词库增强
    const academicKeywords = ['论文', '答辩', '研究', '文献', '摘要', 'reference', 'abstract', '综述', 'thesis', '结论', '引言'];
    const businessKeywords = ['商业', '计划书', '市场', '盈利', '痛点', '竞品', 'bp', 'revenue', '融资', '股权', 'business model', '红旅'];
    
    let academicScore = 0;
    let businessScore = 0;

    academicKeywords.forEach(k => { if(t.includes(k)) academicScore++; });
    businessKeywords.forEach(k => { if(t.includes(k)) businessScore++; });

    if (academicScore > businessScore) return 'academic';
    if (businessScore > academicScore) return 'business';
    return 'general';
};

export const retrieveRules = (text, scenario) => {
    // 1. 严格的分类过滤：只保留当前场景 + 通用 + 技术规则
    // 这步至关重要，防止比如在写BP时被检查"参考文献角标"
    let candidates = rulesData.filter(r => 
        r.category === scenario || r.category === 'general' || r.category === 'technical'
    );

    // 2. 加权匹配
    const scoredRules = candidates.map(rule => {
        let score = 0;
        // 基础分：只要属于该场景，给 1 分基础分，保证基本的规则都在
        if (rule.category === scenario) score += 1; 

        // 关键词命中加分
        rule.tags.forEach(tag => {
            if (text.includes(tag)) {
                score += (rule.weight * 2); // 命中关键词权重翻倍
            }
        });
        return { ...rule, score };
    });

    // 3. 排序
    const sortedRules = scoredRules
        .filter(r => r.score > 0)
        .sort((a, b) => b.score - a.score);

    // 4. 宽窗口策略 (保留更多规则)
    // 只要分数足够高，或者至少保留 Top 8，确保规则覆盖面足够广
    // 如果没有命中关键词，也至少保留该场景下的 Top 5 高权重规则作为保底
    let finalRules = sortedRules.slice(0, 10); 

    if (finalRules.length < 5) {
        const fallbackRules = candidates
            .sort((a, b) => b.weight - a.weight)
            .slice(0, 5);
        
        // 合并去重
        const existingIds = new Set(finalRules.map(r => r.id));
        fallbackRules.forEach(r => {
            if (!existingIds.has(r.id)) {
                finalRules.push(r);
            }
        });
    }

    // 格式化输出
    return finalRules.map(r => 
        `> [${r.display_source}]\n  条款内容：${r.content}`
    ).join('\n\n');
};


