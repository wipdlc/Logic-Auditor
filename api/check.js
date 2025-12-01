// api/check.js
import { detectScenario, retrieveRules } from './knowledge_base.js';

// 申请 Vercel Serverless 的执行时间 (Hobby版上限通常为10s-60s)
export const config = {
    maxDuration: 60,
};

export default async function handler(req, res) {
    // 仅支持 POST 请求
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    try {
        const { text, chunkIndex = 0, totalChunks = 1 } = req.body;
        
        // 基础空值检查
        if (!text || text.length < 5) {
            return res.status(200).json({ score: 0, critiques: [], revised_text: "" });
        }

        const apiKey = process.env.QWEN_API_KEY;
        const url = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';

        // 1. 智能场景感知与 RAG 规则检索
        // 获取当前切片对应的业务场景（商业/学术/通用）
        const scenarioKey = detectScenario(text);
        const scenarioMap = {
            'academic': '学术论文/答辩 (Academic Thesis/Defense)',
            'business': '商业计划书 (Business Plan/Pitch Deck)',
            'general': '专业写作 (Professional Writing)'
        };
        const scenarioName = scenarioMap[scenarioKey];
        // 检索最相关的 Top 8-10 条规则，并带有 display_source
        const activeRules = retrieveRules(text, scenarioKey);

        // 2. 构建“核弹级” Prompt
        // 融合了：严苛人设 + OCR抗噪 + RAG权威规则 + 穷尽扫描指令
        const systemPrompt = `你是一个名为 "Logic Auditor" 的严苛逻辑审计系统。
**当前运行模式：穷尽审计模式 (Exhaustive Audit Mode)**

你的任务是依据权威标准，对这段文本进行**地毯式扫描**。

### 🚨 关键上下文 (Context Awareness) - 必须严格遵守：
**输入文本源自 PDF 解析（OCR）**。文本中包含大量格式噪音，你必须具备辨识能力：
1.  **页眉/页脚残留**：如反复出现的项目名称（如“整流芯路”、“商业计划书”）、页码数字。-> **直接忽略，不要审计**。
2.  **图片/表格占位符**：如“图1”、“表2”、“附录六 获奖证书”等孤立短语。-> **视为图片未读取，不要批评其缺乏内容**。
3.  **目录碎片**：如“1.1 研究背景 ............ 5”。-> **直接忽略**。
4.  **截断的句子**：切片开头或结尾可能是不完整的句子。-> **不要批评语义不明，仅关注完整句段**。

### 🌍 业务场景：
- 场景：【${scenarioName}】
- 进度：这是长文档的第 ${chunkIndex + 1} / ${totalChunks} 个微切片。

### ⚖️ 权威校验标准 (Knowledge Base):
${activeRules}

### 🧠 执行思维链 (Chain of Thought):
1.  **Rule Mapping**: 扫描文本，查找违反上述【校验标准】的具体条款。
2.  **Logical Attack**: 寻找“循环论证”、“数据缺失（只有形容词没有数字）”、“因果倒置”。
3.  **Defensive Refactoring**: 重写文本，遇到数据空洞插入占位符 [建议补充xxx数据]。

### ⚡ 核心指令 (Reject Pass):
1.  **拒绝“无问题”**: 除非文本完美无缺，否则**必须**找出至少 2-3 个具体问题。
2.  **强制引用**: 每一个 issue 的 rule_ref 字段必须**显式复制**上方 rules 中的 display_source 字段。
3.  **专注逻辑**: 攻击重点在于“逻辑”和“证据”，而不是攻击 OCR 产生的碎片文字。

### 📤 输出格式要求 (Strict JSON):
必须输出纯合法的 JSON 格式，不包含 Markdown 代码块标记，字段如下：
{
    "score": 0-100 (若发现严重逻辑硬伤，分数不得高于85),
    "critiques": [
        {
            "quote": "原文中有问题的具体句子(不要截取页眉页脚)",
            "issue": "一针见血的批评 (e.g., '缺乏第三方数据支撑')",
            "rule_ref": "权威条款来源 (如 '《互联网+大赛评审规则》- 商业性维度')",
            "fix": "具体的修改建议"
        }
    ],
    "revised_text": "重写后的完整片段，保留段落结构，关键修改用 <b> 包裹"
}`;

        // 3. 调用大模型
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: 'qwen-flash-2025-07-28', // 使用 Flash 模型以保证速度，配合高强度 Prompt 效果足够
                input: {
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: text },
                    ],
                },
                parameters: { 
                    result_format: 'message',
                    temperature: 0.1, // 极低温度，迫使模型严格遵守规则，不胡乱发散
                    top_p: 0.8,
                    max_tokens: 1500  // 预留足够空间进行重构
                },
            }),
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`API Error ${response.status}: ${errText}`);
        }
        
        const data = await response.json();
        
        // 4. JSON 结果清洗与解析
        if (data.code) {
            throw new Error(`Model Error: ${data.message}`);
        }

        let rawContent = data.output.choices[0].message.content;
        // 去除可能的 markdown 标记
        rawContent = rawContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        
        const result = JSON.parse(rawContent);
        return res.status(200).json(result);

    } catch (error) {
        console.error('[Logic Auditor Chunk Error]', error);
        
        // 🔥 关键容错：
        // 如果后端超时或崩了，返回一个“无过错”的空结果。
        // 这样前端 Promise.all 或循环不会中断，用户至少能看到其他切片的结果。
        return res.status(200).json({ 
            score: 0, 
            critiques: [], 
            revised_text: req.body.text // 返回原文，保持文章连贯性
        });
    }
}
