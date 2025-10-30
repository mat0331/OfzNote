/**
 * メインアプリケーション
 */

'use strict';

const App = {
    /**
     * アプリケーションを初期化
     */
    async init() {
        console.log('OfzNote アプリケーション起動中...');

        // グローバルエラーハンドラーを設定
        this.setupGlobalErrorHandlers();

        try {
            // ダイアログシステムを初期化
            Dialog.init();
            console.log('ダイアログ初期化完了');

            // アンドゥマネージャーを初期化
            UndoManager.init();
            console.log('アンドゥマネージャー初期化完了');

            // IndexedDBを初期化
            await DB.init();
            console.log('データベース初期化完了');

            // ファイルシステムを初期化（UIより先に）
            await FileSystem.init();
            console.log('ファイルシステム初期化完了');

            // エディタを初期化
            Editor.init();
            console.log('エディタ初期化完了');

            // UIを初期化
            UI.init();
            console.log('UI初期化完了');

            // 拡張機能を初期化
            Extensions.init();
            console.log('拡張機能初期化完了');

            // ファイルシステムステータスを更新
            UI.updateFileSystemStatus();

            // Service Workerを登録
            this.registerServiceWorker();

            // オフラインサポートを設定
            this.handleOfflineSupport();

            // インストールプロンプトを処理
            this.handleInstallPrompt();

            // ページを閉じる前に保存（エラーハンドリング強化）
            window.addEventListener('beforeunload', async (e) => {
                if (Editor.isDirty && Editor.currentNote) {
                    try {
                        // タイムアウト付きで保存を試みる
                        await Promise.race([
                            Editor.saveNow(),
                            new Promise((_, reject) =>
                                setTimeout(() => reject(new Error('保存タイムアウト')), 2000)
                            )
                        ]);
                    } catch (error) {
                        console.error('ページ離脱時の保存に失敗:', error);
                        // 保存失敗でもページを離れられるようにする
                    }

                    // 一部のブラウザでは確認ダイアログが表示される
                    e.preventDefault();
                    e.returnValue = '';
                }
            });

            console.log('OfzNote アプリケーション起動完了');
        } catch (error) {
            console.error('アプリケーションの初期化に失敗:', error);
            this.showError('アプリケーションの初期化に失敗しました。ページを再読み込みしてください。');
        }
    },

    /**
     * グローバルエラーハンドラーを設定（セキュリティ対策）
     */
    setupGlobalErrorHandlers() {
        // 同期エラー
        window.addEventListener('error', (event) => {
            console.error('グローバルエラー:', event.error);

            // ユーザーに通知（プロダクションでは控えめに）
            if (event.error && event.error.message) {
                this.showError(`エラーが発生しました: ${event.error.message}\n\nページをリロードしてください。`);
            }

            // エラーが伝播しないようにする
            event.preventDefault();
        });

        // 非同期エラー（Promise拒否）
        window.addEventListener('unhandledrejection', (event) => {
            console.error('未処理のPromise拒否:', event.reason);

            // ユーザーに通知
            const message = event.reason?.message || event.reason || '不明なエラー';
            this.showError(`エラーが発生しました: ${message}\n\nページをリロードしてください。`);

            // エラーが伝播しないようにする
            event.preventDefault();
        });
    },

    /**
     * Service Workerを登録
     */
    async registerServiceWorker() {
        if (!('serviceWorker' in navigator)) {
            console.log('このブラウザはService Workerをサポートしていません');
            return;
        }

        // localhost以外では常にService Workerを有効化
        const isProduction = location.hostname !== 'localhost' && location.hostname !== '127.0.0.1';

        if (!isProduction) {
            console.log('開発環境: Service Workerは無効です');
            // 開発環境では既存のService Workerとキャッシュをクリア
            const registrations = await navigator.serviceWorker.getRegistrations();
            for (const registration of registrations) {
                await registration.unregister();
            }
            if ('caches' in window) {
                const cacheNames = await caches.keys();
                for (const cacheName of cacheNames) {
                    await caches.delete(cacheName);
                }
            }
            return;
        }

        // 本番環境: Service Workerを登録
        try {
            const registration = await navigator.serviceWorker.register('./service-worker.js', {
                scope: './'
            });

            console.log('Service Worker登録成功:', registration.scope);

            // 定期的にアップデートをチェック
            setInterval(async () => {
                try {
                    await registration.update();
                } catch (error) {
                    console.error('Service Worker更新確認エラー:', error);
                }
            }, 60000); // 1分ごと

            // 新しいバージョンが利用可能
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        this.showUpdateNotification();
                    }
                });
            });
        } catch (error) {
            console.error('Service Worker登録失敗:', error);
        }
    },

    /**
     * オフラインサポートを設定
     */
    handleOfflineSupport() {
        const indicator = document.createElement('div');
        indicator.id = 'offline-indicator';
        indicator.className = 'offline-indicator';
        indicator.style.cssText = `
            position: fixed;
            top: 0;
            left: 50%;
            transform: translateX(-50%);
            background: #dc3545;
            color: white;
            padding: 8px 20px;
            border-radius: 0 0 8px 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            z-index: 10000;
            display: none;
            font-size: 14px;
        `;
        indicator.innerHTML = '<i class="fas fa-wifi-slash"></i> オフラインモード';
        indicator.setAttribute('role', 'status');
        indicator.setAttribute('aria-live', 'polite');
        document.body.appendChild(indicator);

        window.addEventListener('online', () => {
            indicator.style.display = 'none';
            console.log('オンラインに戻りました');

            // 同期処理をトリガー
            if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                navigator.serviceWorker.controller.postMessage({
                    type: 'SYNC_NOTES'
                });
            }
        });

        window.addEventListener('offline', () => {
            indicator.style.display = 'block';
            console.log('オフラインモードになりました');
        });

        // 初期状態
        if (!navigator.onLine) {
            indicator.style.display = 'block';
        }
    },

    /**
     * インストールプロンプトを処理
     */
    handleInstallPrompt() {
        let deferredPrompt;

        window.addEventListener('beforeinstallprompt', (e) => {
            // デフォルトのプロンプトを防ぐ
            e.preventDefault();
            deferredPrompt = e;

            // インストールボタンを表示
            this.showInstallButton(deferredPrompt);
        });

        window.addEventListener('appinstalled', () => {
            console.log('PWAがインストールされました');
            deferredPrompt = null;
        });
    },

    /**
     * インストールボタンを表示
     */
    showInstallButton(deferredPrompt) {
        const installBtn = document.createElement('button');
        installBtn.className = 'install-btn';
        installBtn.textContent = 'アプリをインストール';
        installBtn.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            padding: 12px 24px;
            background: #007bff;
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            font-size: 14px;
            z-index: 1000;
        `;

        installBtn.addEventListener('click', async () => {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            console.log(`インストールプロンプト結果: ${outcome}`);
            installBtn.remove();
        });

        document.body.appendChild(installBtn);

        // 10秒後に自動で消す
        setTimeout(() => {
            if (installBtn.parentNode) {
                installBtn.remove();
            }
        }, 10000);
    },

    /**
     * アップデート通知を表示
     */
    showUpdateNotification() {
        const notification = document.createElement('div');
        notification.className = 'update-notification';
        notification.innerHTML = `
            <div style="padding: 16px; background: #28a745; color: white; text-align: center; position: fixed; top: 0; left: 0; right: 0; z-index: 1001;">
                <span>新しいバージョンが利用可能です。</span>
                <button onclick="location.reload()" style="margin-left: 16px; padding: 8px 16px; background: white; color: #28a745; border: none; border-radius: 4px; cursor: pointer;">
                    更新
                </button>
            </div>
        `;
        document.body.appendChild(notification);
    },

    /**
     * エラーを表示
     */
    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #dc3545;
            color: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            z-index: 1002;
            max-width: 400px;
            text-align: center;
        `;
        errorDiv.textContent = message;
        document.body.appendChild(errorDiv);
    }
};

// DOMが読み込まれたらアプリを起動
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        App.init();
    });
} else {
    App.init();
}
