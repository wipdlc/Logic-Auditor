// 文件路径: script.js (最终交互版)
document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('submitBtn');
    const input = document.getElementById('inputText');
    const list = document.getElementById('questionsList');
    const status = document.getElementById('statusMessage');
    const sceneResult = document.getElementById('sceneResult');

    btn.addEventListener('click', async () => {
        const text = input.value.trim();
        if (text.length < 10) return alert("请至少输入一句话！");

        // 1. 锁定界面
        btn.disabled = true;
        btn.innerText = "⚡ Logic Auditor正在深度分析中...";
        status.style.display = 'block';
        sceneResult.style.display = 'none';
        list.innerHTML = '';

        try {
            // 2. 请求后端
            const res = await fetch('/api/check', {
                method: 'POST',
                body: JSON.stringify({ text })
            });
            const data = await res.json();
            if (data.error) throw new Error(data.details || '服务出错');

            // 3. 渲染场景和问题卡片
            status.style.display = 'none';
            
            // 显示识别出的场景
            sceneResult.innerHTML = `AI 已识别场景：<strong>${data.detected_scene}</strong>`;
            sceneResult.style.display = 'block';

            data.critiques.forEach(item => {
                // 创建卡片结构
                const card = document.createElement('li');
                card.className = 'critique-card';
                
                const questionDiv = document.createElement('div');
                questionDiv.className = 'question';
                questionDiv.textContent = `❓ ${item.question}`;
                
                const suggestionDiv = document.createElement('div');
                suggestionDiv.className = 'suggestion';
                suggestionDiv.innerHTML = `<p>💡 <strong>建议：</strong>${item.suggestion}</p>`;

                card.appendChild(questionDiv);
                card.appendChild(suggestionDiv);
                list.appendChild(card);

                // 4. 为每个卡片添加点击事件
                card.addEventListener('click', () => {
                    card.classList.toggle('expanded');
                });
            });

        } catch (e) {
            status.textContent = "❌ 错误: " + e.message;
            status.style.color = "red";
        } finally {
            btn.disabled = false;
            btn.innerText = "⚔️ 提交给Logic Auditor ⚔️";
        }
    });
});
