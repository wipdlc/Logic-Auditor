document.addEventListener('DOMContentLoaded', () => {
    // 1. 获取 DOM 元素
    const el = {
        input: document.getElementById('inputText'),
        btn: document.getElementById('submitBtn'),
        btnText: document.querySelector('.btn-text'),
        loader: document.querySelector('.loader'),
        charCount: document.querySelector('.char-count'),
        
        // 面板切换区域
        statusState: document.getElementById('statusState'),
        resultState: document.getElementById('resultState'),
        statusText: document.getElementById('statusText'),
        
        // 结果展示区域
        scoreCircle: document.querySelector('.circle'),
        scoreText: document.querySelector('.percentage'),
        sceneResult: document.getElementById('sceneResult'),
        issueCount: document.getElementById('issueCount'),
        thoughtTrace: document.getElementById('thoughtTrace'), // 核心：思维链展示
        
        // 详情区域
        detailsSection: document.getElementById('detailsSection'),
        critiquesList: document.getElementById('critiquesList'),
        revisedText: document.getElementById('revisedText'),
        
        // Tabs
        tabs: document.querySelectorAll('.tab-btn'),
        tabContents: document.querySelectorAll('.tab-content'),
        
        // 文件上传
        pdfInput: document.getElementById('pdfUpload')
    };

    // 2. PDF 全量解析逻辑 
    el.pdfInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.type !== 'application/pdf') {
            alert('格式错误：仅支持 PDF 文件');
            return;
        }

        // 锁定界面，开始读取
        el.input.value = "📚 正在初始化 PDF 解析引擎...";
        el.input.disabled = true;
        el.btn.disabled = true;
        el.charCount.textContent = "Processing PDF...";

        try {
            const arrayBuffer = await file.arrayBuffer();
            // 使用 pdf.js 加载文档
            const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
            
            // 获取总页数 
            const maxPages = pdf.numPages; 
            let fullText = "";

            // 循环读取每一页
            for (let i = 1; i <= maxPages; i++) {
                // 实时更新 UI，让用户知道进度
                el.input.value = `📚 正在解析第 ${i} / ${maxPages} 页...\n(请勿刷新页面)`;
                
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                // 提取文本并保留简单的段落间隔
                const pageText = textContent.items.map(item => item.str).join(' ');
                
                fullText += `[第${i}页] ` + pageText + "\n\n";
            }
            
            // 解析完成
            el.input.value = fullText;
            el.input.disabled = false;
            el.btn.disabled = false;
            
            // 触发 input 事件以更新字数颜色
            const event = new Event('input');
            el.input.dispatchEvent(event);
            
            alert(`✅ 解析成功！已提取全文档共 ${maxPages} 页内容。`);

        } catch (error) {
            console.error("PDF Parse Error:", error);
            alert("❌ PDF 解析失败：可能是加密文档或纯图片扫描件。建议直接复制粘贴文本。");
            el.input.value = "";
            el.input.disabled = false;
            el.btn.disabled = false;
        }
    });

    // 3. 字数统计监听
    el.input.addEventListener('input', () => {
        const len = el.input.value.length;
        if (len === 0) {
            el.charCount.textContent = 'Waiting for input...';
            el.charCount.style.color = '#9ca3af';
        } else {
            el.charCount.textContent = `当前字数：${len}`;
            // 超过50字给绿色反馈
            el.charCount.style.color = len > 50 ? '#10b981' : '#6b7280';
        }
    });

    // 4. Tab 切换逻辑
    el.tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // 移除所有激活状态
            el.tabs.forEach(t => t.classList.remove('active'));
            el.tabContents.forEach(c => c.classList.remove('active'));
            
            // 激活当前点击的
            tab.classList.add('active');
            const targetId = `tab-${tab.dataset.tab}`;
            document.getElementById(targetId).classList.add('active');
        });
    });

    // 5. 模拟大模型思考过程动画 (增强演示效果)
    async function simulateThinkingProcess() {
        const steps = [
            "🔍 正在进行文本特征提取...",
            "🧠 识别场景类型，正在路由至垂直领域知识库...",
            "⚖️ 加载 GB/T 7713 / 创赛评分标准 / 逻辑法则...",
            "⚔️ 启动 Logic Auditor 对抗性审计网络...",
            "🛡️ 正在进行防御性逻辑重构与去幻觉处理..."
        ];
        
        for (let i = 0; i < steps.length; i++) {
            // 如果按钮已经恢复可用（说明API返回很快），则停止动画
            if (!el.btn.disabled) break; 
            
            el.statusText.innerHTML = steps[i];
            // 每個步驟停留时间 (毫秒)，可微调
            await new Promise(r => setTimeout(r, 1200));
        }
    }

    // 6. 提交核心逻辑
    el.btn.addEventListener('click', async () => {
        const text = el.input.value.trim();
        
        // 简单校验
        if (text.length < 5) {
            alert('输入内容太少，Agent 无法进行有效审计。');
            return;
        }

        // 设置加载状态
        setLoading(true);

        // 并行启动：请求 API + 播放思考动画
        // 这样不会因为 API 响应慢导致界面发呆，也不会因为动画慢拖累 API
        const animationPromise = simulateThinkingProcess();

        try {
            const response = await fetch('/api/check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text })
            });
            const data = await response.json();

            if (!response.ok) throw new Error(data.error || 'API Connection Error');

            // 等待动画稍微播放一会儿，避免闪跳 (可选，这里不强制等待全部动画播完)
            // await animationPromise; 

            // 渲染数据
            renderDashboard(data);
            renderDetails(data);

        } catch (error) {
            console.error(error);
            alert(`审计中断: ${error.message}\n请检查网络或文本是否过长导致超时。`);
            setLoading(false, true); 
        }
    });

    // 工具函数：设置 UI Loading 状态
    function setLoading(isLoading, isError = false) {
        if (isLoading) {
            el.btn.disabled = true;
            el.btnText.textContent = '深度审计中...';
            el.loader.style.display = 'block';
            
            // 切换到状态展示视图
            el.resultState.style.display = 'none';
            el.statusState.style.display = 'flex';
            el.detailsSection.style.display = 'none';
        } else {
            el.btn.disabled = false;
            el.btnText.textContent = '开始逻辑修正';
            el.loader.style.display = 'none';
            
            if (isError) {
                el.statusText.innerHTML = "❌ 连接超时或分析失败<br>请缩短文本重试";
            }
        }
    }

    // 工具函数：渲染上半部分仪表盘
    function renderDashboard(data) {
        el.statusState.style.display = 'none';
        el.resultState.style.display = 'flex';
        el.detailsSection.style.display = 'block';

        // 场景
        el.sceneResult.textContent = data.scene || '通用文本';
        
        // 漏洞数量
        const count = data.critiques ? data.critiques.length : 0;
        el.issueCount.textContent = count;
        
        // 渲染思维链 (RAG 路由结果)
        if(el.thoughtTrace) {
            // 如果后端返回了 logic_thought_trace 就用，没有就用默认语
            el.thoughtTrace.textContent = data.logic_thought_trace || "深度逻辑扫描完成，规则校验已应用。";
        }

        // 评分动画
        const score = data.score || 0;
        el.scoreText.textContent = score;
        
        // 延时一点触发 CSS 动画
        setTimeout(() => {
            el.scoreCircle.setAttribute('stroke-dasharray', `${score}, 100`);
            
            // 动态变色
            let color = '#ef4444'; // Red < 60
            if(score >= 60) color = '#f59e0b'; // Orange
            if(score >= 80) color = '#10b981'; // Green
            el.scoreCircle.style.stroke = color;
        }, 100);
    }

    // 工具函数：渲染下半部分详情
    function renderDetails(data) {
        // 1. 渲染漏洞列表
        el.critiquesList.innerHTML = '';
        if (data.critiques && data.critiques.length > 0) {
            data.critiques.forEach((item, index) => {
                const li = document.createElement('li');
                li.className = 'critique-item';
                
                // 渲染 "依据标准" 标签 (重点差异化功能)
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
                        <strong>💡 修正建议：</strong>
                        <p>${item.fix}</p>
                    </div>
                    <div class="expand-hint">点击展开/收起详情</div>
                `;
                
                // 点击展开逻辑
                li.addEventListener('click', () => {
                    li.classList.toggle('expanded');
                });
                
                el.critiquesList.appendChild(li);
            });
        } else {
            el.critiquesList.innerHTML = `
                <li style="padding:40px; text-align:center; color:#10b981; border:1px dashed #10b981; border-radius:12px;">
                    🎉 <b>Perfect Logic!</b><br>
                    未检测到明显违反【${data.scene || '标准'}】的逻辑漏洞。
                </li>
            `;
        }

        // 2. 渲染重构文
        if (data.revised_text) {
            // 处理换行符，并保持 <b> 标签的高亮效果
            el.revisedText.innerHTML = data.revised_text.replace(/\n/g, '<br>');
        } else {
            el.revisedText.textContent = "未能生成重构文，请重试。";
        }
        
        // 默认自动切换回第一个 Tab 
        el.tabs[0].click();
    }
});

// 全局复制函数
window.copyText = function() {
    const text = document.getElementById('revisedText').innerText;
    navigator.clipboard.writeText(text)
        .then(() => alert('已复制逻辑重构稿到剪贴板！'))
        .catch(err => alert('复制失败，请手动复制'));
}
