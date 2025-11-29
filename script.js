// 文件路径: script.js
document.addEventListener('DOMContentLoaded', () => {
    const submitBtn = document.getElementById('submitBtn');
    const inputText = document.getElementById('inputText');
    const questionsList = document.getElementById('questionsList');
    const statusMessage = document.getElementById('statusMessage');

    submitBtn.addEventListener('click', async () => {
        const text = inputText.value.trim();
        if (text.length < 10) return alert("请至少输入一句话（10个字以上）");

        // 1. 状态锁定
        submitBtn.disabled = true;
        submitBtn.innerHTML = "⚡Logic Auditor正在进行逻辑研究..."; // 更有科技感的文案
        statusMessage.style.display = 'block';
        statusMessage.textContent = "正在连接阿里云算力中心...";
        questionsList.innerHTML = '';

        try {
            // 2. 请求后端
            const response = await fetch('/api/check', {
                method: 'POST',
                body: JSON.stringify({ text: text })
            });

            const data = await response.json();

            if (!response.ok) throw new Error(data.details || '请求失败');

            // 3. 结果展示
            statusMessage.style.display = 'none';
            
            data.questions.forEach((q, index) => {
                const li = document.createElement('li');
                li.textContent = q;
                li.style.opacity = 0;
                li.style.transform = "translateX(-20px)"; // 从左侧飞入
                questionsList.appendChild(li);

                // 逐条显示的动画
                setTimeout(() => {
                    li.style.transition = "all 0.5s ease";
                    li.style.opacity = 1;
                    li.style.transform = "translateX(0)";
                }, index * 200);
            });

        } catch (error) {
            console.error(error);
            statusMessage.textContent = "❌ 分析失败: " + error.message;
            statusMessage.style.color = "red";
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = "⚔️ 提交给Logic Auditor教授拷问 ⚔️";
        }
    });

});
