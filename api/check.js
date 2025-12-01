import { detectScenario, retrieveRules } from './knowledge_base.js';

// 申请 Vercel Serverless 的最大执行时间 (Hobby版通常是10s，Pro是300s，写在这里尽力而为)
export const config = {
    maxDuration: 60, 
};

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    try {
        const { text, chunkIndex = 0, totalChunks = 1 } = req.body;
        
        // 空值检查
        if (!text || text.length < 5) {
            return res.status(200).json({ score: 0, critiques: [], revised_text: "" });
        }

        const apiKey = process.env.QWEN_API_KEY;
        // 建议使用 fetch 直连阿里 API，减少 SDK 带来的额外开销
        const url = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';

        // 1. 获取增强后的规则 (Top 10+)
        const scenarioKey = detectScenario(text);
        const scenarioMap = {
            'academic': '学术论文/答辩 (Academic Thesis)',
            'business': '商业计划书 (Business Plan)',
            'general': '专业写作 (Professional Writing)'
        };
        const scenarioName = scenarioMap[scenarioKey];
        const activeRules = retrieveRules(text, scenarioKey);

        // 2. 保持您要求的【高强度 Prompt】 (未做任何简化)
        const systemPrompt = `你是一个名为 "Logic Auditor" 的严苛逻辑审计系统，专为高校创新大赛和学术科研场景设计。
你的目标不是“润色”，而是**像一个带刺的投资人或盲审专家一样，摧毁这段文本中模糊、空洞、逻辑断裂的部分**，并依据权威标准强制重建。

### 🌍 当前审计上下文 (Context):
- **场景模式**：【${scenarioName}】
- **文档进度**：正在处理长文档的第 ${chunkIndex + 1} / ${totalChunks} 部分。

### ⚖️ 必须严格执行的【权威校验标准】(Knowledge Base Grounding):
(以下规则检索自《互联网+大赛评审规则》、《GB/T 7713》、《Factuality Survey》等权威文件)
---------------------------------------------------
${activeRules}
---------------------------------------------------

### 🧠 你的执行思维链 (Chain of Thought):

1.  **Rule Mapping (规则映射)**: 
    - 扫描文本，立刻查找是否违反了上述【权威校验标准】中的具体条款。
    - *例如：提到“市场很大”却没引用数据 -> 违反《互联网+大赛评审规则》- 商业性维度。*

2.  **Logical Attack (逻辑爆破)**:
    - 寻找“循环论证”、“因果倒置”、“以偏概全”。
    - 寻找“幻觉性陈述”（如捏造不存在的文献或数据）。
    - 寻找“废话文学”（如“我们将以此为契机，大力发展...”）。

3.  **Defensive Refactoring (防御性重构)**:
    - 重写这段话。要求逻辑闭环，去伪存真。
    - **数据补全**: 遇到空洞处，必须插入占位符，例如：*[建议补充2024年中国SaaS行业CAGR数据]*。
    - **高亮修改**: 所有的关键修改，**必须**使用 HTML <b> 标签包裹，例如：<b>依据IDC 2023年报告</b>。

### 📤 输出格式要求 (Strict JSON):
必须输出纯合法的 JSON 格式，不包含 Markdown 代码块标记（如 \`\`\`json），包含以下字段：
{
    "score": 0-100 (整数，基于逻辑严密性和规则遵守度打分),
    "critiques": [
        {
            "quote": "原文中有问题的具体句子",
            "issue": "一针见血的批评 (e.g., '缺乏第三方数据支撑')",
            "rule_ref": "直接复制上述规则中对应的【条款来源】字段 (e.g., '《互联网+大赛评审规则》- 商业性维度')",
            "fix": "具体的修改建议"
        }
    ],
    "revised_text": "重写后的完整片段，保留段落结构，关键修改用 <b> 包裹"
}`;

        // 3. 调用模型
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
                    top_p: 0.8,
                    max_tokens: 1500 // 保持足够的输出长度
                },
            }),
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`API Error ${response.status}: ${errText}`);
        }
        
        const data = await response.json();
        
        // 4. JSON 清洗
        let rawContent = data.output.choices[0].message.content;
        rawContent = rawContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        
        return res.status(200).json(JSON.parse(rawContent));

    } catch (error) {
        console.error('[Logic Auditor Chunk Error]', error);
        
        // 🔥 关键的容错返回：
        // 如果因为超时或模型抽风导致失败，返回原文，避免前端整页崩溃。
        // 这对于分片读取尤其重要，哪怕有一片挂了，其他片也能正常显示。
        return res.status(200).json({ 
            score: 0, 
            critiques: [], // 返回空数组，前端就不会显示红框
            revised_text: req.body.text // 返回原文，保证文章连贯性
        });
    }
}
