document.addEventListener('DOMContentLoaded', () => {
    // 1. 获取元素引用
    const el = {
        input: document.getElementById('inputText'),
        btn: document.getElementById('submitBtn'),
        btnText: document.querySelector('.btn-text'),
        loader: document.querySelector('.loader'),
        charCount: document.querySelector('.char-count'), // 获取字数统计元素
        
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

    // 2. 实时字数统计监听
    el.input.addEventListener('input', () => {
        const len = el.input.value.length;
        if (len === 0) {
            el.charCount.textContent = '等待输入...';
            el.charCount.style.color = '#9ca3af'; // 灰色
        } else {
            el.charCount.textContent = `当前字数：${len}`;
            // 如果字数够多了，给个绿色鼓励一下
            el.charCount.style.color = len > 50 ? '#10b981' : '#6b7280';
        }
    });

    // 3. Tab 切换逻辑
    el.tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            el.tabs.forEach(t => t.classList.remove('active'));
            el.tabContents.forEach(c => c.classList.remove('active'));
            
            tab.classList.add('active');
            const contentId = `tab-${tab.dataset.tab}`;
            document.getElementById(contentId).classList.add('active');
        });
    });

    // 4. 提交逻辑
    el.btn.addEventListener('click', async () => {
        const text = el.input.value.trim();
        if (text.length < 5) { // 稍微放宽限制方便测试
            alert('输入内容太少，AI 无法进行逻辑分析（建议至少10个字）。');
            return;
        }

        // 设置加载状态
        setLoading(true);

        try {
            const response = await fetch('/api/check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text })
            });
            const data = await response.json();

            if (!response.ok) throw new Error(data.error || 'API Error');

            // 渲染结果
            renderDashboard(data);
            renderDetails(data);

        } catch (error) {
            console.error(error);
            alert(`分析出错: ${error.message}`);
            setLoading(false, true); 
        }
    });

    function setLoading(isLoading, isError = false) {
        if (isLoading) {
            el.btn.disabled = true;
            el.btnText.textContent = '深度分析中...';
            el.loader.style.display = 'block';
            
            // 仪表盘显示“分析中”状态
            el.resultState.style.display = 'none';
            el.statusState.style.display = 'flex';
            el.statusText.innerHTML = "📡 连接阿里云...<br>正在进行逻辑拆解...";
            
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
        
        // 简单的动画延时
        setTimeout(() => {
            el.scoreCircle.setAttribute('stroke-dasharray', `${score}, 100`);
            
            // 根据分数变色
            let color = '#ef4444'; // Red < 60
            if(score >= 60) color = '#f59e0b'; // Orange
            if(score >= 80) color = '#10b981'; // Green
            el.scoreCircle.style.stroke = color;
        }, 100);
        
        setLoading(false); 
    }

    function renderDetails(data) {
        // 1. 渲染漏洞列表
        el.critiquesList.innerHTML = '';
        if (data.critiques && data.critiques.length > 0) {
            data.critiques.forEach((item, index) => {
                const li = document.createElement('li');
                li.className = 'critique-item';
                li.innerHTML = `
                    <div class="q-issue">
                        <span>⚠️ 漏洞 ${index + 1}：</span>
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
        } else {
            el.critiquesList.innerHTML = '<li style="padding:20px;text-align:center;color:#666;">🎉 完美！未发现明显逻辑漏洞。</li>';
        }

        // 2. 渲染重构文
        if (data.revised_text) {
            el.revisedText.innerHTML = data.revised_text.replace(/\n/g, '<br>');
        }
        
        // 默认点击第一个Tab
        el.tabs[0].click();
    }
});

// 全局复制函数
window.copyText = function() {
    const text = document.getElementById('revisedText').innerText;
    navigator.clipboard.writeText(text).then(() => alert('已复制到剪贴板'));
}
