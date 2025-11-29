// 文件路径: api/check.js
export default async function handler(req, res) {
    // 1. 跨域处理 (允许你的前端访问)
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    // 只处理 POST 请求
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { text } = JSON.parse(req.body);

        // ⚠️ 记得在 Vercel 环境变量里填入你的新 Key，不要直接写在这里！
        const apiKey = process.env.GEMINI_API_KEY; 
        
        // 使用 Gemini 2.0 Flash 模型 (速度极快，适合即时反馈)
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

        // ==========================================
        // 🔥 核心 Prompt：逻辑拷打专家
        // ==========================================
        const systemPrompt = `
        你是一位以“批判性思维”著称的逻辑学教授。用户的输入通常是大学生写的论文论点、大创项目申报书或答辩陈词。
        
        你的任务不是修改语法，而是像“答辩评委”一样，无情地指出其中的逻辑漏洞。
        
        请遵循以下分析步骤：
        1. 识别核心论点和论据。
        2. 扫描逻辑谬误（如：以偏概全、强加因果、滑坡谬误、循环论证、稻草人谬误）。
        3. 检查边界条件（如：样本量是否足够？是否有幸存者偏差？）。

        请输出 3 到 4 个非常犀利、甚至带有挑战性的反问（Socratic Questioning），迫使学生重新思考他们的论证。

        用户输入内容：
        """${text}"""

        【输出格式要求】
        必须严格返回标准的 JSON 格式，不要包含 Markdown 标记（如 \`\`\`json），格式如下：
        {
            "questions": [
                "反问1：直击因果关系的漏洞...",
                "反问2：挑战数据来源或样本...",
                "反问3：提出极端情况下的假设..."
            ]
        }
        `;

        // 发送请求
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: systemPrompt }]
                }],
                generationConfig: {
                    temperature: 0.7, // 稍微有点创造性，不要太死板
                    response_mime_type: "application/json" // 强制 JSON
                }
            })
        });

        const data = await response.json();

        // 错误处理
        if (data.error) {
            console.error("Gemini API Error:", data.error);
            throw new Error(data.error.message);
        }

        // 解析结果
        const aiText = data.candidates[0].content.parts[0].text;
        const result = JSON.parse(aiText);

        return res.status(200).json(result);

    } catch (error) {
        console.error("Server Error:", error);
        return res.status(500).json({ 
            error: "逻辑分析模块过热，请稍后重试", 
            details: error.message 
        });
    }

}
