// api/check.js
import { KNOWLEDGE_BASE, detectScenario } from './knowledge_base.js';

// 申请 Vercel 最大执行时间 
    maxDuration: 60, 
};

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    try {
        const { text, chunkIndex = 0, totalChunks = 1 } = req.body;
        
        // 1. 基础校验
        if (!text || text.length < 5) {
            return res.status(200).json({ score: 0, critiques: [], revised_text: "" });
        }

        const apiKey = process.env.QWEN_API_KEY;
        const url = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';

        // 2. 准备场景与规则
        const scenarioKey = detectScenario(text);
        const scenarioName = scenarioKey === 'academic' ? '学术论文/答辩' : (scenarioKey === 'business' ? '商业计划书/创赛' : '通用逻辑陈述');
        const rules = KNOWLEDGE_BASE[scenarioKey];

        // 3. 构建高强度的逻辑审计 Prompt (集大成者)
        const systemPrompt = `你是一个名为 "Logic Auditor" 的严苛逻辑审计与重构系统。
你的身份是【红队测试专家】与【顶级期刊编辑】的结合体。
你的目标不仅仅是润色，而是**摧毁**这段文本中模糊、空洞、逻辑断裂的部分，并基于权威标准进行重建。

### 当前审计上下文：
- 场景模式：【${scenarioName}】
- 进度状态：正在处理长文档的第 ${chunkIndex + 1} / ${totalChunks} 部分（请注意上下文衔接）。
- **必须严格依据的权威标准**：
${rules}

### 你的执行流程 (Think Step-by-Step)：

1. **逻辑漏洞狙击 (Vulnerability Sniping)**：
   - 请找出本片段中 **2-5个** 最严重的逻辑谬误。
   - 关注点：循环论证、滑坡谬误、以偏概全、数据缺失、因果倒置、定义模糊。
   - **必须提取原文**：critiques中的 "quote" 字段必须精确复制原文中的问题句子。

2. **强制规则引用 (Rule Grounding)**：
   - 当你指控一个漏洞时，**必须**引用上述【核心校验标准】中的具体条款（包含标准名和序号）。
   - 格式示例："违背 [GB/T 7713] 第2条：严禁使用绝对化词汇"。

3. **防御性深度重构 (Deep Refactoring)**：
   - **不要只做修补，要重写整段话**，使其达到金奖项目/顶刊发表水准。
   - **逻辑闭环**：确保每一句推论都有前置条件支撑。
   - **数据占位符**：遇到内容空洞处，必须插入专业占位符，例如：[此处需补充2024年Q3市场渗透率数据] 或 [需补充权威文献引用]。
   - **高亮关键修改**：对你增强逻辑力度的关键修改处，必须使用 HTML <b> 标签包裹。

### 输出格式要求：
严格输出纯 JSON 格式（无 Markdown 标记），字段如下：
{
    "score": 0-100 (仅针对当前片段打分),
    "critiques": [
        {
            "quote": "原文中有问题的具体句子片段",
            "issue": "一针见血的逻辑问题描述",
            "rule_ref": "依据的权威标准 (如：依据 GB/T 7713 第2条)",
            "fix": "具体的修改或补救建议"
        }
    ],
    "revised_text": "重写后的完整片段，保留段落结构，关键修改处用 <b> 包裹，缺失数据处保留 [] 占位符"
}`;

        // 4. 调用 API
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
                    temperature: 0.15, // 稍微给一点点温度让重构更流畅，但依然保持严谨
                    top_p: 0.8,
                    max_tokens: 1500 // 适当增加 token 限制，防止重构文写不完
                },
            }),
        });

        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }
        
        const data = await response.json();
        if (data.code) throw new Error(`Model Error: ${data.message}`);

        const rawContent = data.output.choices[0].message.content;
        
        // 5. 使用安全解析函数 (脏数据修复，防止截断报错)
        const result = safeJsonParse(rawContent, text); 

        return res.status(200).json(result);

    } catch (error) {
        console.error('[Logic Auditor Chunk Error]', error);
        // 最终兜底：返回原文
        return res.status(200).json({ 
            score: 60, 
            critiques: [], 
            revised_text: req.body.text || "(系统繁忙，保持原文)"
        });
    }
}

/**
 * 脏 JSON 修复与安全解析工具
 * 专门处理大模型输出被截断（Unterminated string）的情况
 */
function safeJsonParse(jsonString, originalText) {
    // 1. 清理 Markdown 标记
    let str = jsonString.replace(/```json|```/g, '').trim();

    try {
        // 尝试正常解析
        return JSON.parse(str);
    } catch (e) {
        console.warn("JSON Parse Failed, attempting repair:", e.message);

        // 2. 尝试修复截断
        try {
            // 情况 A: 缺了结尾的引号和括号 (最常见：重构文没写完)
            // 补全引号和括号
            const repairedA = str + '"}'; 
            return JSON.parse(repairedA);
        } catch (e2) {
            try {
                 // 情况 B: 缺了结尾的括号
                 const repairedB = str + '}';
                 return JSON.parse(repairedB);
            } catch (e3) {
                // 情况 C: 缺了结尾的数组括号
                try {
                    const repairedC = str + ']}';
                    return JSON.parse(repairedC);
                } catch (e4) {
                    // 实在修不好，使用正则暴力提取
                    console.warn("Auto-repair failed, falling back to Regex extraction.");
                    return extractByRegex(str, originalText);
                }
            }
        }
    }
}

/**
 * 正则提取兜底
 */
function extractByRegex(brokenJson, originalText) {
    // 1. 尝试提取分数
    const scoreMatch = brokenJson.match(/"score":\s*(\d+)/);
    const score = scoreMatch ? parseInt(scoreMatch[1]) : 0;

    // 2. 尝试提取 critiques (稍微复杂，这里为了稳健，如果坏了就放弃漏洞列表，保文本)
    // 3. 尝试提取 revised_text
    // 匹配 "revised_text": " ... (直到最后)
    const textMatch = brokenJson.match(/"revised_text":\s*"([\s\S]*)$/);
    let revisedText = textMatch ? textMatch[1] : originalText; 
    
    // 如果 revisedText 开头包含 ", 去掉它
    if (revisedText.startsWith('"')) revisedText = revisedText.slice(1);

    return {
        score: score || 60, 
        critiques: [], 
        revised_text: revisedText + "..." // 加上省略号示意截断
    };
}
