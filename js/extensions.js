/**
 * 拡張機能モジュール
 * - インライン検索
 * - 正規表現検索・置換
 * - 高度なテーマエディタ
 */

'use strict';

const Extensions = {
    // ==================== インライン検索 ====================

    inlineSearch: {
        matches: [],
        currentIndex: -1,
        highlightLayer: null,
        textarea: null,

        /**
         * 初期化
         */
        init() {
            this.highlightLayer = document.getElementById('search-highlight-layer');
            this.textarea = document.getElementById('note-content');
            this.bindEvents();
            this.syncScroll();
        },

        /**
         * スクロール同期
         */
        syncScroll() {
            if (this.textarea && this.highlightLayer) {
                this.textarea.addEventListener('scroll', () => {
                    this.highlightLayer.scrollTop = this.textarea.scrollTop;
                    this.highlightLayer.scrollLeft = this.textarea.scrollLeft;
                });
            }
        },

        /**
         * イベントをバインド
         */
        bindEvents() {
            // 検索バーを開く/閉じる
            document.addEventListener('keydown', (e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
                    e.preventDefault();
                    this.toggleSearchBar();
                }
                // Escapeで閉じる
                if (e.key === 'Escape') {
                    this.closeSearchBar();
                }
            });

            // 閉じるボタン
            const closeBtn = document.getElementById('close-search-bar');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => this.closeSearchBar());
            }

            // 検索入力
            const searchInput = document.getElementById('inline-search-input');
            if (searchInput) {
                // Enterで検索実行（カーソルは移動しない）
                searchInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        this.search();
                    }
                });
            }

            // 検索ボタン
            const searchBtn = document.getElementById('search-btn');
            if (searchBtn) {
                searchBtn.addEventListener('click', () => {
                    this.search();
                });
            }

            // 正規表現チェックボックス（検索結果をクリア）
            const regexCheckbox = document.getElementById('inline-regex-checkbox');
            if (regexCheckbox) {
                regexCheckbox.addEventListener('change', () => {
                    this.matches = [];
                    this.currentIndex = -1;
                    this.updateResultCount();
                });
            }

            // 前へ/次へボタン
            const prevBtn = document.getElementById('search-prev');
            if (prevBtn) {
                prevBtn.addEventListener('click', () => this.findPrevious());
            }

            const nextBtn = document.getElementById('search-next');
            if (nextBtn) {
                nextBtn.addEventListener('click', () => this.findNext());
            }

            // 置換トグル
            const toggleReplaceBtn = document.getElementById('toggle-replace');
            if (toggleReplaceBtn) {
                toggleReplaceBtn.addEventListener('click', () => this.toggleReplace());
            }

            // 置換ボタン
            const replaceBtn = document.getElementById('inline-replace-btn');
            if (replaceBtn) {
                replaceBtn.addEventListener('click', () => this.replace());
            }

            // 全て置換ボタン
            const replaceAllBtn = document.getElementById('inline-replace-all-btn');
            if (replaceAllBtn) {
                replaceAllBtn.addEventListener('click', () => this.replaceAll());
            }
        },

        /**
         * 検索バーを開く/閉じる
         */
        toggleSearchBar() {
            const searchBar = document.getElementById('inline-search-bar');
            if (searchBar.classList.contains('active')) {
                this.closeSearchBar();
            } else {
                this.openSearchBar();
            }
        },

        /**
         * 検索バーを開く
         */
        openSearchBar() {
            const searchBar = document.getElementById('inline-search-bar');
            searchBar.classList.add('active');
            const searchInput = document.getElementById('inline-search-input');
            searchInput.focus();
            searchInput.select();
        },

        /**
         * 検索バーを閉じる
         */
        closeSearchBar() {
            const searchBar = document.getElementById('inline-search-bar');
            searchBar.classList.remove('active');
            const replaceRow = document.getElementById('replace-row');
            replaceRow.style.display = 'none';
            this.matches = [];
            this.currentIndex = -1;
            this.updateResultCount();
            // ハイライトをクリア
            if (this.highlightLayer) {
                this.highlightLayer.innerHTML = '';
            }
        },

        /**
         * 置換行を表示/非表示
         */
        toggleReplace() {
            const replaceRow = document.getElementById('replace-row');
            if (replaceRow.style.display === 'none') {
                replaceRow.style.display = 'flex';
            } else {
                replaceRow.style.display = 'none';
            }
        },

        /**
         * 検索
         */
        async search() {
            const pattern = document.getElementById('inline-search-input').value;
            const content = document.getElementById('note-content');
            const isRegex = document.getElementById('inline-regex-checkbox').checked;

            if (!pattern) {
                this.matches = [];
                this.currentIndex = -1;
                this.updateResultCount();
                return;
            }

            this.matches = [];

            try {
                if (isRegex) {
                    // 正規表現の安全性チェック
                    if (!Utils.isSafeRegex(pattern)) {
                        Dialog.alert('複雑すぎる正規表現です。より単純なパターンを使用してください。', 'エラー', 'error');
                        return;
                    }

                    // タイムアウト付きで正規表現を実行
                    try {
                        this.matches = await Utils.execRegexWithTimeout(pattern, content.value, 'gi', 1000);
                    } catch (error) {
                        console.error('正規表現エラー:', error);
                        Dialog.alert(error.message || '正規表現の実行に失敗しました', 'エラー', 'error');
                        this.matches = [];
                        this.currentIndex = -1;
                        this.updateResultCount();
                        return;
                    }
                } else {
                    // 通常検索
                    const lowerContent = content.value.toLowerCase();
                    const lowerPattern = pattern.toLowerCase();
                    let pos = 0;
                    while ((pos = lowerContent.indexOf(lowerPattern, pos)) !== -1) {
                        this.matches.push({
                            index: pos,
                            length: pattern.length
                        });
                        pos += pattern.length;
                    }
                }

                if (this.matches.length > 0) {
                    this.currentIndex = 0;
                    console.log(`検索結果: ${this.matches.length}件見つかりました`);
                } else {
                    this.currentIndex = -1;
                    console.log('検索結果: 見つかりませんでした');
                }

                this.updateHighlightLayer();
                this.updateResultCount();
            } catch (error) {
                console.error('検索エラー:', error);
                this.matches = [];
                this.currentIndex = -1;
                this.updateResultCount();
            }
        },

        /**
         * 前へ
         */
        findPrevious() {
            if (this.matches.length === 0) return;

            if (this.currentIndex === -1) {
                this.currentIndex = this.matches.length - 1; // 最後の要素へ
            } else {
                this.currentIndex = (this.currentIndex - 1 + this.matches.length) % this.matches.length;
            }
            this.updateHighlightLayer();
            this.scrollToMatch();
            this.updateResultCount();
        },

        /**
         * 次へ
         */
        findNext() {
            if (this.matches.length === 0) return;

            if (this.currentIndex === -1) {
                this.currentIndex = 0; // 最初の要素へ
            } else {
                this.currentIndex = (this.currentIndex + 1) % this.matches.length;
            }
            this.updateHighlightLayer();
            this.scrollToMatch();
            this.updateResultCount();
        },

        /**
         * マッチ位置にスクロール
         */
        scrollToMatch() {
            if (this.currentIndex === -1 || this.matches.length === 0) return;

            const match = this.matches[this.currentIndex];
            this.textarea.setSelectionRange(match.index, match.index + match.length);

            // テキストエリア内でのスクロール位置を調整
            const lineHeight = parseInt(getComputedStyle(this.textarea).lineHeight);
            const textBeforeMatch = this.textarea.value.substring(0, match.index);
            const lines = textBeforeMatch.split('\n').length;
            const scrollTop = Math.max(0, (lines - 5) * lineHeight);

            this.textarea.scrollTop = scrollTop;
            this.highlightLayer.scrollTop = scrollTop;
        },

        /**
         * 現在の検索結果をハイライト
         */
        highlightCurrent(moveFocus = true) {
            if (this.currentIndex === -1 || this.matches.length === 0) return;

            const content = document.getElementById('note-content');
            const match = this.matches[this.currentIndex];
            content.setSelectionRange(match.index, match.index + match.length);
            if (moveFocus) {
                content.focus();
            }
        },

        /**
         * ハイライトレイヤーを更新
         */
        updateHighlightLayer() {
            if (!this.highlightLayer || !this.textarea) return;

            const text = this.textarea.value;

            if (this.matches.length === 0) {
                this.highlightLayer.innerHTML = this.escapeHtml(text);
                return;
            }

            let html = '';
            let lastIndex = 0;

            this.matches.forEach((match, index) => {
                // マッチの前のテキスト
                html += this.escapeHtml(text.substring(lastIndex, match.index));

                // マッチ部分をmarkタグで囲む
                const matchText = text.substring(match.index, match.index + match.length);
                const className = index === this.currentIndex ? 'current' : '';
                html += `<mark class="${className}">${this.escapeHtml(matchText)}</mark>`;

                lastIndex = match.index + match.length;
            });

            // 残りのテキスト
            html += this.escapeHtml(text.substring(lastIndex));

            this.highlightLayer.innerHTML = html;
        },

        /**
         * HTMLエスケープ
         */
        escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        },

        /**
         * 結果件数を更新
         */
        updateResultCount() {
            const countElem = document.getElementById('search-result-count');
            if (this.matches.length === 0) {
                countElem.textContent = '';
            } else if (this.currentIndex === -1) {
                countElem.textContent = `${this.matches.length}件`;
            } else {
                countElem.textContent = `${this.currentIndex + 1} / ${this.matches.length}`;
            }
        },

        /**
         * 置換
         */
        replace() {
            if (this.currentIndex === -1 || this.matches.length === 0) return;

            const content = document.getElementById('note-content');
            const replacement = document.getElementById('inline-replace-input').value;
            const match = this.matches[this.currentIndex];

            // 置換対象を選択
            content.focus();
            content.setSelectionRange(match.index, match.index + match.length);

            // execCommandを使ってアンドゥ可能な置換を実行
            document.execCommand('insertText', false, replacement);
            Editor.markDirty();

            // 検索結果を更新
            this.search();
        },

        /**
         * 全て置換
         */
        replaceAll() {
            if (this.matches.length === 0) return;

            const content = document.getElementById('note-content');
            const replacement = document.getElementById('inline-replace-input').value;
            const count = this.matches.length;

            try {
                content.focus();

                // 逆順で置換していくことでインデックスのずれを防ぐ
                for (let i = this.matches.length - 1; i >= 0; i--) {
                    const match = this.matches[i];
                    content.setSelectionRange(match.index, match.index + match.length);
                    document.execCommand('insertText', false, replacement);
                }

                Editor.markDirty();

                // 検索結果をクリア
                this.matches = [];
                this.currentIndex = -1;
                this.updateResultCount();

                // 通知
                Dialog.alert(`${count}件置換しました`, '完了', 'success');
            } catch (error) {
                console.error('置換エラー:', error);
                Dialog.alert('置換に失敗しました', 'エラー', 'error');
            }
        }
    },

    // ==================== 正規表現検索・置換 ====================

    regex: {
        /**
         * 初期化
         */
        init() {
            this.bindEvents();
        },

        /**
         * イベントをバインド
         */
        bindEvents() {
            const openBtn = document.getElementById('open-regex-search');
            if (openBtn) {
                openBtn.addEventListener('click', () => this.openDialog());
            }

            const searchBtn = document.getElementById('regex-search-btn');
            if (searchBtn) {
                searchBtn.addEventListener('click', () => this.search());
            }

            const replaceBtn = document.getElementById('regex-replace-btn');
            if (replaceBtn) {
                replaceBtn.addEventListener('click', () => this.replace());
            }

            const replaceAllBtn = document.getElementById('regex-replace-all-btn');
            if (replaceAllBtn) {
                replaceAllBtn.addEventListener('click', () => this.replaceAll());
            }

            const closeBtn = document.getElementById('close-regex-dialog');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => this.closeDialog());
            }

            // 正規表現モードチェックボックス
            const regexModeCheckbox = document.getElementById('regex-mode-checkbox');
            if (regexModeCheckbox) {
                regexModeCheckbox.addEventListener('change', (e) => {
                    const flagsContainer = document.getElementById('regex-flags-container');
                    const patternInput = document.getElementById('regex-pattern');
                    if (e.target.checked) {
                        // 正規表現モード
                        flagsContainer.style.display = 'block';
                        patternInput.placeholder = '例: \\d{3}-\\d{4}';
                    } else {
                        // 通常検索モード
                        flagsContainer.style.display = 'none';
                        patternInput.placeholder = '検索したいテキストを入力';
                    }
                });
            }
        },

        /**
         * ダイアログを開く
         */
        openDialog() {
            const dialog = document.getElementById('regex-search-dialog');
            if (dialog) {
                dialog.classList.add('active');
                document.getElementById('regex-pattern').focus();
            }
        },

        /**
         * ダイアログを閉じる
         */
        closeDialog() {
            const dialog = document.getElementById('regex-search-dialog');
            if (dialog) {
                dialog.classList.remove('active');
            }
        },

        /**
         * 検索
         */
        async search() {
            const pattern = document.getElementById('regex-pattern').value;
            const content = document.getElementById('note-content');
            const isRegexMode = document.getElementById('regex-mode-checkbox').checked;

            if (!pattern) {
                this.showResult('検索パターンを入力してください', true);
                return;
            }

            try {
                if (isRegexMode) {
                    // 正規表現の安全性チェック
                    if (!Utils.isSafeRegex(pattern)) {
                        this.showResult('複雑すぎる正規表現です', true);
                        return;
                    }

                    // 正規表現検索
                    const flags = this.getFlags();
                    const regex = new RegExp(pattern, flags);
                    const matches = content.value.match(new RegExp(pattern, flags + 'g'));

                    if (matches) {
                        // 最初のマッチ位置を選択
                        const index = content.value.search(regex);
                        content.setSelectionRange(index, index + matches[0].length);
                        content.focus();

                        this.showResult(`${matches.length}件見つかりました`);
                    } else {
                        this.showResult('一致する文字列が見つかりませんでした');
                    }
                } else {
                    // 通常検索（大文字小文字を区別しない）
                    const lowerContent = content.value.toLowerCase();
                    const lowerPattern = pattern.toLowerCase();
                    const index = lowerContent.indexOf(lowerPattern);

                    if (index !== -1) {
                        content.setSelectionRange(index, index + pattern.length);
                        content.focus();

                        // 全体で何件あるかカウント
                        const count = lowerContent.split(lowerPattern).length - 1;
                        this.showResult(`${count}件見つかりました`);
                    } else {
                        this.showResult('一致する文字列が見つかりませんでした');
                    }
                }
            } catch (error) {
                this.showResult(`エラー: ${error.message}`, true);
            }
        },

        /**
         * 置換
         */
        replace() {
            const pattern = document.getElementById('regex-pattern').value;
            const replacement = document.getElementById('regex-replacement').value;
            const content = document.getElementById('note-content');
            const isRegexMode = document.getElementById('regex-mode-checkbox').checked;

            if (!pattern) {
                this.showResult('検索パターンを入力してください', true);
                return;
            }

            try {
                let newValue;
                if (isRegexMode) {
                    // 正規表現置換
                    const flags = this.getFlags();
                    const regex = new RegExp(pattern, flags);
                    newValue = content.value.replace(regex, replacement);
                } else {
                    // 通常置換（最初の1件のみ）
                    const index = content.value.toLowerCase().indexOf(pattern.toLowerCase());
                    if (index !== -1) {
                        newValue = content.value.substring(0, index) +
                                  replacement +
                                  content.value.substring(index + pattern.length);
                    } else {
                        newValue = content.value;
                    }
                }

                if (newValue !== content.value) {
                    content.value = newValue;
                    Editor.markDirty();
                    this.showResult('1件置換しました');
                } else {
                    this.showResult('一致する文字列が見つかりませんでした');
                }
            } catch (error) {
                this.showResult(`エラー: ${error.message}`, true);
            }
        },

        /**
         * 全て置換
         */
        replaceAll() {
            const pattern = document.getElementById('regex-pattern').value;
            const replacement = document.getElementById('regex-replacement').value;
            const content = document.getElementById('note-content');
            const isRegexMode = document.getElementById('regex-mode-checkbox').checked;

            if (!pattern) {
                this.showResult('検索パターンを入力してください', true);
                return;
            }

            try {
                let newValue;
                let count = 0;

                if (isRegexMode) {
                    // 正規表現置換
                    let flags = this.getFlags();
                    // 全て置換するためにgフラグを追加
                    if (!flags.includes('g')) {
                        flags += 'g';
                    }

                    const regex = new RegExp(pattern, flags);
                    const matches = content.value.match(regex);
                    newValue = content.value.replace(regex, replacement);
                    count = matches ? matches.length : 0;
                } else {
                    // 通常置換（全て）
                    const lowerContent = content.value.toLowerCase();
                    const lowerPattern = pattern.toLowerCase();
                    newValue = content.value;

                    // 大文字小文字を保持しながら全置換
                    let pos = 0;
                    let result = '';
                    while (pos < newValue.length) {
                        const index = newValue.toLowerCase().indexOf(lowerPattern, pos);
                        if (index === -1) {
                            result += newValue.substring(pos);
                            break;
                        }
                        result += newValue.substring(pos, index) + replacement;
                        pos = index + pattern.length;
                        count++;
                    }
                    newValue = result;
                }

                if (newValue !== content.value) {
                    content.value = newValue;
                    Editor.markDirty();
                    this.showResult(`${count}件置換しました`);
                } else {
                    this.showResult('一致する文字列が見つかりませんでした');
                }
            } catch (error) {
                this.showResult(`エラー: ${error.message}`, true);
            }
        },

        /**
         * フラグを取得
         */
        getFlags() {
            let flags = '';
            if (document.getElementById('regex-flag-i').checked) flags += 'i';
            if (document.getElementById('regex-flag-m').checked) flags += 'm';
            if (document.getElementById('regex-flag-s').checked) flags += 's';
            return flags;
        },

        /**
         * 結果を表示
         */
        showResult(message, isError = false) {
            const resultDiv = document.getElementById('regex-result');
            if (resultDiv) {
                resultDiv.textContent = message;
                resultDiv.className = 'regex-result ' + (isError ? 'error' : 'success');
                resultDiv.style.display = 'block';

                setTimeout(() => {
                    resultDiv.style.display = 'none';
                }, 3000);
            }
        }
    },

    // ==================== テーマエディタ ====================

    themeEditor: {
        currentTheme: {},

        /**
         * 初期化
         */
        init() {
            this.loadCurrentTheme();
            this.bindEvents();
        },

        /**
         * イベントをバインド
         */
        bindEvents() {
            const openBtn = document.getElementById('open-theme-editor');
            if (openBtn) {
                openBtn.addEventListener('click', () => this.openEditor());
            }

            const closeBtn = document.getElementById('close-theme-editor');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => this.closeEditor());
            }

            const saveBtn = document.getElementById('save-custom-theme');
            if (saveBtn) {
                saveBtn.addEventListener('click', () => this.saveTheme());
            }

            const resetBtn = document.getElementById('reset-theme');
            if (resetBtn) {
                resetBtn.addEventListener('click', () => this.resetTheme());
            }

            // カラーピッカーのリアルタイム更新
            document.querySelectorAll('.theme-color-input').forEach(input => {
                input.addEventListener('input', (e) => this.updateThemePreview(e.target));
            });
        },

        /**
         * エディタを開く
         */
        openEditor() {
            const dialog = document.getElementById('theme-editor-dialog');
            if (dialog) {
                this.loadCurrentTheme();
                dialog.classList.add('active');
            }
        },

        /**
         * エディタを閉じる
         */
        closeEditor() {
            const dialog = document.getElementById('theme-editor-dialog');
            if (dialog) {
                dialog.classList.remove('active');
            }
        },

        /**
         * 現在のテーマを読み込む
         */
        async loadCurrentTheme() {
            const root = document.documentElement;
            const computedStyle = getComputedStyle(root);

            this.currentTheme = {
                'editor-bg': computedStyle.getPropertyValue('--editor-bg').trim(),
                'text-color': computedStyle.getPropertyValue('--text-color').trim(),
                'primary-color': computedStyle.getPropertyValue('--primary-color').trim(),
                'sidebar-bg': computedStyle.getPropertyValue('--sidebar-bg').trim(),
                'border-color': computedStyle.getPropertyValue('--border-color').trim(),
                'hover-bg': computedStyle.getPropertyValue('--hover-bg').trim(),
                'active-bg': computedStyle.getPropertyValue('--active-bg').trim(),
                'meta-color': computedStyle.getPropertyValue('--meta-color').trim(),
                'search-highlight': computedStyle.getPropertyValue('--search-highlight-color').trim() || '#ffff00',
                'search-highlight-current': computedStyle.getPropertyValue('--search-highlight-current-color').trim() || '#ffa500',
                'icon-color': computedStyle.getPropertyValue('--icon-color').trim() || computedStyle.getPropertyValue('--text-color').trim()
            };

            // 現在のテーマ名を取得
            const currentThemeName = await DB.getSetting('theme', 'light');

            // 保存されているカスタムテーマを取得
            const customThemes = await DB.getSetting('customThemes', {});

            // 現在のテーマのカスタム設定があれば上書き
            if (customThemes[currentThemeName]) {
                Object.assign(this.currentTheme, customThemes[currentThemeName]);
            }

            // カラーピッカーに値をセット
            Object.entries(this.currentTheme).forEach(([key, value]) => {
                const input = document.getElementById(`theme-${key}`);
                if (input && value) {
                    // rgb形式をhex形式に変換
                    input.value = this.rgbToHex(value);
                }
            });
        },

        /**
         * テーマプレビューを更新
         */
        updateThemePreview(input) {
            const property = input.id.replace('theme-', '');
            const value = input.value;

            document.documentElement.style.setProperty(`--${property}`, value);
        },

        /**
         * テーマを保存
         */
        async saveTheme() {
            const theme = {};

            document.querySelectorAll('.theme-color-input').forEach(input => {
                const property = input.id.replace('theme-', '');
                theme[property] = input.value;
            });

            // 現在のテーマ名を取得
            const currentThemeName = await DB.getSetting('theme', 'light');

            // 既存のカスタムテーマを取得
            const customThemes = await DB.getSetting('customThemes', {});

            // 現在のテーマのカスタム設定を保存
            customThemes[currentThemeName] = theme;

            // カスタムテーマをDBに保存（テーマごとに保存）
            await DB.saveSetting('customThemes', customThemes);

            // CSSカスタムプロパティを更新
            Object.entries(theme).forEach(([key, value]) => {
                document.documentElement.style.setProperty(`--${key}`, value);
            });

            alert('カスタムテーマを保存しました');
            this.closeEditor();
        },

        /**
         * テーマをリセット
         */
        resetTheme() {
            if (confirm('テーマをデフォルトにリセットしますか？')) {
                // カスタムスタイルをクリア
                document.querySelectorAll('.theme-color-input').forEach(input => {
                    const property = input.id.replace('theme-', '');
                    document.documentElement.style.removeProperty(`--${property}`);
                });

                this.loadCurrentTheme();
            }
        },

        /**
         * RGB形式をHEX形式に変換
         */
        rgbToHex(rgb) {
            // rgb(r, g, b) 形式
            if (rgb.startsWith('rgb')) {
                const matches = rgb.match(/\d+/g);
                if (matches && matches.length >= 3) {
                    const r = parseInt(matches[0]);
                    const g = parseInt(matches[1]);
                    const b = parseInt(matches[2]);
                    return '#' + [r, g, b].map(x => {
                        const hex = x.toString(16);
                        return hex.length === 1 ? '0' + hex : hex;
                    }).join('');
                }
            }

            // 既にhex形式の場合
            if (rgb.startsWith('#')) {
                return rgb;
            }

            return '#000000';
        }
    },

    /**
     * 全拡張機能を初期化
     */
    init() {
        this.inlineSearch.init();
        this.regex.init();
        this.themeEditor.init();
    }
};
