// api/check.js
import { KNOWLEDGE_BASE, detectScenario } from './knowledge_base.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    try {
        // 1. 解析请求体
        let parsedBody;
        try {
            parsedBody = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        } catch (e) {
            throw new Error('Invalid request body format');
        }

        const { text } = parsedBody;
        if (!text || typeof text !== 'string' || text.length < 5) {
            return res.status(400).json({ error: 'Text content is too short or invalid.' });
        }

        const apiKey = process.env.QWEN_API_KEY; 
        const url = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';

        // 2. RAG 语义路由：动态挂载知识库
        // 这是答辩时可以重点讲的：“我们不是盲目生成，而是基于场景动态路由规则”
        const scenarioKey = detectScenario(text);
        const scenarioName = scenarioKey === 'academic' ? '学术论文/答辩' : (scenarioKey === 'business' ? '商业计划书' : '通用逻辑陈述');
        const rules = KNOWLEDGE_BASE[scenarioKey];

        // 3. 构建高阶思维链 Prompt (Chain of Thought)
        const systemPrompt = `你是一个基于权威规则库构建的逻辑审计系统 (Logic Auditor)。
当前检测到的场景为：【${scenarioName}】。

你必须严格依据以下【核心校验标准】进行审计，严禁脱离标准自由发挥：
========== 核心校验标准 START ==========
${rules}
========== 核心校验标准 END ==========

你的任务流程（Chain of Thought）：
1. **对照审查**：逐句阅读用户文本，比对【核心校验标准】。
2. **规则引用**：当你指出漏洞时，**必须明确引用**它是标准中的第几条。例如："违反标准第1条：缺乏数据支撑"。
3. **防御性重构**：重写文本。要求消除所有逻辑谬误，补充[此处需补充XX数据]占位符，保持专业语调。

请严格以纯 JSON 格式输出，不要包含 markdown 代码块标记，格式如下：
{
    "scene": "${scenarioName}",
    "score": 0-100之间的整数,
    "logic_thought_trace": "一句话总结你发现了什么核心问题（例如：‘主要检测到商业闭环逻辑缺失，违背标准第2条’）",
    "critiques": [
        {
            "quote": "原文具体片段",
            "issue": "问题描述",
            "rule_ref": "违背标准的具体引用 (如: 依据标准第1条)",
            "fix": "具体修改建议"
        }
    ],
    "revised_text": "重写后的文本，关键修改处必须用 <b>...</b> 标签包裹以高亮显示"
}`;

        // 4. 调用阿里 Qwen API
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
                        { role: 'user', content: text },
                    ],
                },
                parameters: { 
                    result_format: 'message',
                    temperature: 0.1, // 低温，确保严谨
                    top_p: 0.8
                },
            }),
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(`API Provider Error: ${JSON.stringify(err)}`);
        }
        
        const data = await response.json();
        if (data.code) throw new Error(`Qwen Logic Error: ${data.message}`);

        const rawContent = data.output.choices[0].message.content;
        
        // 5. 鲁棒性清洗 JSON
        const jsonStr = rawContent.replace(/```json|```/g, '').trim();
        const result = JSON.parse(jsonStr);

        return res.status(200).json(result);

    } catch (error) {
        console.error('[Logic Auditor Backend Error]', error);
        return res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
}
