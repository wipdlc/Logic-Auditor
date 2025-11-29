// 文件路径: script.js
document.addEventListener('DOMContentLoaded', () => {
    // 获取所有需要的元素
    const btn = document.getElementById('submitBtn');
    const input = document.getElementById('inputText');
    const list = document.getElementById('questionsList');
    const status = document.getElementById('statusMessage');
    const sceneResult = document.getElementById('sceneResult'); // 假设 HTML 里有这个元素

    // 主函数：处理点击事件
    btn.addEventListener('click', async () => {
        const text = input.value.trim();
        if (text.length < 10) {
            alert("请至少输入一句话（10个字以上）");
            return;
        }

        // --- 1. 进入加载状态 ---
        setLoadingState(true);

        try {
            // --- 2. 发送请求 ---
            const response = await fetch('/api/check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text })
            });

            const data = await response.json();

            // --- 3. 处理错误 ---
            if (!response.ok || data.error) {
                // 如果后端返回了明确的错误信息
                throw new Error(data.details || data.error || '未知的服务器错误');
            }
            
            // --- 4. 渲染成功结果 ---
            renderSuccess(data);

        } catch (error) {
            // --- 5. 渲染失败结果 ---
            console.error("Fetch Error:", error);
            renderError(error.message);

        } finally {
            // --- 6. 无论成功失败，都退出加载状态 ---
            setLoadingState(false);
        }
    });

    // --- 辅助函数：设置加载状态 ---
    function setLoadingState(isLoading) {
        if (isLoading) {
            btn.disabled = true;
            btn.innerText = "⚡ AI 正在深度分析中...";
            status.style.display = 'block';
            status.textContent = "正在连接云端大脑...";
            status.style.color = "#666"; // 重置颜色
            list.innerHTML = '';
            if(sceneResult) sceneResult.style.display = 'none';
        } else {
            btn.disabled = false;
            btn.innerText = "⚔️ 提交给 AI 教授拷问 ⚔️";
            status.style.display = 'none';
        }
    }

    // --- 辅助函数：渲染成功 ---
    function renderSuccess(data) {
        if (data.detected_scene && sceneResult) {
            sceneResult.innerHTML = `AI 已识别场景：<strong>${data.detected_scene}</strong>`;
            sceneResult.style.display = 'block';
        }
        
        data.critiques.forEach(item => {
            const card = document.createElement('li');
            card.className = 'critique-card';
            card.innerHTML = `
                <div class="question">❓ ${item.question}</div>
                <div class="suggestion"><p>💡 <strong>建议：</strong>${item.suggestion}</p></div>
            `;
            list.appendChild(card);

            card.addEventListener('click', () => {
                card.classList.toggle('expanded');
            });
        });
    }

    // --- 辅助函数：渲染错误 ---
    function renderError(message) {
        status.textContent = `❌ 分析失败: ${message}`;
        status.style.color = "red";
        status.style.display = 'block';
    }
});
