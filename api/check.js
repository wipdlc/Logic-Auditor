// api/check.js
import { KNOWLEDGE_BASE, detectScenario } from './knowledge_base.js';

export const config = {
    maxDuration: 60, // 尝试申请 Vercel 的最长执行时间 
};

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    try {
        let parsedBody;
        try {
            parsedBody = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        } catch (e) {
            throw new Error('Invalid JSON Body');
        }

        const { text } = parsedBody;
        
        // 这里的 Text 已经被前端截断过了，是安全的长度
        if (!text || text.length < 5) {
            return res.status(400).json({ error: 'Text too short' });
        }

        const apiKey = process.env.QWEN_API_KEY; 
        const url = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';

        const scenarioKey = detectScenario(text);
        const scenarioName = scenarioKey === 'academic' ? '学术论文/答辩' : (scenarioKey === 'business' ? '商业计划书' : '通用文本');
        const rules = KNOWLEDGE_BASE[scenarioKey];

        // 🔥 PROMPT 升级：要求更激进的修改
        const systemPrompt = `你是一个严苛的【逻辑审计与重构专家】。
当前审计模式：【${scenarioName}】。

⚠️ 必须依据以下标准进行高强度审查：
${rules}

### 你的任务 (Think Step-by-Step):
1. **漏洞狙击**：在文本中找出逻辑最脆弱的 2-46个点。不要挑剔错别字，只攻击逻辑漏洞（如数据缺失、闭环断裂）。
2. **强制引用**：指出的每个漏洞，必须明确写出"依据 [标准名] 第X条"。
3. **深度重构 (Deep Rewrite)**：
   - 不要只修修补补！**请重写整段话**，使其达到答辩金奖/顶刊论文的水准。
   - **数据补全**：遇到空洞的地方，使用[建议补充2024年Q3市场份额数据]这种具体格式的占位符。
   - **高亮修改**：对重构中你增强逻辑的关键句子，必须用 <b>...</b> 包裹。

### 输出格式 (JSON):
{
    "scene": "${scenarioName}",
    "score": 0-100的整数,
    "logic_thought_trace": "一句话总结本文最大的逻辑硬伤",
    "critiques": [
        {
            "quote": "原文片段",
            "issue": "问题描述",
            "rule_ref": "依据的标准 (必须包含标准具体名称)",
            "fix": "具体修改建议"
        }
    ],
    "revised_text": "深度重构后的完整文本，关键处用<b>标签包裹"
}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: 'qwen-flash-2025-07-28', 
                input: {
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: text }, // 此时的 text 是前端传来的精华片段
                    ],
                },
                parameters: { 
                    result_format: 'message',
                    temperature: 0.2, // 温度设置
                    top_p: 0.8
                },
            }),
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(JSON.stringify(err));
        }
        
        const data = await response.json();
        const rawContent = data.output.choices[0].message.content;
        const jsonStr = rawContent.replace(/```json|```/g, '').trim();
        
        try {
            const result = JSON.parse(jsonStr);
            return res.status(200).json(result);
        } catch (e) {
            // 如果 JSON 解析失败，说明可能被截断了，或者输出格式不对
            throw new Error("模型输出格式异常，请缩短文本重试");
        }

    } catch (error) {
        console.error('[Backend Error]', error);
        return res.status(500).json({ error: error.message });
    }
}
