// script.js
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

    // --- 辅助函数：智能去重 ---
    function isDuplicateCritique(newItem, existingList) {
        return existingList.some(oldItem => {
            // 1. 如果 issue 标题完全相同，视为重复
            if (oldItem.issue === newItem.issue) return true;
            
            // 2. 如果 rule_ref 相同，且引用原文高度重叠，视为重复
            if (oldItem.rule_ref === newItem.rule_ref) {
                const q1 = oldItem.quote.trim();
                const q2 = newItem.quote.trim();
                // 检查是否包含关系 (处理切片截断导致的长短不一)
                if (q1.includes(q2) || q2.includes(q1)) return true;
            }
            return false;
        });
    }

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
                // 简单的空格连接，保留一定的原始格式
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

        // UI 状态重置
        if (el.resultState.style.display === 'flex') {
             el.resultState.style.display = 'none';
             el.statusState.style.display = 'flex';
             el.statusText.innerHTML = "♻️ 正在初始化 Logic Auditor 核心...";
        }
        
        setLoading(true);

        // A. 微切片策略 (Micro-Slicing)
        // 800字符一片，确保 Vercel 10s 不超时，且 AI 能穷尽检查
        const CHUNK_SIZE = 800;
        // 100字符重叠，防止逻辑在切口处断裂
        const OVERLAP = 100;
        
        const chunks = [];
        for (let i = 0; i < textToProcess.length; i += (CHUNK_SIZE - OVERLAP)) {
            let end = Math.min(i + CHUNK_SIZE, textToProcess.length);
            chunks.push(textToProcess.substring(i, end));
            // 避免最后一片只有 overlap
            if (end >= textToProcess.length) break;
        }

        const totalChunks = chunks.length;
        el.statusText.innerHTML = `检测到 ${textToProcess.length} 字<br>已拆分为 ${totalChunks} 个逻辑微卷，正在进行饱和式审计...`;

        // B. 结果容器
        let mergedRevisedText = "";
        let allCritiques = [];
        let totalScore = 0;
        let successCount = 0; // 记录有效的评分次数

        try {
            // C. 串行处理 (Series Processing)
            for (let i = 0; i < totalChunks; i++) {
                const progress = Math.round(((i) / totalChunks) * 100);
                el.btnText.textContent = `深度审计中 ${progress}%`;
                el.statusText.innerHTML = `⚙️ 正在审计第 ${i+1}/${totalChunks} 卷...<br>调用规则库比对逻辑漏洞...`;

                const chunk = chunks[i];
                
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

                // D. 结果聚合
                
                // 1. 分数聚合 (忽略出错的 0 分)
                if (result.score > 0) {
                    totalScore += result.score;
                    successCount++;
                }

                // 2. 批判项聚合 & 去重
                if (result.critiques && Array.isArray(result.critiques)) {
                    result.critiques.forEach(newC => {
                        // 前端抗噪：过滤掉极短的引用 (如 OCR 残留的页码 '12' 或 '图1')
                        if (!newC.quote || newC.quote.length < 4) return;
                        
                        // 智能去重
                        if (!isDuplicateCritique(newC, allCritiques)) {
                            allCritiques.push(newC);
                        }
                    });
                }
                
                // 3. 文本聚合
                // 直接拼接重构文 (Overlap 部分为了展示流畅性暂不做复杂去重，直接追加)
                mergedRevisedText += (result.revised_text || chunk) + "\n\n";
            }

            // E. 计算最终结果
            const finalScore = successCount > 0 ? Math.round(totalScore / successCount) : 0;
            
            // 简单的场景判定用于展示
            const simpleScene = textToProcess.includes("商业") ? "商业计划书" : "学术/通用文档";

            renderDashboard({
                scene: simpleScene,
                score: finalScore,
                critiques: allCritiques,
                revised_text: mergedRevisedText,
                logic_thought_trace: `✅ 全文档深度扫描完成。共执行 ${totalChunks} 次微切片审计，精准检出 ${allCritiques.length} 处关键逻辑风险。`
            });
            
            renderDetails({
                critiques: allCritiques,
                revised_text: mergedRevisedText
            });

            el.btn.disabled = false;
            el.btnText.textContent = "开始新一轮审计";
            el.loader.style.display = 'none';

        } catch (error) {
            console.error(error);
            alert("审计中断：请检查网络连接或Token配额。已处理部分将不显示。");
            setLoading(false, true);
        }
    });

    // 辅助函数
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
        // 动画延迟
        setTimeout(() => el.scoreCircle.setAttribute('stroke-dasharray', `${data.score}, 100`), 100);
    }

    function renderDetails(data) {
        el.critiquesList.innerHTML = '';
        data.critiques.forEach((item, index) => {
            const li = document.createElement('li');
            li.className = `critique-item item-color-${(index % 4) + 1}`;
            
            li.innerHTML = `
                <div class="c-header">
                    <span class="c-index">#${index + 1}</span>
                    <span
