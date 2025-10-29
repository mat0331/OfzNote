/**
 * アンドゥ/リドゥ管理モジュール
 */

const UndoManager = {
    undoStack: [],
    redoStack: [],
    maxStackSize: 50,

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
        // Ctrl+Z / Cmd+Z でアンドゥ
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                // textareaにフォーカスがある場合はネイティブのアンドゥに任せる
                if (document.activeElement.id === 'note-content') {
                    return;
                }
                e.preventDefault();
                this.undo();
            }
            // Ctrl+Y / Cmd+Shift+Z でリドゥ
            if (((e.ctrlKey || e.metaKey) && e.key === 'y') ||
                ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z')) {
                // textareaにフォーカスがある場合はネイティブのリドゥに任せる
                if (document.activeElement.id === 'note-content') {
                    return;
                }
                e.preventDefault();
                this.redo();
            }
        });
    },

    /**
     * アクションを記録
     */
    record(action) {
        this.undoStack.push(action);
        // スタックサイズを制限
        if (this.undoStack.length > this.maxStackSize) {
            this.undoStack.shift();
        }
        // 新しいアクションを記録したらリドゥスタックをクリア
        this.redoStack = [];
    },

    /**
     * アンドゥ
     */
    async undo() {
        if (this.undoStack.length === 0) {
            await Dialog.alert('これ以上元に戻せません', '通知', 'info');
            return;
        }

        const action = this.undoStack.pop();
        await this.executeUndo(action);
        this.redoStack.push(action);
    },

    /**
     * リドゥ
     */
    async redo() {
        if (this.redoStack.length === 0) {
            await Dialog.alert('やり直せる操作がありません', '通知', 'info');
            return;
        }

        const action = this.redoStack.pop();
        await this.executeRedo(action);
        this.undoStack.push(action);
    },

    /**
     * アンドゥを実行
     */
    async executeUndo(action) {
        try {
            switch (action.type) {
                case 'deleteNote':
                    // ノートを復元
                    await DB.restoreNote(action.note.id);
                    if (action.note.id === action.currentNoteId) {
                        await Editor.loadNote(action.note);
                    }
                    await UI.refreshAllViews();
                    await Dialog.alert('ノートの削除を取り消しました', '完了', 'success');
                    break;

                case 'renameNote':
                    // 元のタイトルに戻す
                    const note = await DB.getNote(action.noteId);
                    if (note) {
                        note.title = action.oldTitle;
                        await DB.saveNote(note);
                        if (Editor.currentNote && Editor.currentNote.id === action.noteId) {
                            document.getElementById('note-title').value = action.oldTitle;
                            Editor.currentNote.title = action.oldTitle;
                        }
                        await UI.refreshAllViews();
                    }
                    await Dialog.alert('タイトルの変更を取り消しました', '完了', 'success');
                    break;

                case 'deleteFolder':
                    // フォルダを復元
                    await DB.saveFolder(action.folder);
                    // フォルダ内のノートを元に戻す
                    for (const noteId of action.noteIds) {
                        const note = await DB.getNote(noteId);
                        if (note) {
                            note.folderId = action.folder.id;
                            await DB.saveNote(note);
                        }
                    }
                    await UI.refreshAllViews();
                    await Dialog.alert('フォルダの削除を取り消しました', '完了', 'success');
                    break;

                case 'renameFolder':
                    // 元のフォルダ名に戻す
                    const folder = await DB.getFolder(action.folderId);
                    if (folder) {
                        folder.name = action.oldName;
                        const transaction = DB.db.transaction(['folders'], 'readwrite');
                        const store = transaction.objectStore('folders');
                        await new Promise((resolve, reject) => {
                            const request = store.put(folder);
                            request.onsuccess = () => resolve();
                            request.onerror = () => reject(request.error);
                        });
                        await UI.refreshAllViews();
                    }
                    await Dialog.alert('フォルダ名の変更を取り消しました', '完了', 'success');
                    break;
            }
        } catch (error) {
            console.error('アンドゥ実行エラー:', error);
            await Dialog.alert('取り消しに失敗しました', 'エラー', 'error');
        }
    },

    /**
     * リドゥを実行
     */
    async executeRedo(action) {
        try {
            switch (action.type) {
                case 'deleteNote':
                    // もう一度削除
                    await DB.deleteNote(action.note.id);
                    if (action.note.id === action.currentNoteId) {
                        const notes = await DB.getAllNotes();
                        if (notes.length > 0) {
                            await Editor.loadNote(notes[0]);
                        } else {
                            await Editor.createNewNote();
                        }
                    }
                    await UI.refreshAllViews();
                    await Dialog.alert('ノートを再度削除しました', '完了', 'success');
                    break;

                case 'renameNote':
                    // 新しいタイトルに戻す
                    const note = await DB.getNote(action.noteId);
                    if (note) {
                        note.title = action.newTitle;
                        await DB.saveNote(note);
                        if (Editor.currentNote && Editor.currentNote.id === action.noteId) {
                            document.getElementById('note-title').value = action.newTitle;
                            Editor.currentNote.title = action.newTitle;
                        }
                        await UI.refreshAllViews();
                    }
                    await Dialog.alert('タイトルを再度変更しました', '完了', 'success');
                    break;

                case 'deleteFolder':
                    // もう一度削除
                    await DB.deleteFolder(action.folder.id);
                    // ノートを未分類に戻す
                    for (const noteId of action.noteIds) {
                        const note = await DB.getNote(noteId);
                        if (note) {
                            note.folderId = null;
                            await DB.saveNote(note);
                        }
                    }
                    await UI.refreshAllViews();
                    await Dialog.alert('フォルダを再度削除しました', '完了', 'success');
                    break;

                case 'renameFolder':
                    // 新しいフォルダ名に戻す
                    const folder = await DB.getFolder(action.folderId);
                    if (folder) {
                        folder.name = action.newName;
                        const transaction = DB.db.transaction(['folders'], 'readwrite');
                        const store = transaction.objectStore('folders');
                        await new Promise((resolve, reject) => {
                            const request = store.put(folder);
                            request.onsuccess = () => resolve();
                            request.onerror = () => reject(request.error);
                        });
                        await UI.refreshAllViews();
                    }
                    await Dialog.alert('フォルダ名を再度変更しました', '完了', 'success');
                    break;
            }
        } catch (error) {
            console.error('リドゥ実行エラー:', error);
            await Dialog.alert('やり直しに失敗しました', 'エラー', 'error');
        }
    }
};
