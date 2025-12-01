// api/knowledge_base.js
import rulesData from './data/rules.json'; 

export const detectScenario = (text) => {
    if (!text) return 'general';
    const t = text.substring(0, 1000).toLowerCase();
    
    // 扩展了关键词库
    const academicKeywords = ['论文', '答辩', '研究', '文献', '摘要', 'reference', 'abstract', '综述', 'thesis', '结论'];
    const businessKeywords = ['商业', '计划书', '市场', '盈利', '痛点', '竞品', 'bp', 'revenue', '融资', '股权', 'business model'];
    
    let academicScore = 0;
    let businessScore = 0;

    academicKeywords.forEach(k => { if(t.includes(k)) academicScore++; });
    businessKeywords.forEach(k => { if(t.includes(k)) businessScore++; });

    if (academicScore > businessScore) return 'academic';
    if (businessScore > academicScore) return 'business';
    return 'general';
};

export const retrieveRules = (text, scenario) => {
    // 1. 基础过滤
    let candidates = rulesData.filter(r => 
        r.category === scenario || r.category === 'general' || r.category === 'technical'
    );

    // 2. 加权匹配 (关键词命中 * 权重)
    const scoredRules = candidates.map(rule => {
        let score = 0;
        rule.tags.forEach(tag => {
            if (text.includes(tag)) {
                score += (2 * rule.weight); // 关键词命中权重翻倍
            }
        });
        // 稍微加一点随机抖动，避免每次只返回完全一样的Top3，增加多样性（可选）
        return { ...rule, score: score }; 
    });

    // 3. 排序
    const sortedRules = scoredRules.filter(r => r.score > 0).sort((a, b) => b.score - a.score);

    // 4. 智能截断与保底
    let finalRules = sortedRules.slice(0, 5); // 取前5条强相关

    // 如果命中太少（比如原文太短），强制补充该场景下的高权重规则（保底）
    if (finalRules.length < 3) {
        const fallbackRules = candidates
            .sort((a, b) => b.weight - a.weight) // 按规则重要性排序
            .slice(0, 3);
        
        // 合并并去重
        const existingIds = new Set(finalRules.map(r => r.id));
        fallbackRules.forEach(r => {
            if (!existingIds.has(r.id)) {
                finalRules.push(r);
            }
        });
    }

    return finalRules.map(r => `> [${r.id}] ${r.content}`).join('\n\n');
};
