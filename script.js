// script.js
document.addEventListener('DOMContentLoaded', () => {
    const el = {
        input: document.getElementById('inputText'),
        btn: document.getElementById('submitBtn'),
        btnText: document.querySelector('.btn-text'),
        loader: document.querySelector('.loader'),
        charCount: document.querySelector('.char-count'),
        statusState: document.getElementById('statusState'),
        resultState: document.getElementById('resultState'),
        statusText: document.getElementById('statusText'),
        scoreCircle: document.querySelector('.circle'),
        scoreText: document.querySelector('.percentage'),
        sceneResult: document.getElementById('sceneResult'),
        issueCount: document.getElementById('issueCount'),
        thoughtTrace: document.getElementById('thoughtTrace'), // 新增
        detailsSection: document.getElementById('detailsSection'),
        critiquesList: document.getElementById('critiquesList'),
        revisedText: document.getElementById('revisedText'),
        tabs: document.querySelectorAll('.tab-btn'),
        tabContents: document.querySelectorAll('.tab-content'),
        pdfInput: document.getElementById('pdfUpload') // 新增
    };

    // --- PDF 处理逻辑 (前端解析) ---
    el.pdfInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.type !== 'application/pdf') { alert('请上传 PDF 格式文件'); return; }

        el.input.value = "📄 正在解析 PDF 文件结构，请稍候...";
        el.input.disabled = true;
        el.btn.disabled = true;

        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
            
            let fullText = "";
            // 限制前5页，防止Demo时间过长
            const maxPages = Math.min(pdf.numPages, 5);
            
            for (let i = 1; i <= maxPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const pageText = textContent.items.map(item => item.str).join(' ');
                fullText += `[第${i}页] ` + pageText + "\n\n";
            }
            
            el.input.value = fullText;
            el.input.disabled = false;
            el.btn.disabled = false;
            el.charCount.textContent = `已解析 PDF (前${maxPages}页), 字数: ${fullText.length}`;
            el.charCount.style.color = '#10b981';

        } catch (error) {
            console.error(error);
            alert("PDF 解析失败，可能是加密文档或纯图片扫描件。");
            el.input.value = "";
            el.input.disabled = false;
            el.btn.disabled = false;
        }
    });

    // 字数监听
    el.input.addEventListener('input', () => {
        const len = el.input.value.length;
        el.charCount.textContent = len === 0 ? 'Ready' : `当前字数：${len}`;
        el.charCount.style.color = len > 50 ? '#10b981' : '#6b7280';
    });

    // Tab 切换
    el.tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            el.tabs.forEach(t => t.classList.remove('active'));
            el.tabContents.forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
        });
    });

    // --- 模拟思考过程动画 (增强演示效果) ---
    async function simulateProcess() {
        const steps = [
            "🔍 正在进行文本分类 (Classifier)...",
            "📚 识别到特定场景，正在路由知识库...",
            "⚖️ 加载 GB/T 7713 及创赛评分细则...",
            "⚔️ 启动红蓝对抗 (Red Teaming) 审计...",
            "📝 正在进行防御性重构与数据校验..."
        ];
        
        for (let i = 0; i < steps.length; i++) {
            if (!el.btn.disabled) break; // 如果已经返回了，停止动画
            el.statusText.innerHTML = steps[i];
            // 每个步骤停留 800ms 到 1.5s
            await new Promise(r => setTimeout(r, 1000));
        }
    }

    // 提交逻辑
    el.btn.addEventListener('click', async () => {
        const text = el.input.value.trim();
        if (text.length < 5) {
            alert('内容太少，Agent无法分析。');
            return;
        }

        setLoading(true);
        // 并行运行动画和请求
        const animationPromise = simulateProcess();

        try {
            const response = await fetch('/api/check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text })
            });
            const data = await response.json();

            if (!response.ok) throw new Error(data.error || 'API Error');

            await animationPromise; // 确保动画至少走一点
            renderDashboard(data);
            renderDetails(data);

        } catch (error) {
            console.error(error);
            alert(`修正中断: ${error.message}`);
            setLoading(false, true); 
        }
    });

    function setLoading(isLoading, isError = false) {
        if (isLoading) {
            el.btn.disabled = true;
            el.btnText.textContent = '智能修正中...';
            el.loader.style.display = 'block';
            el.resultState.style.display = 'none';
            el.statusState.style.display = 'flex';
            el.detailsSection.style.display = 'none';
        } else {
            el.btn.disabled = false;
            el.btnText.textContent = '开始逻辑修正';
            el.loader.style.display = 'none';
            if (isError) el.statusText.textContent = "❌ 系统连接超时";
        }
    }

    function renderDashboard(data) {
        el.statusState.style.display = 'none';
        el.resultState.style.display = 'flex';
        el.detailsSection.style.display = 'block';

        el.sceneResult.textContent = data.scene || '通用';
        el.issueCount.textContent = data.critiques ? data.critiques.length : 0;
        
        // 渲染思维链
        if(el.thoughtTrace) {
            el.thoughtTrace.textContent = data.logic_thought_trace || "深度逻辑扫描完成";
        }

        const score = data.score || 0;
        el.scoreText.textContent = score;
        
        setTimeout(() => {
            el.scoreCircle.setAttribute('stroke-dasharray', `${score}, 100`);
            let color = '#ef4444';
            if(score >= 60) color = '#f59e0b';
            if(score >= 80) color = '#10b981';
            el.scoreCircle.style.stroke = color;
        }, 100);
    }

    function renderDetails(data) {
        el.critiquesList.innerHTML = '';
        if (data.critiques && data.critiques.length > 0) {
            data.critiques.forEach((item, index) => {
                const li = document.createElement('li');
                li.className = 'critique-item';
                // 重点：显示 rule_ref
                const ruleTag = item.rule_ref ? `<div class="rule-ref">📖 ${item.rule_ref}</div>` : '';
                
                li.innerHTML = `
                    <div class="q-issue"><span>⚠️ 漏洞 ${index + 1}</span> ${item.issue}</div>
                    ${ruleTag}
                    <div class="q-quote">“${item.quote}”</div>
                    <div class="q-fix"><strong>💡 修正建议：</strong><p>${item.fix}</p></div>
                `;
                li.addEventListener('click', () => {
                    li.classList.toggle('expanded');
                });
                el.critiquesList.appendChild(li);
            });
        } else {
            el.critiquesList.innerHTML = '<li style="padding:20px;text-align:center;color:#666;">🎉 完美逻辑！符合专家知识库标准。</li>';
        }

        if (data.revised_text) {
            el.revisedText.innerHTML = data.revised_text.replace(/\n/g, '<br>');
        }
        el.tabs[0].click();
    }
});

window.copyText = function() {
    const text = document.getElementById('revisedText').innerText;
    navigator.clipboard.writeText(text).then(() => alert('已复制修正稿'));
}
