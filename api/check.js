// 文件路径: api/check.js (最新 Qwen Flash 版本)
export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({error: 'Method Not Allowed'});

    try {
        const { text } = JSON.parse(req.body);
        
        // 关键：确保 Vercel 环境变量的名字和这里一致
        const apiKey = process.env.QWEN_API_KEY; 
        const url = `https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation`;

        const prompt = `
        你是一位以“批判性思维”著称的逻辑学教授。用户的输入通常是大学生写的论文论点、大创项目申报书或答辩陈词。
        你的任务不是修改语法，而是像“答辩评委”一样，无情地指出其中的逻辑漏洞。
        请遵循以下分析步骤：
        1. 识别核心论点和论据。
        2. 扫描逻辑谬误（如：以偏概全、强加因果、滑坡谬误、循环论证）。
        3. 检查边界条件（如：样本量是否足够？是否有幸存者偏差？）。
        请输出 3 到 4 个非常犀利、甚至带有挑战性的反问（Socratic Questioning），迫使学生重新思考他们的论证。
        用户输入内容：
        """${text}"""
        【输出格式要求】
        必须严格只返回一个 JSON 对象，不要包含 Markdown 标记（如 \`\`\`json），格式如下：
        { "questions": ["反问1...", "反问2...", "反问3..."] }
        `;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                // 使用你截图里的最新模型
                model: "qwen-flash-2025-07-28", 
                input: {
                    messages: [
                        { role: "system", content: "你是一个只输出标准 JSON 的逻辑分析助手。" },
                        { role: "user", content: prompt }
                    ]
                },
                parameters: {
                    result_format: "message" 
                }
            })
        });

        const data = await response.json();
        
        if (data.code) { // Qwen 的错误通常在 code 字段
             throw new Error(`Qwen API Error: ${data.message}`);
        }

        const aiText = data.output.choices[0].message.content;
        const result = JSON.parse(aiText);

        return res.status(200).json(result);

    } catch (error) {
        console.error("Server Error:", error);
        return res.status(500).json({ error: "API 服务出错", details: error.message });
    }
}
