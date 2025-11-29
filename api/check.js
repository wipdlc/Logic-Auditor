// api/check.js
export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    try {
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

        // 🔥 核心 Prompt：逻辑审计与改写专家
        const systemPrompt = `你是一个名为"Logic Auditor"的严苛逻辑审计系统。你的目标是摧毁这篇文本中模糊、空洞、逻辑断裂的部分，并进行重建。
        
请执行以下审计流程：
1. 【场景研判】：判断文本是商业计划、学术论证还是普通陈述。
2. 【逻辑评分】：给原文本的逻辑严密性打分（0-100）。
3. 【漏洞扫描】：找出2-5个具体的逻辑谬误（如：循环论证、因果倒置、数据缺失、言之无物）。**必须提取出原文中的具体问题句子**。
4. 【深度重构】：基于上述分析，重写这段话。要求：逻辑闭环，去伪存真，补充必要的推导过程（缺失的数据可用[需补充数据]占位），并使用HTML的 <b> 标签高亮你修改的关键部分。

严格以纯JSON格式输出，不要使用markdown代码块，格式如下：
{
    "scene": "识别到的场景",
    "score": 65,
    "critiques": [
        {
            "quote": "原文中有问题的具体句子片段",
            "issue": "指出具体的逻辑问题（如：缺乏数据支撑/强行因果）",
            "fix": "你的具体修改建议"
        }
    ],
    "revised_text": "重写后的完整文本，关键修改处用 <b>...</b> 包裹"
}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: 'qwen-flash-2025-07-28', // 建议使用 plus 或 max 以获得更好的逻辑能力，flash 可能稍弱
                input: {
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: text },
                    ],
                },
                parameters: { 
                    result_format: 'message',
                    temperature: 0.2 // 低温度以保证逻辑严谨性
                },
            }),
        });

        if (!response.ok) throw new Error(`Qwen API HTTP ${response.status}`);
        
        const data = await response.json();
        if (data.code) throw new Error(`Qwen API Error: ${data.message}`);

        const rawContent = data.output.choices[0].message.content;
        
        // 🔧 鲁棒性处理：清洗可能存在的 Markdown 标记 ```json ... ```
        const jsonStr = rawContent.replace(/```json|```/g, '').trim();
        const result = JSON.parse(jsonStr);

        return res.status(200).json(result);

    } catch (error) {
        console.error('[Logic Auditor Error]', error);
        return res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
}
