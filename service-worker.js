/**
 * Service Worker for OfzNote PWA
 */

const CACHE_NAME = 'ofznote-v2.3.1';
const urlsToCache = [
    './',
    './index.html',
    './manifest.json',
    './css/style.css',
    './css/extensions.css',
    './css/themes/light.css',
    './css/themes/dark.css',
    './css/themes/sepia.css',
    './js/app.js',
    './js/db.js',
    './js/dialog.js',
    './js/editor.js',
    './js/storage.js',
    './js/ui.js',
    './js/extensions.js',
    './js/filesystem.js'
];

/**
 * インストールイベント
 */
self.addEventListener('install', (event) => {
    console.log('Service Worker: Installing...');

    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Service Worker: Caching files');
                return cache.addAll(urlsToCache);
            })
            .then(() => {
                console.log('Service Worker: Installation complete');
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('Service Worker: Installation failed', error);
            })
    );
});

/**
 * アクティベーションイベント
 */
self.addEventListener('activate', (event) => {
    console.log('Service Worker: Activating...');

    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== CACHE_NAME) {
                            console.log('Service Worker: Deleting old cache', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log('Service Worker: Activation complete');
                return self.clients.claim();
            })
    );
});

/**
 * フェッチイベント - Cache First戦略
 */
self.addEventListener('fetch', (event) => {
    // GETリクエストのみキャッシュ
    if (event.request.method !== 'GET') {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // キャッシュにあればそれを返す
                if (response) {
                    return response;
                }

                // キャッシュになければネットワークから取得
                return fetch(event.request)
                    .then((response) => {
                        // 有効なレスポンスでない場合はそのまま返す
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }

                        // レスポンスのクローンをキャッシュに保存
                        const responseToCache = response.clone();

                        caches.open(CACHE_NAME)
                            .then((cache) => {
                                cache.put(event.request, responseToCache);
                            });

                        return response;
                    })
                    .catch((error) => {
                        console.error('Service Worker: Fetch failed', error);

                        // オフライン時のフォールバック
                        // 必要に応じてオフラインページを返す
                        return caches.match('./index.html');
                    });
            })
    );
});

/**
 * メッセージイベント
 */
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

/**
 * 同期イベント（バックグラウンド同期）
 */
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-notes') {
        event.waitUntil(syncNotes());
    }
});

/**
 * メモを同期（将来の拡張用）
 */
async function syncNotes() {
    console.log('Service Worker: Syncing notes...');
    // 将来的にクラウド同期機能を実装する場合はここに処理を追加
}

/**
 * プッシュ通知イベント（将来の拡張用）
 */
self.addEventListener('push', (event) => {
    if (event.data) {
        const data = event.data.json();
        const options = {
            body: data.body,
            icon: './icons/icon-192.png',
            badge: './icons/icon-72.png'
        };

        event.waitUntil(
            self.registration.showNotification(data.title, options)
        );
    }
});

/**
 * 通知クリックイベント
 */
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    event.waitUntil(
        clients.openWindow('./')
    );
});
