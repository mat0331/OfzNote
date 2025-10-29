/**
 * IndexedDB操作モジュール
 */

const DB = {
    name: 'TextEditorDB',
    version: 2,
    db: null,

    /**
     * データベースを初期化
     */
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.name, this.version);

            request.onerror = () => {
                console.error('データベースを開けませんでした');
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                console.log('データベース接続成功');
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                const oldVersion = event.oldVersion;

                // notesストアの作成
                if (!db.objectStoreNames.contains('notes')) {
                    const notesStore = db.createObjectStore('notes', { keyPath: 'id' });
                    notesStore.createIndex('updatedAt', 'updatedAt', { unique: false });
                    notesStore.createIndex('createdAt', 'createdAt', { unique: false });
                    notesStore.createIndex('title', 'title', { unique: false });
                    notesStore.createIndex('isFavorite', 'isFavorite', { unique: false });
                    notesStore.createIndex('folderId', 'folderId', { unique: false });
                }

                // settingsストアの作成
                if (!db.objectStoreNames.contains('settings')) {
                    db.createObjectStore('settings', { keyPath: 'key' });
                }

                // foldersストアの作成（v2）
                if (!db.objectStoreNames.contains('folders')) {
                    const foldersStore = db.createObjectStore('folders', { keyPath: 'id' });
                    foldersStore.createIndex('name', 'name', { unique: false });
                    foldersStore.createIndex('parentId', 'parentId', { unique: false });
                }

                // historyストアの作成（v2）
                if (!db.objectStoreNames.contains('history')) {
                    const historyStore = db.createObjectStore('history', { keyPath: 'id' });
                    historyStore.createIndex('noteId', 'noteId', { unique: false });
                    historyStore.createIndex('savedAt', 'savedAt', { unique: false });
                }

                // v1からv2へのマイグレーション
                if (oldVersion < 2) {
                    const transaction = event.target.transaction;
                    const notesStore = transaction.objectStore('notes');

                    // 既存のインデックスを追加
                    if (!notesStore.indexNames.contains('isFavorite')) {
                        notesStore.createIndex('isFavorite', 'isFavorite', { unique: false });
                    }
                    if (!notesStore.indexNames.contains('folderId')) {
                        notesStore.createIndex('folderId', 'folderId', { unique: false });
                    }

                    // 既存のメモに新フィールドを追加
                    notesStore.openCursor().onsuccess = (event) => {
                        const cursor = event.target.result;
                        if (cursor) {
                            const note = cursor.value;
                            if (note.isFavorite === undefined) {
                                note.isFavorite = false;
                            }
                            if (note.folderId === undefined) {
                                note.folderId = null;
                            }
                            if (note.tags === undefined) {
                                note.tags = [];
                            }
                            cursor.update(note);
                            cursor.continue();
                        }
                    };
                }

                console.log('データベースをアップグレードしました');
            };
        });
    },

    /**
     * UUIDを生成
     */
    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    },

    /**
     * メモを作成
     */
    async createNote(title = '無題のメモ', content = '', folderId = null) {
        const note = {
            id: this.generateUUID(),
            title,
            content,
            createdAt: new Date(),
            updatedAt: new Date(),
            tags: [],
            isFavorite: false,
            folderId: folderId
        };

        return this.saveNote(note);
    },

    /**
     * メモを保存（作成または更新）
     */
    async saveNote(note) {
        note.updatedAt = new Date();

        // FileSystemが有効な場合はファイルに保存
        if (FileSystem.isEnabled) {
            try {
                await FileSystem.saveNoteToFile(note);
                return note;
            } catch (error) {
                console.error('FileSystemへの保存に失敗、IndexedDBにフォールバック:', error);
                // エラー時はIndexedDBに保存（下記処理に続く）
            }
        }

        // IndexedDBに保存（FileSystemが無効またはエラー時）
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['notes'], 'readwrite');
            const store = transaction.objectStore('notes');

            const request = store.put(note);

            request.onsuccess = () => {
                resolve(note);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    },

    /**
     * メモを取得
     */
    async getNote(id) {
        // FileSystemが有効な場合はファイルシステムから取得
        if (FileSystem.isEnabled) {
            try {
                const note = await FileSystem.getNoteById(id);
                if (note) return note;
                // 見つからない場合はIndexedDBにフォールバック
            } catch (error) {
                console.error('FileSystemからのメモ取得に失敗、IndexedDBにフォールバック:', error);
            }
        }

        // IndexedDBから取得
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['notes'], 'readonly');
            const store = transaction.objectStore('notes');
            const request = store.get(id);

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    },

    /**
     * 全メモを取得
     */
    async getAllNotes(sortBy = 'updatedAt', order = 'desc') {
        // FileSystemが有効な場合はファイルシステムから読み込み
        if (FileSystem.isEnabled) {
            try {
                console.log('FileSystemからメモを読み込んでいます...');
                let notes = await FileSystem.getAllNotesFromFS();
                console.log(`FileSystemから${notes.length}件のメモを読み込みました`);

                // 削除済みでないメモのみフィルタ
                notes = notes.filter(note => !note.isDeleted);

                // ソート処理
                notes.sort((a, b) => {
                    let compareValue = 0;

                    if (sortBy === 'title') {
                        compareValue = a.title.localeCompare(b.title, 'ja');
                    } else if (sortBy === 'updatedAt') {
                        compareValue = new Date(a.updatedAt) - new Date(b.updatedAt);
                    } else if (sortBy === 'createdAt') {
                        compareValue = new Date(a.createdAt) - new Date(b.createdAt);
                    }

                    return order === 'desc' ? -compareValue : compareValue;
                });

                return notes;
            } catch (error) {
                console.error('FileSystemからのメモ取得に失敗、IndexedDBにフォールバック:', error);
                // フォールバック処理は下記のIndexedDB処理に続く
            }
        }

        // IndexedDBから取得（FileSystemが無効またはエラー時）
        console.log('IndexedDBからメモを読み込んでいます...');
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['notes'], 'readonly');
            const store = transaction.objectStore('notes');

            let request;
            if (sortBy === 'updatedAt' || sortBy === 'createdAt') {
                const index = store.index(sortBy);
                request = index.openCursor(null, order === 'desc' ? 'prev' : 'next');
            } else {
                request = store.openCursor();
            }

            const notes = [];

            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    // 削除済みでないメモのみ追加
                    if (!cursor.value.isDeleted) {
                        notes.push(cursor.value);
                    }
                    cursor.continue();
                } else {
                    // タイトルでソートする場合
                    if (sortBy === 'title') {
                        notes.sort((a, b) => {
                            return order === 'desc'
                                ? b.title.localeCompare(a.title, 'ja')
                                : a.title.localeCompare(b.title, 'ja');
                        });
                    }
                    console.log(`IndexedDBから${notes.length}件のメモを読み込みました`);
                    resolve(notes);
                }
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    },

    /**
     * メモを削除（ゴミ箱に移動）
     */
    async deleteNote(id) {
        const note = await this.getNote(id);
        if (note) {
            note.isDeleted = true;
            note.deletedAt = new Date();
            return this.saveNote(note);
        }
    },

    /**
     * メモを完全に削除
     */
    async permanentlyDeleteNote(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['notes'], 'readwrite');
            const store = transaction.objectStore('notes');
            const request = store.delete(id);

            request.onsuccess = () => {
                resolve();
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    },

    /**
     * IndexedDBの全メモをクリア（FileSystemモード時に使用）
     */
    async clearAllNotesFromIndexedDB() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['notes'], 'readwrite');
            const store = transaction.objectStore('notes');
            const request = store.clear();

            request.onsuccess = () => {
                console.log('IndexedDBの全メモをクリアしました');
                resolve();
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    },

    /**
     * メモを復元
     */
    async restoreNote(id) {
        const note = await this.getNote(id);
        if (note) {
            note.isDeleted = false;
            note.deletedAt = null;
            return this.saveNote(note);
        }
    },

    /**
     * 削除済みメモを取得
     */
    async getDeletedNotes() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['notes'], 'readonly');
            const store = transaction.objectStore('notes');
            const request = store.getAll();

            request.onsuccess = () => {
                const notes = request.result.filter(note => note.isDeleted === true);
                // 削除日時でソート
                notes.sort((a, b) => new Date(b.deletedAt) - new Date(a.deletedAt));
                resolve(notes);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    },

    /**
     * メモを検索
     */
    async searchNotes(query) {
        const notes = await this.getAllNotes();
        const lowerQuery = query.toLowerCase();

        return notes.filter(note => {
            return note.title.toLowerCase().includes(lowerQuery) ||
                   note.content.toLowerCase().includes(lowerQuery);
        });
    },

    /**
     * 設定を保存
     */
    async saveSetting(key, value) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['settings'], 'readwrite');
            const store = transaction.objectStore('settings');
            const request = store.put({ key, value });

            request.onsuccess = () => {
                resolve();
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    },

    /**
     * 設定を取得
     */
    async getSetting(key, defaultValue = null) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['settings'], 'readonly');
            const store = transaction.objectStore('settings');
            const request = store.get(key);

            request.onsuccess = () => {
                resolve(request.result ? request.result.value : defaultValue);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    },

    /**
     * 全設定を取得
     */
    async getAllSettings() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['settings'], 'readonly');
            const store = transaction.objectStore('settings');
            const request = store.getAll();

            request.onsuccess = () => {
                const settings = {};
                request.result.forEach(item => {
                    settings[item.key] = item.value;
                });
                resolve(settings);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    },

    // ==================== フォルダ機能 ====================

    /**
     * フォルダを作成
     */
    async createFolder(name, parentId = null, color = '#007bff') {
        const folder = {
            id: this.generateUUID(),
            name,
            parentId,
            color,
            createdAt: new Date()
        };

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['folders'], 'readwrite');
            const store = transaction.objectStore('folders');
            const request = store.add(folder);

            request.onsuccess = () => {
                resolve(folder);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    },

    /**
     * フォルダを更新
     */
    async updateFolder(folder) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['folders'], 'readwrite');
            const store = transaction.objectStore('folders');
            const request = store.put(folder);

            request.onsuccess = () => {
                resolve(folder);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    },

    /**
     * フォルダを削除
     */
    async deleteFolder(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['folders', 'notes'], 'readwrite');
            const foldersStore = transaction.objectStore('folders');
            const notesStore = transaction.objectStore('notes');

            // フォルダ内のメモのfolderId をnullに
            const notesIndex = notesStore.index('folderId');
            const notesRequest = notesIndex.openCursor(IDBKeyRange.only(id));

            notesRequest.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    const note = cursor.value;
                    note.folderId = null;
                    cursor.update(note);
                    cursor.continue();
                } else {
                    // メモの更新が完了したらフォルダを削除
                    foldersStore.delete(id);
                }
            };

            transaction.oncomplete = () => {
                resolve();
            };

            transaction.onerror = () => {
                reject(transaction.error);
            };
        });
    },

    /**
     * 全フォルダを取得
     */
    async getAllFolders() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['folders'], 'readonly');
            const store = transaction.objectStore('folders');
            const request = store.getAll();

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    },

    /**
     * フォルダIDでフォルダを取得
     */
    async getFolder(folderId) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['folders'], 'readonly');
            const store = transaction.objectStore('folders');
            const request = store.get(folderId);

            request.onsuccess = () => {
                resolve(request.result || null);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    },

    /**
     * フォルダ名でフォルダを取得
     */
    async getFolderByName(name) {
        const folders = await this.getAllFolders();
        return folders.find(folder => folder.name === name) || null;
    },

    /**
     * フォルダIDでメモを取得
     */
    async getNotesByFolder(folderId) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['notes'], 'readonly');
            const store = transaction.objectStore('notes');
            const index = store.index('folderId');
            const request = index.getAll(folderId);

            request.onsuccess = () => {
                // 削除済みでないメモのみ返す
                const notes = request.result.filter(note => !note.isDeleted);
                resolve(notes);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    },

    // ==================== お気に入り機能 ====================

    /**
     * お気に入り状態を切り替え
     */
    async toggleFavorite(noteId) {
        const note = await this.getNote(noteId);
        if (note) {
            note.isFavorite = !note.isFavorite;
            return this.saveNote(note);
        }
    },

    /**
     * お気に入りメモを取得
     */
    async getFavoriteNotes() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['notes'], 'readonly');
            const store = transaction.objectStore('notes');
            const request = store.getAll();

            request.onsuccess = () => {
                const notes = request.result.filter(note => note.isFavorite === true && !note.isDeleted);
                // 更新日時でソート
                notes.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
                resolve(notes);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    },

    // ==================== タグ機能 ====================

    /**
     * メモにタグを追加
     */
    async addTagToNote(noteId, tag) {
        const note = await this.getNote(noteId);
        if (note && !note.tags.includes(tag)) {
            note.tags.push(tag);
            return this.saveNote(note);
        }
        return note;
    },

    /**
     * メモからタグを削除
     */
    async removeTagFromNote(noteId, tag) {
        const note = await this.getNote(noteId);
        if (note) {
            note.tags = note.tags.filter(t => t !== tag);
            return this.saveNote(note);
        }
        return note;
    },

    /**
     * 全タグを取得（使用頻度順）
     */
    async getAllTags() {
        const notes = await this.getAllNotes();
        const tagCount = {};

        notes.forEach(note => {
            if (note.tags) {
                note.tags.forEach(tag => {
                    tagCount[tag] = (tagCount[tag] || 0) + 1;
                });
            }
        });

        // 使用頻度順にソート
        return Object.entries(tagCount)
            .sort((a, b) => b[1] - a[1])
            .map(([tag, count]) => ({ tag, count }));
    },

    /**
     * タグでメモを検索
     */
    async getNotesByTag(tag) {
        const notes = await this.getAllNotes();
        return notes.filter(note => note.tags && note.tags.includes(tag));
    },

    // ==================== 履歴機能 ====================

    /**
     * 履歴を保存
     */
    async saveHistory(noteId, title, content) {
        const history = {
            id: this.generateUUID(),
            noteId,
            title,
            content,
            savedAt: new Date()
        };

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['history'], 'readwrite');
            const store = transaction.objectStore('history');
            const request = store.add(history);

            request.onsuccess = () => {
                resolve(history);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    },

    /**
     * メモの履歴を取得
     */
    async getNoteHistory(noteId, limit = 20) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['history'], 'readonly');
            const store = transaction.objectStore('history');
            const index = store.index('noteId');
            const request = index.openCursor(IDBKeyRange.only(noteId), 'prev');

            const histories = [];
            let count = 0;

            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor && count < limit) {
                    histories.push(cursor.value);
                    count++;
                    cursor.continue();
                } else {
                    resolve(histories);
                }
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    },

    /**
     * 履歴を削除
     */
    async deleteHistory(historyId) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['history'], 'readwrite');
            const store = transaction.objectStore('history');
            const request = store.delete(historyId);

            request.onsuccess = () => {
                resolve();
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    },

    /**
     * メモの全履歴を削除
     */
    async deleteNoteHistory(noteId) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['history'], 'readwrite');
            const store = transaction.objectStore('history');
            const index = store.index('noteId');
            const request = index.openCursor(IDBKeyRange.only(noteId));

            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    cursor.delete();
                    cursor.continue();
                } else {
                    resolve();
                }
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    },

    /**
     * 古い履歴を自動削除（メモごとに最新N件のみ保持）
     */
    async cleanupOldHistory(keepCount = 20) {
        const notes = await this.getAllNotes();

        for (const note of notes) {
            const histories = await this.getNoteHistory(note.id, 9999);
            if (histories.length > keepCount) {
                // 古い履歴を削除
                const toDelete = histories.slice(keepCount);
                for (const history of toDelete) {
                    await this.deleteHistory(history.id);
                }
            }
        }
    }
};
