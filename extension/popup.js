/**
 * Heading Detector - Popup Script
 */

document.addEventListener('DOMContentLoaded', () => {
    const detectBtn = document.getElementById('detectBtn');
    const clearBtn = document.getElementById('clearBtn');
    const status = document.getElementById('status');
    const results = document.getElementById('results');
    const resultCount = document.getElementById('resultCount');
    const headingList = document.getElementById('headingList');

    let currentHeadings = [];

    // 検出ボタン
    detectBtn.addEventListener('click', async () => {
        status.textContent = '検出中...';
        status.className = 'status';
        detectBtn.disabled = true;

        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            // コンテンツスクリプトを注入
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['content.js']
            });

            // 検出を実行
            const response = await chrome.tabs.sendMessage(tab.id, { action: 'detect' });

            if (response && response.success) {
                currentHeadings = response.headings;
                renderHeadings(currentHeadings);
                status.textContent = '検出完了！';
                status.className = 'status success';
                clearBtn.disabled = false;
            } else {
                throw new Error('検出に失敗しました');
            }
        } catch (error) {
            console.error('Detection error:', error);
            status.textContent = 'エラー: ' + error.message;
            status.className = 'status error';
        } finally {
            detectBtn.disabled = false;
        }
    });

    // クリアボタン
    clearBtn.addEventListener('click', async () => {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            await chrome.tabs.sendMessage(tab.id, { action: 'clear' });

            currentHeadings = [];
            headingList.innerHTML = '';
            results.style.display = 'none';
            status.textContent = 'ハイライトをクリアしました';
            status.className = 'status';
            clearBtn.disabled = true;
        } catch (error) {
            console.error('Clear error:', error);
        }
    });

    // 見出しリストをレンダリング
    function renderHeadings(headings) {
        headingList.innerHTML = '';
        resultCount.textContent = headings.length;

        if (headings.length === 0) {
            results.style.display = 'none';
            status.textContent = '見出しが見つかりませんでした';
            return;
        }

        results.style.display = 'block';

        headings.forEach((heading, index) => {
            const li = document.createElement('li');
            li.className = `heading-item h${heading.level}`;
            li.innerHTML = `
        <span class="heading-level">H${heading.level}</span>
        <span class="heading-text">${escapeHtml(heading.text)}</span>
        <span class="heading-type">${heading.isNative ? '📌' : '✨'}</span>
      `;

            li.addEventListener('click', async () => {
                try {
                    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                    await chrome.tabs.sendMessage(tab.id, { action: 'scrollTo', index: heading.index });
                } catch (error) {
                    console.error('Scroll error:', error);
                }
            });

            headingList.appendChild(li);
        });
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
});
