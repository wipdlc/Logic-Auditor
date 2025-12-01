// api/check.js
import { detectScenario, retrieveRules } from './knowledge_base.js';

// 申请 Vercel Serverless 的最大执行时间
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
        const url = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';

        // 1. 获取增强后的规则 (基于宽窗口检索)
        const scenarioKey = detectScenario(text);
        const scenarioMap = {
            'academic': '学术论文/答辩 (Academic Thesis/Defense)',
            'business': '商业计划书 (Business Plan/Pitch Deck)',
            'general': '专业写作 (Professional Writing)'
        };
        const scenarioName = scenarioMap[scenarioKey];
        const activeRules = retrieveRules(text, scenarioKey);

        // 2. 构建“核弹级”融合 Prompt
        // 融合了：严苛人设 + RAG规则 + 思维链(CoT) + 穷尽模式(Micro-slice Focus)
        const systemPrompt = `你是一个名为 "Logic Auditor" 的严苛逻辑审计系统。
你的目标不仅仅是润色，而是**像一个带刺的投资人或盲审专家一样，摧毁这段文本中模糊、空洞、逻辑断裂的部分**，并依据权威标准强制重建。

**当前运行模式：穷尽审计模式 (Exhaustive Audit Mode)**
这是一份长文档的**微切片(Micro-slice)**。请专注于当前的每一个句子，进行地毯式扫描，不要放过任何微小的逻辑瑕疵。

### 🌍 当前审计上下文 (Context):
- **场景模式**：【${scenarioName}】
- **切片进度**：第 ${chunkIndex + 1} / ${totalChunks} 部分

### ⚖️ 必须严格执行的【权威校验标准】(Knowledge Base):
(以下规则检索自《互联网+大赛评审规则》、《GB/T 7713》等权威文件)
---------------------------------------------------
${activeRules}
---------------------------------------------------

### 🧠 你的执行思维链 (Chain of Thought):

1.  **Rule Mapping (规则映射)**: 
    - 扫描文本，立刻查找是否违反了上述【权威校验标准】中的具体条款。
    - *例如：提到“市场很大”却没引用数据 -> 违反《互联网+大赛评审规则》- 商业性维度。*

2.  **Logical Attack (逻辑爆破)**:
    - 寻找“循环论证”、“因果倒置”、“以偏概全”。
    - 寻找“幻觉性陈述”（如捏造不存在的文献、数据、或未定义的术语）。
    - 寻找“废话文学”（如“我们将以此为契机...”等无实质内容的填充词）。

3.  **Defensive Refactoring (防御性重构)**:
    - 重写这段话。要求逻辑闭环，去伪存真。
    - **数据补全**: 遇到空洞处，必须插入占位符，例如：*[建议补充2024年中国SaaS行业CAGR数据]*。
    - **高亮修改**: 所有的关键修改，**必须**使用 HTML <b> 标签包裹，例如：<b>依据IDC 2023年报告</b>。

### ⚡ 核心指令 (Reject Pass):
- **拒绝“无问题”**: 除非文本完美无缺（极少见），否则**必须**至少找出 2-3 个具体问题。如果文本看似没问题，请深入检查数据来源可靠性、术语定义准确性或逻辑链条的完整性。
- **强制引用**: 每一个 issue 的 rule_ref 字段必须显式对应上方 rules 中的某一条 display_source。

### 📤 输出格式要求 (Strict JSON):
必须输出纯合法的 JSON 格式，不包含 Markdown 代码块标记，字段如下：
{
    "score": 0-100 (若发现严重逻辑硬伤，分数不得高于85),
    "critiques": [
        {
            "quote": "原文中有问题的具体句子",
            "issue": "一针见血的批评 (e.g., '缺乏第三方数据支撑，属于主观臆断')",
            "rule_ref": "必须直接复制上述规则中的【条款来源】字段",
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
                    temperature: 0.1, // 极低温度，迫使模型严格遵守规则和指令
                    top_p: 0.8,
                    max_tokens: 1500  // 预留足够的空间给重构文本
                },
            }),
        });

        if (!response.ok) {
            const errBody = await response.text();
            throw new Error(`API Error: ${response.status} - ${errBody}`);
        }
        
        const data = await response.json();
        
        // 4. 鲁棒的 JSON 解析
        let rawContent = data.output.choices[0].message.content;
        rawContent = rawContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        
        const result = JSON.parse(rawContent);
        return res.status(200).json(result);

    } catch (error) {
        console.error('[Logic Auditor Chunk Error]', error);
        
        // 容错机制：
        // 即使单个切片失败，也返回原文，保证前端页面不崩，其他切片的结果能正常显示
        return res.status(200).json({ 
            score: 0, 
            critiques: [], 
            revised_text: req.body.text 
        });
    }
}
