/**
 * ファイルシステムアクセスモジュール
 * File System Access API を使用してローカルフォルダに保存
 */

const FileSystem = {
    directoryHandle: null,
    offnoteHandle: null,  // .offnoteフォルダのハンドル
    metadataCache: {},    // メタデータのキャッシュ
    isSupported: false,
    isEnabled: false,

    /**
     * 初期化
     */
    async init() {
        // File System Access API のサポート確認
        this.isSupported = 'showDirectoryPicker' in window;

        if (!this.isSupported) {
            console.log('File System Access API is not supported in this browser');
            return;
        }

        console.log('FileSystem初期化開始...');
        // 保存されたディレクトリハンドルを復元
        await this.restoreDirectoryHandle();

        // .offnoteフォルダを確保
        if (this.isEnabled && this.directoryHandle) {
            await this.ensureOffnoteFolder();
            await this.loadAllMetadata();
        }

        console.log('FileSystem初期化完了:', {
            isEnabled: this.isEnabled,
            hasHandle: !!this.directoryHandle,
            hasOffnote: !!this.offnoteHandle
        });
    },

    /**
     * .offnoteフォルダを確保
     */
    async ensureOffnoteFolder() {
        try {
            this.offnoteHandle = await this.directoryHandle.getDirectoryHandle('.offnote', { create: true });
            console.log('.offnoteフォルダを確保しました');
        } catch (error) {
            console.error('.offnoteフォルダの作成に失敗:', error);
        }
    },

    /**
     * 既存の.meta.jsonファイルを統合メタデータに移行
     */
    async migrateOldMetadata() {
        if (!this.directoryHandle || !this.offnoteHandle) return;

        console.log('既存のメタデータを移行中...');
        let migratedCount = 0;
        let deletedCount = 0;

        try {
            // ルートディレクトリの.meta.jsonファイルを処理
            for await (const entry of this.directoryHandle.values()) {
                if (entry.kind === 'file' && entry.name.startsWith('.') && entry.name.endsWith('.meta.json')) {
                    try {
                        const fileHandle = await this.directoryHandle.getFileHandle(entry.name);
                        const file = await fileHandle.getFile();
                        const text = await file.text();
                        const metadata = JSON.parse(text);

                        // メタデータキャッシュに追加
                        if (metadata.id) {
                            this.metadataCache[metadata.id] = metadata;
                            migratedCount++;
                        }

                        // 古い.meta.jsonファイルを削除
                        await this.directoryHandle.removeEntry(entry.name);
                        deletedCount++;
                    } catch (error) {
                        console.error(`メタデータ移行エラー (${entry.name}):`, error);
                    }
                }
            }

            // サブディレクトリ内の.meta.jsonファイルも処理
            for await (const entry of this.directoryHandle.values()) {
                if (entry.kind === 'directory' && !entry.name.startsWith('.')) {
                    try {
                        const subDirHandle = await this.directoryHandle.getDirectoryHandle(entry.name);
                        for await (const subEntry of subDirHandle.values()) {
                            if (subEntry.kind === 'file' && subEntry.name.startsWith('.') && subEntry.name.endsWith('.meta.json')) {
                                try {
                                    const fileHandle = await subDirHandle.getFileHandle(subEntry.name);
                                    const file = await fileHandle.getFile();
                                    const text = await file.text();
                                    const metadata = JSON.parse(text);

                                    if (metadata.id) {
                                        this.metadataCache[metadata.id] = metadata;
                                        migratedCount++;
                                    }

                                    await subDirHandle.removeEntry(subEntry.name);
                                    deletedCount++;
                                } catch (error) {
                                    console.error(`メタデータ移行エラー (${entry.name}/${subEntry.name}):`, error);
                                }
                            }
                        }
                    } catch (error) {
                        console.error(`サブディレクトリ処理エラー (${entry.name}):`, error);
                    }
                }
            }

            // 統合メタデータを保存
            if (migratedCount > 0) {
                await this.saveAllMetadata();
            }

            console.log(`メタデータ移行完了: ${migratedCount}件移行, ${deletedCount}件の古いファイルを削除`);
        } catch (error) {
            console.error('メタデータ移行エラー:', error);
        }
    },

    /**
     * ディレクトリを選択
     */
    async selectDirectory() {
        if (!this.isSupported) {
            await Dialog.alert('お使いのブラウザはファイルシステムアクセスをサポートしていません。\nChrome、Edge、Opera をご利用ください。', '非対応', 'error');
            return false;
        }

        try {
            // ディレクトリ選択ダイアログを表示
            this.directoryHandle = await window.showDirectoryPicker({
                mode: 'readwrite',
                startIn: 'documents'
            });

            // ディレクトリハンドルを保存
            await this.saveDirectoryHandle();

            this.isEnabled = true;

            // .offnoteフォルダを確保
            await this.ensureOffnoteFolder();

            // 既存の.meta.jsonファイルを統合メタデータに移行
            await this.migrateOldMetadata();

            // 既存のtxtファイルをインポート
            const importResult = await this.importAllNotes();

            // IndexedDB内のメモをエクスポート
            const exportResult = await this.exportAllNotes();

            // IndexedDBのメモをクリア（FileSystemが唯一のデータソースになる）
            try {
                await DB.clearAllNotesFromIndexedDB();
                console.log('FileSystemモード有効化：IndexedDBをクリアしました');
            } catch (error) {
                console.error('IndexedDBのクリアに失敗:', error);
            }

            // 結果を表示
            await Dialog.alert(
                `フォルダとの同期が完了しました。\n\n` +
                `【インポート】\n` +
                `  - ${importResult.success}件のtxtファイルを読み込みました\n` +
                `  - ${importResult.directories || 0}個のサブディレクトリを走査しました\n\n` +
                `【エクスポート】\n` +
                `  - ${exportResult.success}件のメモをファイルに保存しました\n\n` +
                `※IndexedDBのメモデータをクリアしました（FileSystemが唯一のデータソースになります）\n` +
                `※メタデータを.offnote/metadata.jsonに統合しました\n\n` +
                `※ディレクトリ内のファイルは読み込まれましたが、フォルダは自動作成されません\n` +
                `※フォルダ機能を使いたい場合は、アプリ内で手動で作成してください`,
                '同期完了',
                'success'
            );

            return true;
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('ディレクトリ選択エラー:', error);
                await Dialog.alert('ディレクトリの選択に失敗しました', 'エラー', 'error');
            }
            return false;
        }
    },

    /**
     * ディレクトリハンドルを保存（IndexedDB）
     */
    async saveDirectoryHandle() {
        if (!this.directoryHandle) return;

        try {
            await DB.saveSetting('directoryHandle', this.directoryHandle);
            await DB.saveSetting('fileSystemEnabled', true);
        } catch (error) {
            console.error('ディレクトリハンドルの保存に失敗:', error);
        }
    },

    /**
     * ディレクトリハンドルを復元
     */
    async restoreDirectoryHandle() {
        try {
            const enabled = await DB.getSetting('fileSystemEnabled', false);
            if (!enabled) return;

            const handle = await DB.getSetting('directoryHandle');
            if (!handle) return;

            // 権限を確認
            const permission = await handle.queryPermission({ mode: 'readwrite' });

            if (permission === 'granted') {
                this.directoryHandle = handle;
                this.isEnabled = true;
                console.log('ディレクトリハンドルを復元しました');
            } else if (permission === 'prompt') {
                // 権限をリクエスト
                const newPermission = await handle.requestPermission({ mode: 'readwrite' });
                if (newPermission === 'granted') {
                    this.directoryHandle = handle;
                    this.isEnabled = true;
                    console.log('ディレクトリアクセス権限を取得しました');
                }
            }
        } catch (error) {
            console.error('ディレクトリハンドルの復元に失敗:', error);
            this.isEnabled = false;
        }
    },

    /**
     * メモをファイルとして保存
     */
    async saveNoteToFile(note) {
        if (!this.isEnabled || !this.directoryHandle) return;

        try {
            let targetDirectory = this.directoryHandle;

            // フォルダが指定されている場合、フォルダ内に保存
            if (note.folderId) {
                const folder = await DB.getFolder(note.folderId);
                if (folder) {
                    try {
                        targetDirectory = await this.directoryHandle.getDirectoryHandle(folder.name, { create: true });
                    } catch (error) {
                        console.error('フォルダディレクトリの取得に失敗:', error);
                        // フォルダが取得できない場合はルートに保存
                        targetDirectory = this.directoryHandle;
                    }
                }
            }

            // ファイル名を生成（タイトル）
            const filename = this.sanitizeFilename(`${note.title}.txt`);

            // ファイルを作成/上書き
            const fileHandle = await targetDirectory.getFileHandle(filename, { create: true });
            const writable = await fileHandle.createWritable();

            // コンテンツを保存
            await writable.write(note.content);
            await writable.close();

            // メタデータを.offnote/metadata.jsonに保存
            await this.updateNoteMetadata(note);

            console.log(`ファイルに保存: ${filename}`);
        } catch (error) {
            console.error('ファイル保存エラー:', error);
            throw error;
        }
    },

    /**
     * メモのコンテンツをフォーマット（使用しない）
     */
    formatNoteContent(note) {
        return note.content;
    },

    /**
     * ファイルからメモを読み込み
     */
    async loadNoteFromFile(filename, folderHandle = null) {
        if (!this.isEnabled || !this.directoryHandle) return null;

        try {
            const targetDir = folderHandle || this.directoryHandle;
            const fileHandle = await targetDir.getFileHandle(filename);
            const file = await fileHandle.getFile();
            const content = await file.text();

            // ファイル名から拡張子を除いたものをタイトルとする
            const title = filename.replace(/\.txt$/, '');

            // 統合メタデータから情報を取得
            // タイトルで検索して該当するIDを見つける
            let metadata = null;
            let foundId = null;

            // メタデータキャッシュからタイトルが一致するものを探す
            for (const [id, meta] of Object.entries(this.metadataCache)) {
                if (meta.title === title) {
                    metadata = meta;
                    foundId = id;
                    break;
                }
            }

            // メタデータが見つからない場合は新規作成
            if (!metadata) {
                foundId = DB.generateUUID();
                metadata = {
                    id: foundId,
                    title: title,
                    isFavorite: false,
                    folderId: null,
                    tags: [],
                    createdAt: new Date(file.lastModified).toISOString()
                };
            }

            // ファイルの実際の更新日時を優先
            const fileLastModified = new Date(file.lastModified);

            return {
                id: foundId,
                title: title,
                content: content,
                isFavorite: metadata.isFavorite || false,
                folderId: metadata.folderId || null,
                tags: metadata.tags || [],
                createdAt: metadata.createdAt || fileLastModified.toISOString(),
                updatedAt: fileLastModified.toISOString()  // 常にファイルの更新日時を使用
            };
        } catch (error) {
            console.error('ファイル読み込みエラー:', error);
            return null;
        }
    },

    /**
     * 全メタデータを読み込み
     */
    async loadAllMetadata() {
        if (!this.offnoteHandle) return;

        try {
            const fileHandle = await this.offnoteHandle.getFileHandle('metadata.json');
            const file = await fileHandle.getFile();
            const text = await file.text();
            this.metadataCache = JSON.parse(text);
            console.log('メタデータを読み込みました:', Object.keys(this.metadataCache).length, '件');
        } catch (error) {
            // ファイルが存在しない場合は空のオブジェクト
            this.metadataCache = {};
            console.log('メタデータファイルが存在しません（新規作成します）');
        }
    },

    /**
     * 全メタデータを保存
     */
    async saveAllMetadata() {
        if (!this.offnoteHandle) return;

        try {
            const fileHandle = await this.offnoteHandle.getFileHandle('metadata.json', { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(JSON.stringify(this.metadataCache, null, 2));
            await writable.close();
            console.log('メタデータを保存しました:', Object.keys(this.metadataCache).length, '件');
        } catch (error) {
            console.error('メタデータ保存エラー:', error);
            throw error;
        }
    },

    /**
     * 単一メモのメタデータを更新
     */
    async updateNoteMetadata(note) {
        if (!note || !note.id) return;

        this.metadataCache[note.id] = {
            id: note.id,
            title: note.title,  // タイトルも保存（ファイル名変更時の追跡用）
            isFavorite: note.isFavorite || false,
            folderId: note.folderId || null,
            tags: note.tags || [],
            createdAt: note.createdAt
        };

        await this.saveAllMetadata();
    },

    /**
     * メモのメタデータを取得
     */
    getMetadataById(noteId) {
        return this.metadataCache[noteId] || {
            id: noteId,
            isFavorite: false,
            folderId: null,
            tags: [],
            createdAt: new Date().toISOString()
        };
    },

    /**
     * メタデータを削除
     */
    async deleteMetadata(noteId) {
        delete this.metadataCache[noteId];
        await this.saveAllMetadata();
    },

    /**
     * すべてのメモを取得（ファイルシステムから）
     */
    async getAllNotesFromFS() {
        if (!this.isEnabled || !this.directoryHandle) return [];

        try {
            const notes = [];
            const seenIds = new Set(); // 重複チェック用

            // ルートディレクトリのファイルを読み込み
            for await (const entry of this.directoryHandle.values()) {
                // .meta.jsonファイルや隠しファイル（.で始まる）をスキップ
                if (entry.name.startsWith('.') || entry.name.endsWith('.meta.json')) {
                    continue;
                }

                if (entry.kind === 'file' && entry.name.endsWith('.txt')) {
                    const note = await this.loadNoteFromFile(entry.name);
                    if (note) {
                        console.log(`ルート: ${entry.name} (ID: ${note.id})`);
                        if (!seenIds.has(note.id)) {
                            seenIds.add(note.id);
                            notes.push(note);
                        } else {
                            console.warn(`重複ID検出: ${note.id} (${entry.name})`);
                        }
                    }
                } else if (entry.kind === 'directory') {
                    // 隠しディレクトリをスキップ
                    if (entry.name.startsWith('.')) {
                        continue;
                    }

                    // サブディレクトリ内のファイルを読み込み（ディレクトリをフォルダとして作成）
                    let existingFolder = await DB.getFolderByName(entry.name);
                    let folderId;

                    if (existingFolder) {
                        folderId = existingFolder.id;
                        console.log(`サブディレクトリ: ${entry.name} → 既存フォルダ「${existingFolder.name}」(ID: ${folderId})に紐付け`);
                    } else {
                        // 新規フォルダを作成
                        const newFolder = await DB.createFolder(entry.name);
                        folderId = newFolder.id;
                        console.log(`サブディレクトリ: ${entry.name} → 新規フォルダ「${newFolder.name}」(ID: ${folderId})を作成`);
                    }

                    const subDirHandle = await this.directoryHandle.getDirectoryHandle(entry.name);
                    for await (const subEntry of subDirHandle.values()) {
                        // .meta.jsonファイルや隠しファイルをスキップ
                        if (subEntry.name.startsWith('.') || subEntry.name.endsWith('.meta.json')) {
                            continue;
                        }

                        if (subEntry.kind === 'file' && subEntry.name.endsWith('.txt')) {
                            const note = await this.loadNoteFromFile(subEntry.name, subDirHandle);
                            if (note) {
                                // フォルダIDを設定
                                note.folderId = folderId;
                                console.log(`  ${entry.name}/${subEntry.name} (ID: ${note.id}, フォルダID: ${folderId})`);
                                if (!seenIds.has(note.id)) {
                                    seenIds.add(note.id);
                                    notes.push(note);
                                } else {
                                    console.warn(`重複ID検出: ${note.id} (${entry.name}/${subEntry.name})`);
                                }
                            }
                        }
                    }
                }
            }

            console.log(`合計: ${notes.length}件のユニークなメモ`);
            return notes;
        } catch (error) {
            console.error('全メモの取得に失敗:', error);
            return [];
        }
    },

    /**
     * IDでメモを取得
     */
    async getNoteById(noteId) {
        const notes = await this.getAllNotesFromFS();
        return notes.find(note => note.id === noteId) || null;
    },

    /**
     * タイトルでメモを検索
     */
    async getNoteByTitle(title) {
        const notes = await this.getAllNotesFromFS();
        return notes.find(note => note.title === title) || null;
    },

    /**
     * 全メモをファイルにエクスポート
     */
    async exportAllNotes() {
        if (!this.isEnabled || !this.directoryHandle) return;

        try {
            const notes = await DB.getAllNotes();
            let successCount = 0;
            let errorCount = 0;

            for (const note of notes) {
                try {
                    await this.saveNoteToFile(note);
                    successCount++;
                } catch (error) {
                    console.error(`メモ ${note.title} の保存に失敗:`, error);
                    errorCount++;
                }
            }

            console.log(`ファイルシステムに保存: ${successCount}件成功, ${errorCount}件失敗`);
            return { success: successCount, failed: errorCount };
        } catch (error) {
            console.error('全メモのエクスポートに失敗:', error);
            throw error;
        }
    },

    /**
     * ディレクトリから全メモをインポート（サブディレクトリも含む）
     * 注: フォルダは自動作成しません。ファイルの読み込みのみ行います。
     */
    async importAllNotes() {
        if (!this.isEnabled || !this.directoryHandle) return;

        try {
            const notes = [];
            let dirCount = 0;

            // ステップ1: ルートディレクトリのファイルを読み込み
            for await (const entry of this.directoryHandle.values()) {
                if (entry.kind === 'file' && entry.name.endsWith('.txt')) {
                    const note = await this.loadNoteFromFile(entry.name);
                    if (note) {
                        console.log(`ルートからインポート: ${entry.name}`);
                        notes.push(note);
                    }
                }
            }

            // ステップ2: サブディレクトリ内のファイルを読み込み（ディレクトリをフォルダとして作成）
            for await (const entry of this.directoryHandle.values()) {
                // 隠しディレクトリをスキップ
                if (entry.name.startsWith('.')) {
                    continue;
                }

                if (entry.kind === 'directory') {
                    dirCount++;

                    // DBから同名のフォルダを検索、なければ作成
                    let existingFolder = await DB.getFolderByName(entry.name);
                    let folderId;

                    if (existingFolder) {
                        folderId = existingFolder.id;
                        console.log(`サブディレクトリを走査: ${entry.name} → 既存フォルダ「${existingFolder.name}」(ID: ${folderId})に紐付け`);
                    } else {
                        // 新規フォルダを作成
                        const newFolder = await DB.createFolder(entry.name);
                        folderId = newFolder.id;
                        console.log(`サブディレクトリを走査: ${entry.name} → 新規フォルダ「${newFolder.name}」(ID: ${folderId})を作成`);
                    }

                    const subDirHandle = await this.directoryHandle.getDirectoryHandle(entry.name);
                    for await (const subEntry of subDirHandle.values()) {
                        // 隠しファイルをスキップ
                        if (subEntry.name.startsWith('.') || subEntry.name.endsWith('.meta.json')) {
                            continue;
                        }

                        if (subEntry.kind === 'file' && subEntry.name.endsWith('.txt')) {
                            const note = await this.loadNoteFromFile(subEntry.name, subDirHandle);
                            if (note) {
                                // フォルダIDを設定
                                note.folderId = folderId;

                                console.log(`  ${entry.name}/${subEntry.name} からインポート (フォルダID: ${folderId})`);
                                notes.push(note);

                                // メタデータを更新
                                if (note.id) {
                                    this.metadataCache[note.id] = {
                                        id: note.id,
                                        title: note.title,
                                        isFavorite: note.isFavorite || false,
                                        folderId: folderId,
                                        tags: note.tags || [],
                                        createdAt: note.createdAt
                                    };
                                }
                            }
                        }
                    }
                }
            }

            // メタデータを保存
            if (Object.keys(this.metadataCache).length > 0) {
                await this.saveAllMetadata();
            }

            // IndexedDBに保存
            let successCount = 0;
            for (const note of notes) {
                try {
                    await DB.saveNote(note);
                    successCount++;
                } catch (error) {
                    console.error(`メモ ${note.title} のインポートに失敗:`, error);
                }
            }

            console.log(`ファイルシステムから読み込み: ${successCount}/${notes.length}件`);
            console.log(`ディレクトリ数: ${dirCount}個`);
            return { success: successCount, total: notes.length, directories: dirCount };
        } catch (error) {
            console.error('全メモのインポートに失敗:', error);
            throw error;
        }
    },

    /**
     * ファイルのみを削除（メタデータは残す）
     */
    async deleteFileOnly(note) {
        if (!this.isEnabled || !this.directoryHandle) return;

        try {
            let targetDirectory = this.directoryHandle;

            // フォルダ内のファイルの場合
            if (note.folderId) {
                const folder = await DB.getFolder(note.folderId);
                if (folder) {
                    try {
                        targetDirectory = await this.directoryHandle.getDirectoryHandle(folder.name);
                    } catch (error) {
                        // フォルダが存在しない場合はルートから探す
                        targetDirectory = this.directoryHandle;
                    }
                }
            }

            const filename = this.sanitizeFilename(`${note.title}.txt`);
            await targetDirectory.removeEntry(filename);
            console.log(`ファイル削除: ${filename}`);
        } catch (error) {
            console.error('ファイル削除エラー:', error);
        }
    },

    /**
     * メモを削除（ファイルも削除）
     */
    async deleteNoteFile(note) {
        if (!this.isEnabled || !this.directoryHandle) return;

        try {
            // ファイルを削除
            await this.deleteFileOnly(note);

            // メタデータも削除
            if (note.id) {
                await this.deleteMetadata(note.id);
            }
        } catch (error) {
            console.error('ファイル削除エラー:', error);
        }
    },

    /**
     * フォルダディレクトリを作成
     */
    async createFolderDirectory(folder) {
        if (!this.isEnabled || !this.directoryHandle) return;

        try {
            const dirName = this.sanitizeFilename(folder.name);
            await this.directoryHandle.getDirectoryHandle(dirName, { create: true });
            console.log(`ディレクトリ作成: ${dirName}`);
        } catch (error) {
            console.error('ディレクトリ作成エラー:', error);
            throw error;
        }
    },

    /**
     * フォルダディレクトリ名を変更
     */
    async renameFolderDirectory(oldName, newName) {
        if (!this.isEnabled || !this.directoryHandle) return;

        try {
            const oldDirName = this.sanitizeFilename(oldName);
            const newDirName = this.sanitizeFilename(newName);

            // 古いディレクトリを取得
            const oldDir = await this.directoryHandle.getDirectoryHandle(oldDirName);

            // 新しいディレクトリを作成
            const newDir = await this.directoryHandle.getDirectoryHandle(newDirName, { create: true });

            // 全ファイルを移動
            for await (const entry of oldDir.values()) {
                if (entry.kind === 'file') {
                    const file = await entry.getFile();
                    const newFileHandle = await newDir.getFileHandle(entry.name, { create: true });
                    const writable = await newFileHandle.createWritable();
                    await writable.write(file);
                    await writable.close();
                }
            }

            // 古いディレクトリを削除
            await this.directoryHandle.removeEntry(oldDirName, { recursive: true });

            console.log(`ディレクトリ名変更: ${oldDirName} → ${newDirName}`);
        } catch (error) {
            console.error('ディレクトリ名変更エラー:', error);
            throw error;
        }
    },

    /**
     * フォルダディレクトリを削除
     */
    async deleteFolderDirectory(folderName) {
        if (!this.isEnabled || !this.directoryHandle) return;

        try {
            const dirName = this.sanitizeFilename(folderName);
            await this.directoryHandle.removeEntry(dirName, { recursive: true });
            console.log(`ディレクトリ削除: ${dirName}`);
        } catch (error) {
            console.error('ディレクトリ削除エラー:', error);
            throw error;
        }
    },

    /**
     * ファイルシステムモードを無効化
     */
    async disable() {
        // FileSystemのメモをIndexedDBにバックアップ
        if (this.isEnabled && this.directoryHandle) {
            try {
                console.log('FileSystemモード無効化：メモをIndexedDBにバックアップしています...');
                const notes = await this.getAllNotesFromFS();

                let successCount = 0;
                for (const note of notes) {
                    try {
                        // IndexedDBに直接保存（FileSystem.isEnabledがfalseになる前に）
                        const transaction = DB.db.transaction(['notes'], 'readwrite');
                        const store = transaction.objectStore('notes');
                        await new Promise((resolve, reject) => {
                            const request = store.put(note);
                            request.onsuccess = () => resolve();
                            request.onerror = () => reject(request.error);
                        });
                        successCount++;
                    } catch (error) {
                        console.error(`メモ ${note.title} のバックアップに失敗:`, error);
                    }
                }
                console.log(`${successCount}/${notes.length}件のメモをIndexedDBにバックアップしました`);
            } catch (error) {
                console.error('メモのバックアップに失敗:', error);
            }
        }

        this.isEnabled = false;
        this.directoryHandle = null;
        await DB.saveSetting('fileSystemEnabled', false);
        await DB.saveSetting('directoryHandle', null);

        console.log('FileSystemモードを無効化しました');
    },

    /**
     * ファイル名をサニタイズ
     */
    sanitizeFilename(filename) {
        return filename
            .replace(/[<>:"\/\\|?*\x00-\x1F]/g, '_')
            .replace(/\s+/g, '_')
            .substring(0, 200);
    },

    /**
     * ステータスを取得
     */
    getStatus() {
        return {
            supported: this.isSupported,
            enabled: this.isEnabled,
            directory: this.directoryHandle?.name || null
        };
    }
};
