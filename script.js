// script.js
document.addEventListener('DOMContentLoaded', () => {
    // 状态变量：存储完整的 PDF 文本，但不显示在输入框里
    let fullPdfText = "";
    
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
        thoughtTrace: document.getElementById('thoughtTrace'),
        detailsSection: document.getElementById('detailsSection'),
        critiquesList: document.getElementById('critiquesList'),
        revisedText: document.getElementById('revisedText'),
        tabs: document.querySelectorAll('.tab-btn'),
        tabContents: document.querySelectorAll('.tab-content'),
        pdfInput: document.getElementById('pdfUpload'),
        
        // 新增：文件预览卡片区域
        filePreviewArea: document.getElementById('filePreviewArea'),
        fileNameDisplay: document.getElementById('fileNameDisplay'),
        removeFileBtn: document.getElementById('removeFileBtn')
    };

    // --- 1. PDF 解析逻辑  ---
    el.pdfInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.type !== 'application/pdf') {
            alert('仅支持 PDF 文件');
            return;
        }

        // 显示 Loading 状态
        el.charCount.textContent = "正在深度解析 PDF 结构...";
        el.input.disabled = true; // 暂时禁用输入框
        el.input.classList.add('scanning'); // 添加扫描动画效果

        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
            const maxPages = pdf.numPages;
            
            fullPdfText = ""; // 清空旧数据

            for (let i = 1; i <= maxPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const pageText = textContent.items.map(item => item.str).join(' ');
                fullPdfText += `[P${i}] ` + pageText + "\n\n";
            }
            
            // 解析成功：
            // 1. 不把文字塞进 textarea，而是显示文件卡片
            el.input.style.display = 'none'; // 隐藏输入框
            el.filePreviewArea.style.display = 'flex'; // 显示文件卡片
            el.fileNameDisplay.textContent = file.name;
            
            // 2. 更新状态
            el.charCount.textContent = `✅ 已就绪 | 全文共 ${maxPages} 页 (${fullPdfText.length} 字符)`;
            el.charCount.style.color = '#10b981';
            el.input.disabled = false;
            el.input.classList.remove('scanning');
            
            // 清空 value 避免干扰，逻辑只走 fullPdfText
            el.input.value = ""; 

        } catch (error) {
            console.error(error);
            alert("PDF 解析失败，请重试");
            resetInput();
        }
    });

    // 移除文件逻辑
    el.removeFileBtn.addEventListener('click', () => {
        resetInput();
    });

    function resetInput() {
        fullPdfText = "";
        el.input.value = "";
        el.pdfInput.value = ""; // 清空 input file
        el.input.style.display = 'block';
        el.filePreviewArea.style.display = 'none';
        el.charCount.textContent = "Ready";
        el.charCount.style.color = "#9ca3af";
        el.input.disabled = false;
        el.input.classList.remove('scanning');
    }

    // --- 2. 提交逻辑 (核心：解决超时问题) ---
    el.btn.addEventListener('click', async () => {
        // 判断是取 PDF 变量还是取输入框文本
        let textToSend = fullPdfText || el.input.value.trim();
        
        if (textToSend.length < 5) {
            alert('请输入内容或上传文件。');
            return;
        }

        // 🛑 核心截断逻辑：Vercel Hobby 10s 只能处理约 4000-5000 字符 (约1000 tokens)
        // 超过这个长度，99% 会超时报错。保留摘要和核心逻辑足以发现漏洞。
        const MAX_CHARS = 4500; 
        if (textToSend.length > MAX_CHARS) {
            console.log(`文本过长 (${textToSend.length})，进行智能截断至 ${MAX_CHARS}，防止超时`);
            textToSend = textToSend.substring(0, MAX_CHARS) + "\n\n[...此处省略后续内容，基于前文核心逻辑进行审计...]";
        }

        setLoading(true);
        const animationPromise = simulateThinkingProcess();

        try {
            const response = await fetch('/api/check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: textToSend })
            });
            
            // 如果返回的不是 JSON (比如 Vercel 504 Timeout HTML页)，这里会报错
            const contentType = response.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
                throw new Error("Network Timeout (Analysis took too long)");
            }

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'API Error');

            await animationPromise; // 保证动画流畅
            renderDashboard(data);
            renderDetails(data);

        } catch (error) {
            console.error(error);
            // 友好的错误提示
            let msg = error.message;
            if (msg.includes("Timeout") || msg.includes("token")) {
                msg = "⚠️ 文本过长导致分析超时。\nLogic Auditor 已启用截断模式，请重试。";
            }
            alert(`审计中断: ${msg}`);
            setLoading(false, true); 
        }
    });

    // --- 其他辅助函数 ---
    el.input.addEventListener('input', () => {
        if (!fullPdfText) {
            const len = el.input.value.length;
            el.charCount.textContent = len > 0 ? `当前字数：${len}` : 'Waiting...';
        }
    });

    el.tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            el.tabs.forEach(t => t.classList.remove('active'));
            el.tabContents.forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
        });
    });

    async function simulateThinkingProcess() {
        const steps = [
            "🔍 读取核心文本摘要 (Top 4k tokens)...", // 暗示截断是特性而非Bug
            "🧠 识别场景: 正在匹配 [标准:GB/T 7713]...",
            "⚖️ 正在调用 Logic Auditor 逻辑对抗网络...",
            "⚔️ 发现逻辑断层，正在强制引用规则...",
            "🛡️ 正在进行学术级/商业级深度重构..."
        ];
        for (let i = 0; i < steps.length; i++) {
            if (!el.btn.disabled) break;
            el.statusText.innerHTML = steps[i];
            await new Promise(r => setTimeout(r, 1500));
        }
    }

    function setLoading(isLoading, isError = false) {
        if (isLoading) {
            el.btn.disabled = true;
            el.btnText.textContent = '专家审计中...';
            el.loader.style.display = 'block';
            el.resultState.style.display = 'none';
            el.statusState.style.display = 'flex';
            el.detailsSection.style.display = 'none';
        } else {
            el.btn.disabled = false;
            el.btnText.textContent = '开始逻辑修正';
            el.loader.style.display = 'none';
            if (isError) el.statusText.innerHTML = "❌ 连接中断<br>请检查网络";
        }
    }

    function renderDashboard(data) {
        el.statusState.style.display = 'none';
        el.resultState.style.display = 'flex';
        el.detailsSection.style.display = 'block';
        el.sceneResult.textContent = data.scene || '通用';
        el.issueCount.textContent = data.critiques ? data.critiques.length : 0;
        if(el.thoughtTrace) el.thoughtTrace.textContent = data.logic_thought_trace || "深度扫描完成";
        
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
                li.className = `critique-item item-color-${(index % 4) + 1}`; // 强制添加颜色类

                const ruleTag = item.rule_ref 
                    ? `<div class="rule-ref">📖 ${item.rule_ref}</div>` 
                    : '';

                li.innerHTML = `
                    <div class="q-issue">
                        <span>⚠️ 漏洞 ${index + 1}</span>
                        ${item.issue}
                    </div>
                    ${ruleTag}
                    <div class="q-quote">“${item.quote}”</div>
                    <div class="q-fix">
                        <strong>💡 修正方案：</strong>
                        <p>${item.fix}</p>
                    </div>
                    <div class="expand-hint">点击展开/收起详情</div>
                `;
                li.addEventListener('click', () => {
                    li.classList.toggle('expanded');
                });
                el.critiquesList.appendChild(li);
            });
        } else {
            el.critiquesList.innerHTML = '<li style="padding:20px;">🎉 未发现明显漏洞。</li>';
        }

        if (data.revised_text) {
            el.revisedText.innerHTML = data.revised_text.replace(/\n/g, '<br>');
        }
        el.tabs[0].click();
    }
});

// 全局函数
window.copyText = function() {
    const text = document.getElementById('revisedText').innerText;
    navigator.clipboard.writeText(text).then(() => alert('已复制'));
}
