/**
 * ユーティリティ関数モジュール
 * セキュリティとパフォーマンスのためのヘルパー関数
 */

'use strict';

const Utils = {
    /**
     * HTMLをエスケープ（XSS対策）
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    /**
     * 入力値をサニタイズ
     */
    sanitizeInput(value, maxLength = 100) {
        return String(value || '')
            .trim()
            .substring(0, maxLength)
            .replace(/[<>\"']/g, c => ({
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;'
            }[c]));
    },

    /**
     * 正規表現が安全かチェック（ReDoS対策）
     */
    isSafeRegex(pattern) {
        // 危険なパターンを検出
        const dangerous = /(\+\*|{\d,}|\(\w*\+\)+|\|[\w\|\+\(\)]*\|)/;
        if (dangerous.test(pattern)) {
            return false;
        }

        // パターン長の制限
        if (pattern.length > 500) {
            return false;
        }

        return true;
    },

    /**
     * タイムアウト付きで正規表現を実行（ReDoS対策）
     */
    async execRegexWithTimeout(pattern, text, flags = 'gi', timeout = 1000) {
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                reject(new Error('正規表現の実行がタイムアウトしました'));
            }, timeout);

            try {
                const regex = new RegExp(pattern, flags);
                const matches = [];
                let match;

                while ((match = regex.exec(text)) !== null) {
                    matches.push({
                        index: match.index,
                        length: match[0].length,
                        text: match[0]
                    });

                    // 無限ループ防止
                    if (matches.length > 10000) {
                        clearTimeout(timeoutId);
                        reject(new Error('マッチ数が多すぎます'));
                        return;
                    }
                }

                clearTimeout(timeoutId);
                resolve(matches);
            } catch (error) {
                clearTimeout(timeoutId);
                reject(error);
            }
        });
    },

    /**
     * UUID生成（cryptographically strong）
     */
    generateUUID() {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID();
        }

        // フォールバック: crypto.getRandomValuesを使用
        const array = new Uint8Array(16);
        crypto.getRandomValues(array);

        // UUID v4 フォーマット
        array[6] = (array[6] & 0x0f) | 0x40;
        array[8] = (array[8] & 0x3f) | 0x80;

        const hex = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
        return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    },

    /**
     * デバウンス関数
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    /**
     * スロットル関数
     */
    throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
};
