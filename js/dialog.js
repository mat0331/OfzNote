/**
 * カスタムダイアログシステム
 */

const Dialog = {
    overlay: null,
    icon: null,
    title: null,
    message: null,
    buttons: null,

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
            // カスタム入力ダイアログを作成
            const inputId = 'custom-dialog-input-' + Date.now();
            const messageWithInput = `
                ${message}
                <input type="text" id="${inputId}" class="custom-dialog-input" value="${defaultValue}" style="
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
     * ダイアログを表示
     */
    show(options) {
        const { title, message, type = 'info', buttons = [] } = options;

        // タイトルを設定
        this.title.textContent = title;

        // メッセージを設定
        this.message.innerHTML = message;

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
    },

    /**
     * ダイアログを閉じる
     */
    close() {
        this.overlay.classList.remove('active');
    }
};
