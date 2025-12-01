document.addEventListener('DOMContentLoaded', () => {
    let fullPdfText = "";
    
    // DOM 元素获取 
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
        filePreviewArea: document.getElementById('filePreviewArea'),
        fileNameDisplay: document.getElementById('fileNameDisplay'),
        removeFileBtn: document.getElementById('removeFileBtn')
    };

    // 1. PDF 解析逻辑 
    el.pdfInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.type !== 'application/pdf') { alert('仅支持 PDF'); return; }

        el.input.disabled = true;
        el.charCount.textContent = "解析 PDF 结构中...";
        
        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
            fullPdfText = "";
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                fullPdfText += textContent.items.map(item => item.str).join(' ') + "\n\n";
            }
            
            el.input.style.display = 'none';
            el.filePreviewArea.style.display = 'flex';
            el.fileNameDisplay.textContent = file.name;
            el.charCount.textContent = `✅ 共 ${pdf.numPages} 页 (${fullPdfText.length} 字符)`;
            el.charCount.style.color = '#10b981';
            el.input.value = ""; 
        } catch (err) {
            console.error(err);
            alert("PDF 解析失败");
            resetInput();
        } finally {
            el.input.disabled = false;
        }
    });

    el.removeFileBtn.addEventListener('click', resetInput);
    function resetInput() {
        fullPdfText = "";
        el.input.value = "";
        el.input.style.display = 'block';
        el.filePreviewArea.style.display = 'none';
        el.charCount.textContent = "Ready";
    }

    // 🔥 2. 核心分片处理逻辑
    el.btn.addEventListener('click', async () => {
        const textToProcess = fullPdfText || el.input.value.trim();
        if (textToProcess.length < 10) return alert("内容太少");

        // 如果这已经是第二次运行，先清空上一次的结果显示，避免视觉混乱
        if (el.resultState.style.display === 'flex') {
             el.resultState.style.display = 'none';
             el.statusState.style.display = 'flex';
             el.statusText.innerHTML = "♻️ 正在初始化 Logic Auditor 核心...";
        }
        
        setLoading(true);

        // A. 切片：每 2500 字符一片（安全不超时）
        const CHUNK_SIZE = 2500;
        const chunks = [];
        for (let i = 0; i < textToProcess.length; i += CHUNK_SIZE) {
            chunks.push(textToProcess.substring(i, i + CHUNK_SIZE));
        }

        const totalChunks = chunks.length;
        el.statusText.innerHTML = `检测到 ${textToProcess.length} 字<br>已智能拆分为 ${totalChunks} 个逻辑分卷处理...`;

        // B. 结果容器
        let mergedRevisedText = "";
        let allCritiques = [];
        let totalScore = 0;

        try {
            // C. 串行处理每一片 (避免并发把服务器打挂)
            for (let i = 0; i < totalChunks; i++) {
                // 更新进度 UI
                const progress = Math.round(((i) / totalChunks) * 100);
                el.btnText.textContent = `处理进度 ${progress}%`;
                el.statusText.innerHTML = `⚙️ 正在深度分析第 ${i+1}/${totalChunks} 卷...<br>调用知识库校验逻辑闭环...`;

                const chunk = chunks[i];
                
                // 发送请求
                const response = await fetch('/api/check', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        text: chunk, 
                        chunkIndex: i, 
                        totalChunks: totalChunks 
                    })
                });
                
                if (!response.ok) throw new Error("Network Error");
                const result = await response.json();

                // D. 聚合结果
                if (result.critiques) allCritiques = [...allCritiques, ...result.critiques];
                // 拼接重构文（加换行）
                mergedRevisedText += (result.revised_text || chunk) + "\n\n";
                // 累加分数
                totalScore += (result.score || 0);
            }

            // E. 计算最终平均分
            const finalScore = Math.round(totalScore / totalChunks);

            // F. 渲染最终大结果
            renderDashboard({
                scene: detectScenario(textToProcess),
                score: finalScore,
                critiques: allCritiques,
                revised_text: mergedRevisedText,
                logic_thought_trace: `✅ 已完成全文档 ${totalChunks} 卷深度扫描，共检出 ${allCritiques.length} 处逻辑断层。`
            });
            
            renderDetails({
                critiques: allCritiques,
                revised_text: mergedRevisedText
            });

            // 流程结束后，释放按钮，允许下一次操作
            el.btn.disabled = false;
            el.btnText.textContent = "开始新一轮审计"; // 变成重试文案
            el.loader.style.display = 'none';
            

        } catch (error) {
            console.error(error);
            alert("审计中断：请检查网络连接");
            setLoading(false, true);
        }
    });

    // 辅助函数
    function detectScenario(t) {
        if(t.includes("市场") || t.includes("盈利")) return "商业计划书";
        if(t.includes("论文") || t.includes("研究")) return "学术论文";
        return "通用文本";
    }

    function setLoading(isLoading, isError) {
        if (isLoading) {
            el.btn.disabled = true;
            el.loader.style.display = 'block';
            el.resultState.style.display = 'none';
            el.statusState.style.display = 'flex';
            el.detailsSection.style.display = 'none';
        } else {
            el.btn.disabled = false;
            el.btnText.textContent = '开始逻辑修正';
            el.loader.style.display = 'none';
            if (isError) el.statusText.innerHTML = "❌ 中断";
        }
    }

    function renderDashboard(data) {
        el.statusState.style.display = 'none';
        el.resultState.style.display = 'flex';
        el.detailsSection.style.display = 'block';
        el.sceneResult.textContent = data.scene;
        el.issueCount.textContent = data.critiques.length;
        if(el.thoughtTrace) el.thoughtTrace.textContent = data.logic_thought_trace;
        el.scoreText.textContent = data.score;
        setTimeout(() => el.scoreCircle.setAttribute('stroke-dasharray', `${data.score}, 100`), 100);
    }

    // 渲染详情（包含点击展开逻辑）
    function renderDetails(data) {
        el.critiquesList.innerHTML = '';
        data.critiques.forEach((item, index) => {
            const li = document.createElement('li');
            li.className = `critique-item item-color-${(index % 4) + 1}`;
            
            // 构建HTML结构
            li.innerHTML = `
                <div class="c-header">
                    <span class="c-index">#${index + 1}</span>
                    <span class="c-title">${item.issue}</span>
                </div>
                
                <div class="c-body">
                    ${item.rule_ref ? `<div class="c-rule">⚖️ ${item.rule_ref}</div>` : ''}
                    <div class="c-quote">“${item.quote}”</div>
                    <div class="c-fix-wrapper">
                        <div class="c-fix-label">💡 修正建议：</div>
                        <div class="c-fix-content">${item.fix}</div>
                    </div>
                </div>
                <div class="c-footer">点击展开详情</div>
            `;
            
            li.addEventListener('click', () => li.classList.toggle('expanded'));
            el.critiquesList.appendChild(li);
        });
        
        if (data.revised_text) {
            el.revisedText.innerHTML = data.revised_text.replace(/\n/g, '<br>');
        }
        el.tabs[0].click();
    }
    
    // Tab 切换逻辑
    el.tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            el.tabs.forEach(t => t.classList.remove('active'));
            el.tabContents.forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
        });
    });

    window.copyText = function() {
        navigator.clipboard.writeText(document.getElementById('revisedText').innerText).then(() => alert('已复制'));
    }
});

