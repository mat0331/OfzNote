/**
 * カスタムダイアログシステム
 */

'use strict';

const Dialog = {
    overlay: null,
    icon: null,
    title: null,
    message: null,
    buttons: null,
    lastActiveElement: null,

    /**
     * 初期化
     */
    init() {
        this.overlay = document.getElementById('custom-dialog-overlay');
        this.icon = document.getElementById('custom-dialog-icon');
        this.title = document.getElementById('custom-dialog-title');
        this.message = document.getElementById('custom-dialog-message');
        this.buttons = document.getElementById('custom-dialog-buttons');

        // オーバーレイクリックで閉じる
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) {
                this.close();
            }
        });

        // Escキーで閉じる
        this.overlay.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.close();
            }
        });
    },

    /**
     * アラートを表示
     */
    alert(message, title = '通知', type = 'info') {
        return new Promise((resolve) => {
            this.show({
                title,
                message,
                type,
                buttons: [
                    {
                        text: 'OK',
                        className: 'primary',
                        callback: () => {
                            this.close();
                            resolve();
                        }
                    }
                ]
            });
        });
    },

    /**
     * 確認ダイアログを表示
     */
    confirm(message, title = '確認', type = 'warning') {
        return new Promise((resolve) => {
            this.show({
                title,
                message,
                type,
                buttons: [
                    {
                        text: 'キャンセル',
                        className: 'secondary',
                        callback: () => {
                            this.close();
                            resolve(false);
                        }
                    },
                    {
                        text: 'OK',
                        className: type === 'warning' ? 'danger' : 'primary',
                        callback: () => {
                            this.close();
                            resolve(true);
                        }
                    }
                ]
            });
        });
    },

    /**
     * プロンプトダイアログを表示
     */
    prompt(message, title = '入力', defaultValue = '') {
        return new Promise((resolve) => {
            // カスタム入力ダイアログを作成（XSS対策）
            const inputId = 'custom-dialog-input-' + Date.now();
            const safeMessage = Utils.escapeHtml(message);
            const safeDefaultValue = Utils.escapeHtml(defaultValue);
            const messageWithInput = `
                ${safeMessage}
                <input type="text" id="${inputId}" class="custom-dialog-input" value="${safeDefaultValue}" style="
                    width: 100%;
                    padding: 10px;
                    margin-top: 12px;
                    border: 1px solid var(--border-color);
                    border-radius: 6px;
                    background: var(--input-bg);
                    color: var(--text-color);
                    font-size: 14px;
                ">
            `;

            this.show({
                title,
                message: messageWithInput,
                type: 'info',
                allowHtml: true,
                buttons: [
                    {
                        text: 'キャンセル',
                        className: 'secondary',
                        callback: () => {
                            this.close();
                            resolve(null);
                        }
                    },
                    {
                        text: 'OK',
                        className: 'primary',
                        callback: () => {
                            const input = document.getElementById(inputId);
                            const value = input ? input.value : null;
                            this.close();
                            resolve(value);
                        }
                    }
                ]
            });

            // 入力フィールドにフォーカス
            setTimeout(() => {
                const input = document.getElementById(inputId);
                if (input) {
                    input.focus();
                    input.select();
                    // Enterキーで確定
                    input.addEventListener('keypress', (e) => {
                        if (e.key === 'Enter') {
                            const value = input.value;
                            this.close();
                            resolve(value);
                        }
                    });
                }
            }, 100);
        });
    },

    /**
     * 選択ダイアログを表示
     */
    select(title, options, callback) {
        const selectId = 'custom-dialog-select-' + Date.now();
        const optionsHtml = options.map(opt =>
            `<option value="${Utils.escapeHtml(opt.value)}">${Utils.escapeHtml(opt.label)}</option>`
        ).join('');

        const messageWithSelect = `
            <select id="${selectId}" class="custom-dialog-select" style="
                width: 100%;
                padding: 12px;
                margin-top: 12px;
                border: 1px solid var(--border-color);
                border-radius: 6px;
                background: var(--input-bg);
                color: var(--text-color);
                font-size: 16px;
                cursor: pointer;
            ">
                ${optionsHtml}
            </select>
        `;

        this.show({
            title,
            message: messageWithSelect,
            type: 'info',
            allowHtml: true,
            buttons: [
                {
                    text: 'キャンセル',
                    className: 'secondary',
                    callback: () => {
                        this.close();
                        callback(null);
                    }
                },
                {
                    text: 'OK',
                    className: 'primary',
                    callback: () => {
                        const select = document.getElementById(selectId);
                        const value = select ? select.value : null;
                        this.close();
                        callback(value);
                    }
                }
            ]
        });

        // セレクトボックスにフォーカス
        setTimeout(() => {
            const select = document.getElementById(selectId);
            if (select) {
                select.focus();
            }
        }, 100);
    },

    /**
     * ダイアログを表示
     */
    show(options) {
        const { title, message, type = 'info', buttons = [], allowHtml = false } = options;

        // 最後にフォーカスがあった要素を保存
        this.lastActiveElement = document.activeElement;

        // タイトルを設定（XSS対策）
        this.title.textContent = title;

        // メッセージを設定（XSS対策）
        if (allowHtml) {
            // HTMLを許可する場合は、危険なタグを削除
            let sanitizedMessage = message;
            sanitizedMessage = sanitizedMessage.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
            sanitizedMessage = sanitizedMessage.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');
            sanitizedMessage = sanitizedMessage.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');
            sanitizedMessage = sanitizedMessage.replace(/javascript:/gi, '');
            this.message.innerHTML = sanitizedMessage;
        } else {
            // テキストとして設定（デフォルト）
            this.message.textContent = message;
        }

        // アイコンを設定
        this.icon.className = `custom-dialog-icon ${type}`;
        const iconMap = {
            success: '<i class="fas fa-check-circle"></i>',
            error: '<i class="fas fa-times-circle"></i>',
            warning: '<i class="fas fa-exclamation-triangle"></i>',
            info: '<i class="fas fa-info-circle"></i>'
        };
        this.icon.innerHTML = iconMap[type] || iconMap.info;

        // ボタンを設定
        this.buttons.innerHTML = '';
        buttons.forEach(btn => {
            const button = document.createElement('button');
            button.className = `custom-dialog-btn ${btn.className}`;
            button.textContent = btn.text;
            button.addEventListener('click', btn.callback);
            this.buttons.appendChild(button);
        });

        // オーバーレイを表示
        this.overlay.classList.add('active');

        // フォーカストラップを実装
        this.implementFocusTrap();
    },

    /**
     * ダイアログを閉じる
     */
    close() {
        this.overlay.classList.remove('active');

        // 前回フォーカスがあった要素に戻す
        if (this.lastActiveElement) {
            this.lastActiveElement.focus();
            this.lastActiveElement = null;
        }
    },

    /**
     * フォーカストラップを実装（アクセシビリティ対応）
     */
    implementFocusTrap() {
        // ダイアログ内のフォーカス可能な要素を取得
        const focusableElements = this.overlay.querySelectorAll(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])'
        );

        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        // キーボードイベントのハンドラ
        const handleKeyDown = (e) => {
            if (e.key === 'Tab') {
                if (e.shiftKey) {
                    // Shift+Tab: 最初の要素から前に行こうとしたら最後へ
                    if (document.activeElement === firstElement) {
                        e.preventDefault();
                        lastElement.focus();
                    }
                } else {
                    // Tab: 最後の要素から次に行こうとしたら最初へ
                    if (document.activeElement === lastElement) {
                        e.preventDefault();
                        firstElement.focus();
                    }
                }
            }
        };

        // 既存のリスナーを削除して新しいものを追加
        this.overlay.removeEventListener('keydown', handleKeyDown);
        this.overlay.addEventListener('keydown', handleKeyDown);

        // 最初の要素にフォーカス
        setTimeout(() => firstElement.focus(), 100);
    }
};
