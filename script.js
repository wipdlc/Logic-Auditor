// script.js
document.addEventListener('DOMContentLoaded', () => {
    let fullDocText = ""; // 存储合并后的所有文本
    
    const el = {
        input: document.getElementById('inputText'),
        btn: document.getElementById('submitBtn'),
        btnText: document.querySelector('.btn-text'),
        loader: document.querySelector('.loader'),
        charCount: document.querySelector('.char-count'),
        
        // 状态与结果面板
        statusState: document.getElementById('statusState'),
        resultState: document.getElementById('resultState'),
        statusText: document.getElementById('statusText'),
        scoreCircle: document.querySelector('.circle'),
        scoreText: document.querySelector('.percentage'),
        sceneResult: document.getElementById('sceneResult'),
        issueCount: document.getElementById('issueCount'),
        thoughtTrace: document.getElementById('thoughtTrace'),
        
        // 详情面板
        detailsSection: document.getElementById('detailsSection'),
        critiquesList: document.getElementById('critiquesList'),
        revisedText: document.getElementById('revisedText'),
        tabs: document.querySelectorAll('.tab-btn'),
        tabContents: document.querySelectorAll('.tab-content'),
        
        // 文件上传部分
        fileInput: document.getElementById('genericFileUpload'), // ID已更新
        filePreviewArea: document.getElementById('filePreviewArea'),
        fileNameDisplay: document.getElementById('fileNameDisplay'),
        removeFileBtn: document.getElementById('removeFileBtn')
    };

    // ==========================================
    // 1. 多格式多文件解析核心逻辑
    // ==========================================
    el.fileInput.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        // 限制数量
        if (files.length > 3) {
            alert("⚠️ 单次最多支持上传 3 个文件！");
            el.fileInput.value = ""; // 清空
            return;
        }

        // 锁定界面
        el.input.disabled = true;
        el.charCount.textContent = `📚 正在解析 ${files.length} 个文件...`;
        
        fullDocText = ""; // 重置内容
        let successCount = 0;
        let fileNames = [];

        try {
            // 并行或者串行处理文件
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const ext = file.name.split('.').pop().toLowerCase();
                
                el.input.value = `正在解析 (${i+1}/${files.length}): ${file.name}...`;
                let text = "";

                // --- 格式分发器 ---
                if (ext === 'pdf') {
                    text = await parsePdf(file);
                } else if (ext === 'docx') {
                    text = await parseDocx(file);
                } else if (ext === 'txt') {
                    text = await parseTxt(file);
                } else {
                    console.warn(`跳过不支持的格式: ${file.name}`);
                    continue;
                }

                if (text.trim().length > 0) {
                    fullDocText += `\n=== 文件: ${file.name} ===\n${text}\n`;
                    fileNames.push(file.name);
                    successCount++;
                }
            }

            if (successCount === 0) {
                throw new Error("没有成功提取到有效文本");
            }

            // 更新 UI 为文件卡片状态
            el.input.style.display = 'none';
            el.filePreviewArea.style.display = 'flex';
            
            // 如果只有1个文件显示全名，多个文件显示概览
            if (fileNames.length === 1) {
                el.fileNameDisplay.textContent = fileNames[0];
            } else {
                el.fileNameDisplay.textContent = `${fileNames[0]} 等 ${fileNames.length} 个文件`;
            }

            el.charCount.textContent = `✅ 解析完成 | 共 ${successCount} 个文件 (${fullDocText.length} 字符)`;
            el.charCount.style.color = '#10b981';
            el.input.value = ""; // 清空 textarea 显示

        } catch (error) {
            console.error("File Parse Error:", error);
            alert(`文件解析失败: ${error.message}`);
            resetInput();
        } finally {
            el.input.disabled = false;
        }
    });

    // --- 子解析器：PDF ---
    async function parsePdf(file) {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
        let txt = "";
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            txt += content.items.map(item => item.str).join(' ') + "\n";
        }
        return txt;
    }

    // --- 子解析器：Word (Docx) ---
    async function parseDocx(file) {
        const arrayBuffer = await file.arrayBuffer();
        // 使用 mammoth 提取纯文本
        const result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
        return result.value; // The raw text
    }

    // --- 子解析器：TXT ---
    function parseTxt(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(e);
            reader.readAsText(file);
        });
    }

    // 移除文件逻辑
    el.removeFileBtn.addEventListener('click', resetInput);
    function resetInput() {
        fullDocText = "";
        el.input.value = "";
        el.fileInput.value = "";
        el.input.style.display = 'block';
        el.filePreviewArea.style.display = 'none';
        el.charCount.textContent = "Ready";
        el.charCount.style.color = "#9ca3af";
    }

    // ==========================================
    // 2. 提交与切片逻辑 (分卷防超时)
    // ==========================================
    el.btn.addEventListener('click', async () => {
        // 优先使用解析后的文件文本，否则使用输入框文本
        const textToProcess = fullDocText || el.input.value.trim();
        
        if (textToProcess.length < 10) return alert("内容太少，请提供更多信息。");

        // 二次重置显示
        if (el.resultState.style.display === 'flex') {
             el.resultState.style.display = 'none';
             el.statusState.style.display = 'flex';
             el.statusText.innerHTML = "♻️ 正在初始化 Logic Auditor 核心...";
        }

        setLoading(true);

        // A. 切片策略 (1000字符/卷)
        const CHUNK_SIZE = 1000;
        const chunks = [];
        for (let i = 0; i < textToProcess.length; i += CHUNK_SIZE) {
            chunks.push(textToProcess.substring(i, i + CHUNK_SIZE));
        }
        const totalChunks = chunks.length;

        el.statusText.innerHTML = `📚 检测到 ${textToProcess.length} 字符<br>智能拆解为 ${totalChunks} 个逻辑分卷并行分析...`;

        let mergedRevisedText = "";
        let allCritiques = [];
        let totalScore = 0;

        try {
            // B. 串行处理 (Map-Reduce)
            for (let i = 0; i < totalChunks; i++) {
                const progress = Math.round(((i) / totalChunks) * 100);
                el.btnText.textContent = `处理中 ${progress}%`;
                el.statusText.innerHTML = `⚙️ 正在分析第 ${i+1}/${totalChunks} 卷 (包含多格式源)...<br>提取商业/学术逻辑特征...`;

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
                
                if (!response.ok) throw new Error("API连接失败");
                const result = await response.json();

                if (result.critiques) allCritiques = [...allCritiques, ...result.critiques];
                mergedRevisedText += (result.revised_text || chunk) + "\n\n";
                totalScore += (result.score || 0);
            }

            // C. 汇总结果
            const finalScore = Math.round(totalScore / (totalChunks || 1));
            
            // 场景检测关键词扩展 (包含word常见内容)
            const scenario = detectScenario(textToProcess);

            renderDashboard({
                scene: scenario,
                score: finalScore,
                critiques: allCritiques,
                revised_text: mergedRevisedText,
                logic_thought_trace: `✅ 多源文档(${totalChunks}卷)深度融合扫描完成，发现 ${allCritiques.length} 处逻辑断层。`
            });
            
            renderDetails({ critiques: allCritiques, revised_text: mergedRevisedText });

            // 恢复按钮状态
            el.btn.disabled = false;
            el.btnText.textContent = "开始新一轮分析";
            el.loader.style.display = 'none';

        } catch (error) {
            console.error(error);
            alert("分析过程中断，请重试");
            setLoading(false, true);
        }
    });

    // 辅助函数：简单的关键词场景探测
    function detectScenario(t) {
        if(t.includes("股权") || t.includes("盈利") || t.includes("商业模式")) return "商业计划书";
        if(t.includes("参考文献") || t.includes("摘要") || t.includes("实证")) return "学术论文";
        return "通用文稿";
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
            el.btnText.textContent = '开始逻辑审计';
            el.loader.style.display = 'none';
            if (isError) el.statusText.innerHTML = "❌ 网络超时，请减少字数";
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
        // 触发圆环动画
        setTimeout(() => el.scoreCircle.setAttribute('stroke-dasharray', `${data.score}, 100`), 100);
    }

    function renderDetails(data) {
        el.critiquesList.innerHTML = '';
        if(data.critiques.length === 0) {
             el.critiquesList.innerHTML = '<div style="padding:20px;text-align:center;color:#666">🎉 未发现严重逻辑漏洞</div>';
        } else {
            data.critiques.forEach((item, index) => {
                const li = document.createElement('li');
                li.className = `critique-item item-color-${(index % 4) + 1}`;
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
        }
        
        if (data.revised_text) {
            el.revisedText.innerHTML = data.revised_text.replace(/\n/g, '<br>');
        }
        el.tabs[0].click();
    }
    
    // Tabs
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
