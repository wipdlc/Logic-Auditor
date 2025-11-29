export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    try {
        // 🔧 安全解析 req.body：先确保是字符串再 parse
        let parsedBody;
        if (typeof req.body === 'string') {
            parsedBody = JSON.parse(req.body);
        } else if (typeof req.body === 'object' && req.body !== null) {
            parsedBody = req.body; // 已经是对象（例如 Vercel 自动解析了）
        } else {
            throw new Error('Invalid request body');
        }

        const { text } = parsedBody;
        if (!text || typeof text !== 'string') {
            return res.status(400).json({ error: 'Missing or invalid "text" field' });
        }

        const apiKey = process.env.QWEN_API_KEY;
        if (!apiKey) {
            throw new Error('QWEN_API_KEY is not set');
        }

        // 🔧 去除 URL 尾部空格（你原 URL 末尾有两个空格！）
        const url = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';

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
                model: 'qwen-flash-2025-07-28',
                input: {
                    messages: [
                        { role: 'system', content: '你是一个只输出标准 JSON 的逻辑分析与写作辅导助手。' },
                        { role: 'user', content: prompt },
                    ],
                },
                parameters: { result_format: 'message' },
            }),
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`HTTP ${response.status}: ${text}`);
        }

        const data = await response.json();

        // 🔍 检查 Qwen API 错误
        if (data.code) {
            throw new Error(`Qwen API Error ${data.code}: ${data.message || ''}`);
        }

        // ✅ 关键修复：安全获取 content 并解析成对象
        const content = data?.output?.choices?.[0]?.message?.content;

        if (!content) {
            throw new Error('Empty or missing response content from Qwen API');
        }

        let result;
        if (typeof content === 'string') {
            // 正常情况：content 是 JSON 字符串，需 parse
            result = JSON.parse(content);
        } else if (typeof content === 'object' && content !== null) {
            // 异常但可能的情况：content 已是对象（如某些平台自动解析）
            result = content;
        } else {
            throw new Error(`Unexpected content type: ${typeof content}`);
        }

        // ✅ 额外校验：确保 result 符合预期结构（可选但推荐）
        if (typeof result.detected_scene !== 'string' || !Array.isArray(result.critiques)) {
            throw new Error('Invalid response structure from model');
        }

        return res.status(200).json(result);

    } catch (error) {
        console.error('[SERVER ERROR]', error);
        return res.status(500).json({
            error: 'API 服务出错',
            details: error.message,
            // ⚠️ 开发阶段可加，上线前务必移除敏感堆栈！
            // stack: error.stack,
        });
    }
}
