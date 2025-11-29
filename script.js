// script.js
document.addEventListener('DOMContentLoaded', () => {
    const elements = {
        input: document.getElementById('inputText'),
        btn: document.getElementById('submitBtn'),
        btnText: document.querySelector('#submitBtn .btn-text'),
        loader: document.querySelector('#submitBtn .loader'),
        emptyState: document.querySelector('.empty-state'),
        analysisContent: document.querySelector('.analysis-content'),
        
        // 结果相关
        scoreValue: document.getElementById('scoreValue'),
        sceneText: document.getElementById('sceneText'),
        sceneBadge: document.getElementById('sceneBadge'),
        critiquesList: document.getElementById('critiquesList'),
        revisedText: document.getElementById('revisedText'),
        
        // Tabs
        tabs: document.querySelectorAll('.tab-btn'),
        tabContents: document.querySelectorAll('.tab-content')
    };

    // 绑定提交事件
    elements.btn.addEventListener('click', handleSubmit);

    // 绑定 Tab 切换事件
    elements.tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // 移除所有 active
            elements.tabs.forEach(t => t.classList.remove('active'));
            elements.tabContents.forEach(c => c.classList.remove('active'));
            
            // 激活当前
            tab.classList.add('active');
            const targetId = `tab-${tab.dataset.tab}`;
            document.getElementById(targetId).classList.add('active');
        });
    });

    async function handleSubmit() {
        const text = elements.input.value.trim();
        if (text.length < 5) {
            alert('输入内容太少，Logic Auditor 无法分析。');
            return;
        }

        toggleLoading(true);

        try {
            const res = await fetch('/api/check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text })
            });

            const data = await res.json();

            if (!res.ok) throw new Error(data.error || 'Request failed');
            
            renderResult(data);
        } catch (error) {
            console.error(error);
            alert(`分析失败: ${error.message}`);
        } finally {
            toggleLoading(false);
        }
    }

    function toggleLoading(isLoading) {
        elements.btn.disabled = isLoading;
        if (isLoading) {
            elements.btnText.textContent = "Logic Auditor正在极速审计中...";
            elements.loader.style.display = 'block';
            elements.analysisContent.style.display = 'none';
        } else {
            elements.btnText.textContent = "开始逻辑审计";
            elements.loader.style.display = 'none';
        }
    }

    function renderResult(data) {
        elements.emptyState.style.display = 'none';
        elements.analysisContent.style.display = 'block';

        // 1. 基础信息
        elements.sceneBadge.textContent = data.scene || "未知场景";
        elements.sceneText.textContent = `场景识别：${data.scene}`;
        
        // 2. 评分动画与颜色
        const score = data.score || 0;
        elements.scoreValue.textContent = score;
        const scoreColor = score < 60 ? '#ff4d4f' : (score < 80 ? '#faad14' : '#52c41a');
        document.querySelector('.score-circle').style.backgroundColor = scoreColor;

        // 3. 渲染漏洞列表
        elements.critiquesList.innerHTML = '';
        data.critiques.forEach(item => {
            const li = document.createElement('li');
            li.className = 'critique-item';
            li.innerHTML = `
                <div class="q-issue">🚫 逻辑漏洞：${item.issue}</div>
                <div class="q-quote">“${item.quote}”</div>
                <div class="q-fix">💡 <b>修改建议：</b>${item.fix}</div>
            `;
            li.addEventListener('click', () => li.classList.toggle('expanded'));
            elements.critiquesList.appendChild(li);
        });

        // 4. 渲染重构文本
        // 后端返回的是带 <b> 标签的字符串，innerHTML 可以直接渲染高亮
        elements.revisedText.innerHTML = data.revised_text.replace(/\n/g, '<br>');

        // 自动切到第一个Tab
        elements.tabs[0].click();
    }
});

// 全局函数：复制文本
window.copyText = function() {
    const text = document.getElementById('revisedText').innerText;
    navigator.clipboard.writeText(text).then(() => {
        alert('重构内容已复制到剪贴板！');
    });
};
