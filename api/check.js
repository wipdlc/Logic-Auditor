// 文件路径: api/check.js (Qwen Flash)
export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({error: 'Method Not Allowed'});

    try {
        const { text } = JSON.parse(req.body);
        const apiKey = process.env.QWEN_API_KEY; 
        const url = `https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation`;

        const prompt = `
        你是一位顶级的逻辑分析与写作辅导专家。你的任务是分析用户提供的文本，并像一位经验丰富的导师一样提供反馈。

        请遵循以下步骤：
        1.  **场景识别 (Scene Detection)**：首先，通读全文，判断该文本最可能属于哪种场景：是“项目申报书/商业计划”（侧重创新与可行性），还是“学术答辩/汇报”（侧重严谨与论证），或者是“通用议论文”。
        2.  **核心问题定位 (Issue Identification)**：找出文本中 2-3 个最致命的逻辑漏洞或薄弱环节。
        3.  **解决方案制定 (Solution Formulation)**：针对你找到的每一个问题，都给出一个具体的、可操作的修改建议。

        用户输入内容：
        """${text}"""

        【重要】请严格只返回一个 JSON 对象，不要包含 Markdown 标记，格式如下：
        {
            "detected_scene": "你判断出的场景，例如 '项目申报书'",
            "critiques": [
                {
                    "question": "反问1：直击因果关系的漏洞...",
                    "suggestion": "修改建议1：你应该补充 XX 数据来强化你的论证..."
                },
                {
                    "question": "反问2：挑战数据来源或样本...",
                    "suggestion": "修改建议2：可以尝试引用 XX 理论或案例来增加说服力..."
                }
            ]
        }
        `;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: "qwen-flash-2025-07-28", 
                input: {
                    messages: [
                        { role: "system", content: "你是一个只输出标准 JSON 的逻辑分析与写作辅导助手。" },
                        { role: "user", content: prompt }
                    ]
                },
                parameters: { result_format: "message" }
            })
        });

        const data = await response.json();
        
        if (data.code) { throw new Error(`Qwen API Error: ${data.message}`); }

        const aiText = data.output.choices[0].message.content;
        
        // 打印出 AI 原始返回的文本，方便调试
        console.log("Qwen raw response content:", aiText);

        const result = JSON.parse(aiText);

        return res.status(200).json(result);

    } catch (error) {
        // 打印详细错误，方便调试
        console.error("[SERVER ERROR]", error);
        return res.status(500).json({ error: "API 服务出错", details: error.message });
    }
}
