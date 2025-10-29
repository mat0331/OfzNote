/**
 * メインアプリケーション
 */

const App = {
    /**
     * アプリケーションを初期化
     */
    async init() {
        console.log('OfzNote アプリケーション起動中...');

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

            // インストールプロンプトを処理
            this.handleInstallPrompt();

            // ページを閉じる前に保存
            window.addEventListener('beforeunload', (e) => {
                if (Editor.isDirty) {
                    Editor.saveNow();
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
     * Service Workerを登録
     */
    async registerServiceWorker() {
        // 開発中はService Workerを無効化
        if ('serviceWorker' in navigator) {
            // 既存のService Workerを全て削除
            const registrations = await navigator.serviceWorker.getRegistrations();
            for (const registration of registrations) {
                await registration.unregister();
                console.log('Service Worker削除:', registration.scope);
            }

            // キャッシュも削除
            if ('caches' in window) {
                const cacheNames = await caches.keys();
                for (const cacheName of cacheNames) {
                    await caches.delete(cacheName);
                    console.log('キャッシュ削除:', cacheName);
                }
            }

            console.log('Service Workerとキャッシュを削除しました');

            // 本番環境では以下のコメントを外してService Workerを有効化
            /*
            try {
                const registration = await navigator.serviceWorker.register('./service-worker.js');
                console.log('Service Worker登録成功:', registration.scope);

                // アップデートをチェック
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            // 新しいバージョンが利用可能
                            this.showUpdateNotification();
                        }
                    });
                });
            } catch (error) {
                console.error('Service Worker登録失敗:', error);
            }
            */
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
