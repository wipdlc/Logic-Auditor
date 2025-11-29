document.addEventListener('DOMContentLoaded', () => {
    // 元素引用
    const el = {
        input: document.getElementById('inputText'),
        btn: document.getElementById('submitBtn'),
        btnText: document.querySelector('.btn-text'),
        loader: document.querySelector('.loader'),
        
        // 状态面板
        statusState: document.getElementById('statusState'),
        resultState: document.getElementById('resultState'),
        statusText: document.getElementById('statusText'),
        
        // 结果展示字段
        scoreCircle: document.querySelector('.circle'),
        scoreText: document.querySelector('.percentage'),
        sceneResult: document.getElementById('sceneResult'),
        issueCount: document.getElementById('issueCount'),
        
        // 下半部分
        detailsSection: document.getElementById('detailsSection'),
        critiquesList: document.getElementById('critiquesList'),
        revisedText: document.getElementById('revisedText'),
        
        tabs: document.querySelectorAll('.tab-btn'),
        tabContents: document.querySelectorAll('.tab-content')
    };

    // Tab 切换逻辑
    el.tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            el.tabs.forEach(t => t.classList.remove('active'));
            el.tabContents.forEach(c => c.classList.remove('active'));
            
            tab.classList.add('active');
            const contentId = `tab-${tab.dataset.tab}`;
            document.getElementById(contentId).classList.add('active');
        });
    });

    // 提交逻辑
    el.btn.addEventListener('click', async () => {
        const text = el.input.value.trim();
        if (text.length < 10) {
            alert('输入内容太少，请至少输入 10 个字。');
            return;
        }

        // 1. 设置加载状态
        setLoading(true);

        try {
            // 2. 请求 API
            const response = await fetch('/api/check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text })
            });
            const data = await response.json();

            if (!response.ok) throw new Error(data.error || 'API Error');

            // 3. 渲染结果
            renderDashboard(data);
            renderDetails(data);

        } catch (error) {
            console.error(error);
            alert(`分析出错: ${error.message}`);
            // 出错时恢复待机状态
            setLoading(false, true); 
        }
    });

    function setLoading(isLoading, isError = false) {
        if (isLoading) {
            el.btn.disabled = true;
            el.btnText.textContent = '修正进行中...';
            el.loader.style.display = 'block';
            
            // 仪表盘显示“分析中”状态
            el.resultState.style.display = 'none';
            el.statusState.style.display = 'flex';
            el.statusText.innerHTML = "📡 正在连接阿里云...<br>正在进行逻辑拆解...";
            
            // 隐藏下半部分
            el.detailsSection.style.display = 'none';
        } else {
            el.btn.disabled = false;
            el.btnText.textContent = '开始逻辑修正';
            el.loader.style.display = 'none';
            
            if (isError) {
                el.statusText.textContent = "❌ 分析中断，请重试";
            }
        }
    }

    function renderDashboard(data) {
        // 切换右上角面板
        el.statusState.style.display = 'none';
        el.resultState.style.display = 'flex';
        
        // 动画显示下半部分
        el.detailsSection.style.display = 'block';

        // 1. 场景与数量
        el.sceneResult.textContent = data.scene || '通用文段';
        el.issueCount.textContent = `${data.critiques.length} 个`;

        // 2. 评分圆环动画
        const score = data.score || 0;
        el.scoreText.textContent = score;
        
        // 计算 SVG stroke-dasharray (0, 100) -> (score, 100)
        // 注意：stroke-dasharray="current, total" 
        // 这里简化直接改 CSS 变量或者直接设属性
        setTimeout(() => {
            el.scoreCircle.setAttribute('stroke-dasharray', `${score}, 100`);
            // 根据分数变色
            let color = '#ef4444'; // Red
            if(score > 60) color = '#f59e0b'; // Orange
            if(score > 80) color = '#22c55e'; // Green
            el.scoreCircle.style.stroke = color;
        }, 100);
        
        setLoading(false); // 恢复按钮
    }

    function renderDetails(data) {
        // 1. 渲染漏洞列表
        el.critiquesList.innerHTML = '';
        data.critiques.forEach((item, index) => {
            const li = document.createElement('li');
            li.className = 'critique-item';
            // 添加标题，用 index 让 nth-child 生效
            li.innerHTML = `
                <div class="q-issue">
                    <span>⚠️ 逻辑漏洞 ${index + 1}：</span>
                    ${item.issue}
                </div>
                <div class="q-quote">“${item.quote}”</div>
                <div class="q-fix">
                    <strong>💡 修复建议：</strong>
                    <p>${item.fix}</p>
                </div>
                <div style="text-align:right; font-size:0.8rem; color:#999; margin-top:5px;">点击展开详情 ▼</div>
            `;
            
            li.addEventListener('click', () => {
                li.classList.toggle('expanded');
                const hint = li.querySelector('div[style*="text-align:right"]');
                hint.textContent = li.classList.contains('expanded') ? '收起详情 ▲' : '点击展开详情 ▼';
            });
            el.critiquesList.appendChild(li);
        });

        // 2. 渲染重构文
        // 替换换行符并保留 <b>
        if (data.revised_text) {
            el.revisedText.innerHTML = data.revised_text.replace(/\n/g, '<br>');
        }
        
        // 默认点击第一个Tab
        el.tabs[0].click();
    }
});

window.copyText = function() {
    const text = document.getElementById('revisedText').innerText;
    navigator.clipboard.writeText(text).then(() => alert('已复制到剪贴板'));
}
