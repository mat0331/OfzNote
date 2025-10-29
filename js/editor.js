/**
 * エディタ機能モジュール
 */

const Editor = {
    currentNote: null,
    autoSaveTimer: null,
    autoSaveInterval: 3000, // 3秒
    isDirty: false, // 未保存の変更があるか
    oldTitle: null, // アンドゥ用：編集前のタイトル
    saveStatus: 'saved', // 保存状態

    elements: {
        titleInput: null,
        contentTextarea: null,
        noteMeta: null
    },

    /**
     * 初期化
     */
    init() {
        this.elements.titleInput = document.getElementById('note-title');
        this.elements.contentTextarea = document.getElementById('note-content');
        this.elements.noteMeta = document.getElementById('note-meta');

        this.bindEvents();
        this.loadLastNote();
    },

    /**
     * イベントをバインド
     */
    bindEvents() {
        // タイトル入力
        this.elements.titleInput.addEventListener('input', () => {
            this.markDirty();
            this.scheduleAutoSave();
        });

        // タイトル編集開始時：元のタイトルを保存
        this.elements.titleInput.addEventListener('focus', () => {
            if (this.currentNote) {
                this.oldTitle = this.currentNote.title;
            }
        });

        // タイトル編集終了時：変更があればアンドゥ記録
        this.elements.titleInput.addEventListener('blur', () => {
            if (this.currentNote && this.oldTitle !== null) {
                const newTitle = this.elements.titleInput.value || '無題のメモ';
                if (this.oldTitle !== newTitle) {
                    UndoManager.record({
                        type: 'renameNote',
                        noteId: this.currentNote.id,
                        oldTitle: this.oldTitle,
                        newTitle: newTitle
                    });
                }
                this.oldTitle = null;
            }
        });

        // 本文入力
        this.elements.contentTextarea.addEventListener('input', () => {
            this.markDirty();
            this.scheduleAutoSave();
        });

        // ショートカットキー
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + S: 保存
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                this.saveNow();
            }

            // Ctrl/Cmd + N: 新規メモ
            if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
                e.preventDefault();
                this.createNewNote();
            }

            // Ctrl/Cmd + F: 検索
            if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
                e.preventDefault();
                document.getElementById('search-input').focus();
            }

            // Ctrl/Cmd + E: エクスポート
            if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
                e.preventDefault();
                this.exportCurrentNote();
            }

            // Ctrl/Cmd + ,: 設定
            if ((e.ctrlKey || e.metaKey) && e.key === ',') {
                e.preventDefault();
                UI.openSettings();
            }

            // F1: ヘルプ
            if (e.key === 'F1') {
                e.preventDefault();
                UI.openHelp();
            }
        });
    },

    /**
     * 最後に編集したメモを読み込む
     */
    async loadLastNote() {
        try {
            const lastNoteId = await DB.getSetting('lastNoteId');

            if (lastNoteId) {
                const note = await DB.getNote(lastNoteId);
                if (note) {
                    this.loadNote(note);
                    return;
                }
            }

            // 最後のメモがない場合、最新のメモを読み込む
            const notes = await DB.getAllNotes();
            if (notes.length > 0) {
                this.loadNote(notes[0]);
            } else {
                // メモが1つもない場合、新規作成
                this.createNewNote();
            }
        } catch (error) {
            console.error('メモの読み込みに失敗:', error);
            this.createNewNote();
        }
    },

    /**
     * メモを読み込む
     */
    loadNote(note) {
        // 未保存の変更がある場合は保存
        if (this.isDirty && this.currentNote) {
            this.saveNow();
        }

        this.currentNote = note;
        this.elements.titleInput.value = note.title;
        this.elements.contentTextarea.value = note.content;
        this.isDirty = false;

        this.updateSaveIndicator('saved');
        this.updateNoteMeta();

        // 最後に編集したメモIDを保存
        DB.saveSetting('lastNoteId', note.id);

        // フォーカスをコンテンツに移動
        this.elements.contentTextarea.focus();
    },

    /**
     * 新規メモを作成
     */
    async createNewNote() {
        // 未保存の変更がある場合は保存
        if (this.isDirty && this.currentNote) {
            await this.saveNow();
        }

        try {
            const note = await DB.createNote();
            this.loadNote(note);
            UI.refreshCurrentTab();

            // タイトル入力にフォーカス
            this.elements.titleInput.select();
        } catch (error) {
            console.error('新規メモの作成に失敗:', error);
            Dialog.alert('メモの作成に失敗しました', 'エラー', 'error');
        }
    },

    /**
     * 未保存フラグを立てる
     */
    markDirty() {
        this.isDirty = true;
        this.updateSaveIndicator('unsaved');
    },

    /**
     * 自動保存をスケジュール
     */
    scheduleAutoSave() {
        if (this.autoSaveTimer) {
            clearTimeout(this.autoSaveTimer);
        }

        this.autoSaveTimer = setTimeout(() => {
            this.saveNow();
        }, this.autoSaveInterval);
    },

    /**
     * 今すぐ保存
     */
    async saveNow(saveHistory = true) {
        if (!this.currentNote || !this.isDirty) {
            return;
        }

        this.updateSaveIndicator('saving');

        try {
            const newTitle = this.elements.titleInput.value || '無題のメモ';
            const newContent = this.elements.contentTextarea.value;

            // 履歴を保存（手動保存の場合のみ）
            if (saveHistory && this.shouldSaveHistory(newTitle, newContent)) {
                await DB.saveHistory(this.currentNote.id, newTitle, newContent);
            }

            this.currentNote.title = newTitle;
            this.currentNote.content = newContent;

            await DB.saveNote(this.currentNote);

            // ファイルシステムにも保存（有効な場合）
            if (FileSystem.isEnabled) {
                try {
                    await FileSystem.saveNoteToFile(this.currentNote);
                } catch (error) {
                    console.error('ファイルシステムへの保存に失敗:', error);
                }
            }

            this.isDirty = false;
            this.updateSaveIndicator('saved');
            this.updateNoteMeta();

            // メモ一覧を更新
            UI.refreshCurrentTab();
        } catch (error) {
            console.error('保存に失敗:', error);
            this.updateSaveIndicator('error');

            // リトライ
            setTimeout(() => {
                this.saveNow();
            }, 5000);
        }
    },

    /**
     * 履歴を保存すべきか判断（意味のある変更がある場合のみ）
     */
    shouldSaveHistory(newTitle, newContent) {
        // 最後の履歴と比較して、十分な変更があるか確認
        // 簡易実装：文字数が一定以上変化した場合のみ
        const oldLength = (this.currentNote.content || '').length;
        const newLength = newContent.length;
        const diff = Math.abs(newLength - oldLength);

        // 10文字以上の変更があれば履歴保存
        return diff >= 10;
    },

    /**
     * 保存インジケーターを更新
     */
    updateSaveIndicator(status) {
        this.saveStatus = status;
        this.updateNoteMeta(); // メタ情報を更新（保存状態を含む）
    },

    /**
     * メモのメタ情報を更新
     */
    updateNoteMeta() {
        if (!this.currentNote) {
            this.elements.noteMeta.textContent = '';
            return;
        }

        const created = Storage.formatDate(this.currentNote.createdAt);
        const updated = Storage.formatDate(this.currentNote.updatedAt);
        const charCount = this.currentNote.content.length;

        // 保存状態のテキストとクラス
        let saveStatusText = '';
        let saveStatusClass = '';

        switch (this.saveStatus) {
            case 'saving':
                saveStatusText = '保存中...';
                saveStatusClass = 'save-status-saving';
                break;
            case 'saved':
                saveStatusText = '保存済み';
                saveStatusClass = 'save-status-saved';
                break;
            case 'unsaved':
                saveStatusText = '未保存';
                saveStatusClass = 'save-status-unsaved';
                break;
            case 'error':
                saveStatusText = '保存失敗';
                saveStatusClass = 'save-status-error';
                break;
            default:
                saveStatusText = '保存済み';
                saveStatusClass = 'save-status-saved';
        }

        this.elements.noteMeta.innerHTML = `
            作成: ${created} | 更新: ${updated} | 文字数: ${charCount} |
            <span class="save-status ${saveStatusClass}">${saveStatusText}</span>
        `;
    },

    /**
     * 現在のメモを削除
     */
    async deleteCurrentNote() {
        if (!this.currentNote) {
            return;
        }

        const confirmation = await Dialog.confirm(
            `「${this.currentNote.title}」を削除しますか？\nこの操作は取り消せません。`,
            '削除の確認',
            'warning'
        );

        if (!confirmation) {
            return;
        }

        try {
            const noteToDelete = this.currentNote;
            await DB.deleteNote(noteToDelete.id);

            // ファイルシステムからも削除（有効な場合）
            if (FileSystem.isEnabled) {
                try {
                    await FileSystem.deleteNoteFile(noteToDelete);
                } catch (error) {
                    console.error('ファイルシステムからの削除に失敗:', error);
                }
            }

            // 次のメモを読み込む
            const notes = await DB.getAllNotes();
            if (notes.length > 0) {
                this.loadNote(notes[0]);
            } else {
                this.createNewNote();
            }

            UI.refreshCurrentTab();
        } catch (error) {
            console.error('削除に失敗:', error);
            Dialog.alert('メモの削除に失敗しました', 'エラー', 'error');
        }
    },

    /**
     * 現在のメモをエクスポート
     */
    exportCurrentNote() {
        if (!this.currentNote) {
            return;
        }

        // 最新の内容を反映
        this.currentNote.title = this.elements.titleInput.value || '無題のメモ';
        this.currentNote.content = this.elements.contentTextarea.value;

        Storage.exportNote(this.currentNote);
    },

    /**
     * 設定を適用
     */
    applySettings(settings) {
        const textarea = this.elements.contentTextarea;
        const titleInput = this.elements.titleInput;

        if (settings.fontFamily) {
            textarea.style.fontFamily = settings.fontFamily;
            titleInput.style.fontFamily = settings.fontFamily;
        }

        if (settings.fontSize) {
            textarea.style.fontSize = settings.fontSize + 'px';
        }

        if (settings.lineHeight) {
            textarea.style.lineHeight = settings.lineHeight;
        }

    }
};
