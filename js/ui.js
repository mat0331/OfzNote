/**
 * UI制御モジュール（拡張版）
 */

'use strict';

const UI = {
    currentSortBy: 'updatedAt',
    searchQuery: '',
    isSidebarOpen: true,
    currentTab: 'all',
    currentFolderId: null,
    currentTagFilter: null,

    /**
     * 初期化
     */
    init() {
        this.bindEvents();
        this.refreshAllViews();
        this.loadSettings();
        this.checkMobileView();
        this.applySystemColorScheme();
        this.listenToSystemColorScheme();
    },

    /**
     * イベントをバインド
     */
    bindEvents() {
        // 既存のイベント
        this.bindBasicEvents();
        // 新機能のイベント
        this.bindTabEvents();
        this.bindFavoriteEvents();
        this.bindTagEvents();
        this.bindFolderEvents();
        this.bindHistoryEvents();
    },

    /**
     * 基本イベントをバインド
     */
    bindBasicEvents() {
        // 新規メモボタン
        document.getElementById('new-note').addEventListener('click', () => {
            Editor.createNewNote();
        });

        // エクスポートボタン
        document.getElementById('export-note').addEventListener('click', () => {
            Editor.exportCurrentNote();
        });

        // ヘッダーフォントコントロール
        const headerFontFamily = document.getElementById('header-font-family');
        if (headerFontFamily) {
            headerFontFamily.addEventListener('change', (e) => {
                this.updateSetting('fontFamily', e.target.value);
            });
        }

        const headerFontSize = document.getElementById('header-font-size');
        if (headerFontSize) {
            headerFontSize.addEventListener('change', (e) => {
                this.updateSetting('fontSize', parseInt(e.target.value));
            });
        }

        // インラインタグ入力
        const tagInput = document.getElementById('tag-input');
        if (tagInput) {
            tagInput.addEventListener('keypress', async (e) => {
                if (e.key === 'Enter' && tagInput.value.trim()) {
                    const tagName = tagInput.value.trim();
                    await this.addTagInline(tagName);
                    tagInput.value = '';
                    this.updateTagSuggestions('');
                }
            });

            // フォーカス時にタグ候補を表示
            tagInput.addEventListener('focus', () => {
                this.updateTagSuggestions(tagInput.value);
            });

            // 入力時にタグ候補をフィルタリング
            tagInput.addEventListener('input', (e) => {
                this.updateTagSuggestions(e.target.value);
            });

            // フォーカスアウト時に候補を非表示（少し遅延させてクリックイベントを処理）
            tagInput.addEventListener('blur', () => {
                setTimeout(() => {
                    const suggestions = document.getElementById('tag-suggestions');
                    if (suggestions) {
                        suggestions.style.display = 'none';
                    }
                }, 200);
            });
        }

        // 全メモエクスポートボタン
        document.getElementById('export-all-btn').addEventListener('click', () => {
            Storage.exportAllNotes();
        });

        // 検索入力
        const searchInput = document.getElementById('search-input');
        searchInput.addEventListener('input', (e) => {
            this.searchQuery = e.target.value;
            this.refreshNoteList();
        });

        // ソート選択
        document.getElementById('sort-select').addEventListener('change', (e) => {
            this.currentSortBy = e.target.value;
            this.refreshNoteList();
        });

        // サイドバートグル
        document.getElementById('toggle-sidebar').addEventListener('click', () => {
            this.toggleSidebar();
        });

        // サイドバーを開くボタン
        const sidebarToggleOpen = document.getElementById('sidebar-toggle-open');
        if (sidebarToggleOpen) {
            sidebarToggleOpen.addEventListener('click', () => {
                this.openSidebar();
            });
        }

        // モバイルメニューボタン
        const mobileMenuBtn = document.getElementById('mobile-menu-btn');
        if (mobileMenuBtn) {
            mobileMenuBtn.addEventListener('click', () => {
                this.toggleSidebar();
            });
        }

        // Ctrl/Cmd + B: サイドバートグル
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
                e.preventDefault();
                this.toggleSidebar();
            }
        });

        // 設定ボタン
        document.getElementById('settings-btn').addEventListener('click', () => {
            this.openSettings();
        });

        // 設定モーダルを閉じる
        document.getElementById('close-settings').addEventListener('click', () => {
            this.closeSettings();
        });

        // モーダル外クリックで閉じる
        document.getElementById('settings-modal').addEventListener('click', (e) => {
            if (e.target.id === 'settings-modal') {
                this.closeSettings();
            }
        });

        // ヘルプボタン
        document.getElementById('help-btn').addEventListener('click', () => {
            this.openHelp();
        });

        // ヘルプモーダルを閉じる
        document.getElementById('close-help').addEventListener('click', () => {
            this.closeHelp();
        });

        // モーダル外クリックで閉じる
        document.getElementById('help-modal').addEventListener('click', (e) => {
            if (e.target.id === 'help-modal') {
                this.closeHelp();
            }
        });

        // テーマ選択
        document.querySelectorAll('.theme-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const theme = e.target.dataset.theme;
                this.changeTheme(theme);
            });
        });

        // サイドバー個別テーマ設定
        const separateThemeCheckbox = document.getElementById('separate-sidebar-theme');
        if (separateThemeCheckbox) {
            separateThemeCheckbox.addEventListener('change', async (e) => {
                const sidebarThemeSection = document.getElementById('sidebar-theme-section');
                if (e.target.checked) {
                    sidebarThemeSection.style.display = 'block';
                    await DB.saveSetting('separateSidebarTheme', true);
                } else {
                    sidebarThemeSection.style.display = 'none';
                    await DB.saveSetting('separateSidebarTheme', false);
                    // サイドバーテーマをリセット（エディタテーマと同じに）
                    const mainTheme = await DB.getSetting('theme', 'light');
                    this.applySidebarTheme(mainTheme);
                }
            });
        }

        // サイドバーテーマ選択
        document.querySelectorAll('.sidebar-theme-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const theme = e.target.dataset.theme;
                await this.changeSidebarTheme(theme);
            });
        });

        // フォント設定
        document.getElementById('font-family').addEventListener('change', (e) => {
            this.updateSetting('fontFamily', e.target.value);
        });

        document.getElementById('font-size').addEventListener('input', (e) => {
            const value = e.target.value;
            document.getElementById('font-size-value').textContent = value + 'px';
            this.updateSetting('fontSize', parseInt(value));
        });

        document.getElementById('line-height').addEventListener('input', (e) => {
            const value = e.target.value;
            document.getElementById('line-height-value').textContent = value;
            this.updateSetting('lineHeight', parseFloat(value));
        });

        // メモ一覧サイズ
        document.getElementById('note-list-size').addEventListener('change', (e) => {
            this.applyNoteListSize(e.target.value);
            this.updateSetting('noteListSize', e.target.value);
        });

        // ファイルインポート
        document.getElementById('import-file').addEventListener('click', () => {
            document.getElementById('file-input').click();
        });

        document.getElementById('file-input').addEventListener('change', async (e) => {
            const files = Array.from(e.target.files);
            if (files.length > 0) {
                await this.importFiles(files);
                e.target.value = ''; // リセット
            }
        });

        // 履歴クリーンアップ
        const cleanupBtn = document.getElementById('cleanup-history-btn');
        if (cleanupBtn) {
            cleanupBtn.addEventListener('click', async () => {
                const confirmed = await Dialog.confirm('古い履歴を削除しますか？（各メモの最新20件のみ保持）', '履歴のクリーンアップ');
                if (confirmed) {
                    await DB.cleanupOldHistory(20);
                    Dialog.alert('古い履歴を削除しました', '完了', 'success');
                }
            });
        }

        // ファイルシステム機能
        const selectDirBtn = document.getElementById('select-directory-btn');
        if (selectDirBtn) {
            selectDirBtn.addEventListener('click', async () => {
                const success = await FileSystem.selectDirectory();
                if (success) {
                    this.updateFileSystemStatus();
                    Dialog.alert('ローカルフォルダに全メモを保存しました！', '完了', 'success');
                }
            });
        }

        const syncToBtn = document.getElementById('sync-to-filesystem-btn');
        if (syncToBtn) {
            syncToBtn.addEventListener('click', async () => {
                try {
                    const result = await FileSystem.exportAllNotes();
                    Dialog.alert(`${result.success}件のメモをフォルダに保存しました`, '同期完了', 'success');
                } catch (error) {
                    Dialog.alert('同期に失敗しました', 'エラー', 'error');
                }
            });
        }

        const syncFromBtn = document.getElementById('sync-from-filesystem-btn');
        if (syncFromBtn) {
            syncFromBtn.addEventListener('click', async () => {
                try {
                    const result = await FileSystem.importAllNotes();
                    Dialog.alert(`${result.success}/${result.total}件のメモを読み込みました`, '読み込み完了', 'success');
                    this.refreshAllViews();
                } catch (error) {
                    Dialog.alert('読み込みに失敗しました', 'エラー', 'error');
                }
            });
        }

        const disableFsBtn = document.getElementById('disable-filesystem-btn');
        if (disableFsBtn) {
            disableFsBtn.addEventListener('click', async () => {
                const confirmed = await Dialog.confirm('ローカルフォルダへの自動保存を無効化しますか？', '設定変更の確認');
                if (confirmed) {
                    await FileSystem.disable();
                    this.updateFileSystemStatus();
                    Dialog.alert('ブラウザ内保存に戻しました', '完了', 'success');
                }
            });
        }

        // ドラッグ&ドロップ（ファイルのみ、テキストドラッグは除外）
        const editorContainer = document.getElementById('editor-container');
        let dragCounter = 0;

        editorContainer.addEventListener('dragenter', (e) => {
            // ファイルのドラッグのみ処理（テキストドラッグは無視）
            if (e.dataTransfer.types.includes('Files')) {
                e.preventDefault();
                dragCounter++;
                editorContainer.classList.add('drag-over');
            }
        });

        editorContainer.addEventListener('dragover', (e) => {
            // ファイルのドラッグのみ処理
            if (e.dataTransfer.types.includes('Files')) {
                e.preventDefault();
                e.stopPropagation();
            }
        });

        editorContainer.addEventListener('dragleave', (e) => {
            // ファイルのドラッグのみ処理
            if (e.dataTransfer.types.includes('Files')) {
                e.preventDefault();
                dragCounter--;
                if (dragCounter === 0) {
                    editorContainer.classList.remove('drag-over');
                }
            }
        });

        editorContainer.addEventListener('drop', async (e) => {
            // ファイルがある場合のみ処理
            if (e.dataTransfer.files.length === 0) {
                return; // テキストドラッグは無視
            }

            e.preventDefault();
            e.stopPropagation();
            dragCounter = 0;
            editorContainer.classList.remove('drag-over');

            const files = Array.from(e.dataTransfer.files).filter(f => {
                // .txt, .md, text/plainなどのテキストファイルを許可
                return f.name.endsWith('.txt') ||
                       f.name.endsWith('.md') ||
                       f.type === 'text/plain' ||
                       f.type === 'text/markdown';
            });

            if (files.length > 0) {
                await this.importFiles(files);
            } else if (e.dataTransfer.files.length > 0) {
                Dialog.alert('テキストファイル（.txt, .md）のみインポートできます', '通知', 'info');
            }
        });

        // ウィンドウリサイズ
        window.addEventListener('resize', () => {
            this.checkMobileView();
        });

        // モバイル用オーバーフローメニュー
        const overflowBtn = document.getElementById('editor-overflow-btn');
        const overflowMenu = document.getElementById('editor-overflow-menu');

        if (overflowBtn && overflowMenu) {
            // オーバーフローボタンクリック
            overflowBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const isExpanded = overflowBtn.getAttribute('aria-expanded') === 'true';

                if (isExpanded) {
                    this.closeOverflowMenu();
                } else {
                    this.openOverflowMenu();
                }
            });

            // メニュー項目クリック
            overflowMenu.querySelectorAll('.overflow-menu-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    const action = item.dataset.action;
                    this.handleOverflowAction(action);
                    this.closeOverflowMenu();
                });
            });

            // メニュー外クリックで閉じる
            document.addEventListener('click', (e) => {
                if (!overflowMenu.contains(e.target) && !overflowBtn.contains(e.target)) {
                    this.closeOverflowMenu();
                }
            });
        }
    },

    /**
     * タブイベントをバインド
     */
    bindTabEvents() {
        document.querySelectorAll('.tab-btn').forEach((btn, index) => {
            btn.addEventListener('click', (e) => {
                // ボタン要素を確実に取得（アイコンをクリックしてもOK）
                const button = e.currentTarget;
                const tab = button.dataset.tab;
                if (tab) {
                    this.switchTab(tab);
                }
            });

            // キーボードナビゲーション（アクセシビリティ対応）
            btn.addEventListener('keydown', (e) => {
                const buttons = Array.from(document.querySelectorAll('.tab-btn'));
                const currentIndex = buttons.indexOf(e.currentTarget);

                switch (e.key) {
                    case 'ArrowLeft':
                    case 'ArrowUp':
                        e.preventDefault();
                        const prevBtn = buttons[(currentIndex - 1 + buttons.length) % buttons.length];
                        prevBtn.focus();
                        prevBtn.click();
                        break;
                    case 'ArrowRight':
                    case 'ArrowDown':
                        e.preventDefault();
                        const nextBtn = buttons[(currentIndex + 1) % buttons.length];
                        nextBtn.focus();
                        nextBtn.click();
                        break;
                    case 'Enter':
                    case ' ':
                        e.preventDefault();
                        e.currentTarget.click();
                        break;
                }
            });
        });
    },

    /**
     * お気に入りイベントをバインド
     */
    bindFavoriteEvents() {
        const favBtn = document.getElementById('toggle-favorite');
        if (favBtn) {
            favBtn.addEventListener('click', async () => {
                await this.toggleFavorite();
            });
        }
    },

    /**
     * タグイベントをバインド
     */
    bindTagEvents() {
        const closeBtn = document.getElementById('close-tags-dialog');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeTagsDialog());
        }

        const addBtn = document.getElementById('add-tag-btn');
        if (addBtn) {
            addBtn.addEventListener('click', () => this.addTag());
        }

        const newTagInput = document.getElementById('new-tag-input');
        if (newTagInput) {
            newTagInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.addTag();
                }
            });
        }
    },

    /**
     * フォルダイベントをバインド
     */
    bindFolderEvents() {
        const closeBtn = document.getElementById('close-folder-dialog');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeFolderDialog());
        }

        const newFolderBtn = document.getElementById('new-folder');
        if (newFolderBtn) {
            newFolderBtn.addEventListener('click', () => this.createNewFolder());
        }
    },

    /**
     * 履歴イベントをバインド
     */
    bindHistoryEvents() {
        const closeBtn = document.getElementById('close-history-dialog');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeHistoryDialog());
        }
    },

    /**
     * タブを切り替え
     */
    switchTab(tab) {
        this.currentTab = tab;

        // タブボタンのアクティブ状態を更新
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });

        // タブコンテンツの表示を更新
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `tab-${tab}`);
        });

        // 対応するビューを更新
        switch (tab) {
            case 'all':
                this.refreshNoteList();
                break;
            case 'favorites':
                this.refreshFavoritesList();
                break;
            case 'tags':
                this.refreshTagCloud();
                break;
            case 'trash':
                this.refreshTrashList();
                break;
        }
    },

    /**
     * 全ビューを更新
     */
    async refreshAllViews() {
        await this.refreshNoteList();
        await this.refreshFavoritesList();
        await this.refreshTagCloud();
        await this.refreshTrashList();
    },

    /**
     * 現在のタブだけを更新
     */
    async refreshCurrentTab() {
        switch (this.currentTab) {
            case 'all':
                await this.refreshNoteList();
                break;
            case 'favorites':
                await this.refreshFavoritesList();
                break;
            case 'tags':
                await this.refreshTagCloud();
                break;
            case 'trash':
                await this.refreshTrashList();
                break;
        }
    },

    /**
     * メモ一覧を更新
     */
    async refreshNoteList() {
        try {
            let notes;

            if (this.searchQuery) {
                notes = await DB.searchNotes(this.searchQuery);
            } else {
                notes = await DB.getAllNotes(this.currentSortBy);
            }

            this.renderNoteList(notes, 'note-list');
        } catch (error) {
            console.error('メモ一覧の取得に失敗:', error);
        }
    },

    /**
     * お気に入り一覧を更新
     */
    async refreshFavoritesList() {
        try {
            const notes = await DB.getFavoriteNotes();
            this.renderNoteList(notes, 'favorites-list');
        } catch (error) {
            console.error('お気に入り一覧の取得に失敗:', error);
        }
    },

    /**
     * メモ一覧をレンダリング（フォルダ階層表示）
     * パフォーマンス改善: DocumentFragmentを使用
     */
    async renderNoteList(notes, listId) {
        const noteList = document.getElementById(listId);

        if (notes.length === 0) {
            noteList.innerHTML = '<li class="note-list-empty">メモがありません</li>';
            return;
        }

        // DocumentFragmentを使用してDOMの再描画を最小化
        const fragment = document.createDocumentFragment();

        // メモ一覧タブ以外（お気に入りなど）はフラット表示
        if (listId !== 'note-list') {
            this.renderFlatNoteList(notes, fragment);
            noteList.innerHTML = '';
            noteList.appendChild(fragment);
            return;
        }

        // フォルダ情報を取得
        const folders = await DB.getAllFolders();
        const folderMap = new Map(folders.map(f => [f.id, f])); // Mapを使用

        // フォルダごとにメモをグループ化
        const grouped = {
            root: [] // ルートレベルのメモ（フォルダに属さない）
        };

        notes.forEach(note => {
            if (note.folderId) {
                if (!grouped[note.folderId]) {
                    grouped[note.folderId] = [];
                }
                grouped[note.folderId].push(note);
            } else {
                grouped.root.push(note);
            }
        });

        // フォルダごとに表示（空のフォルダも表示）
        folders.forEach(folder => {
            const folderNotes = grouped[folder.id] || [];
            this.renderFolderGroup(fragment, folder, folderNotes, folder.name);
        });

        // ルートレベルのメモを最後に表示
        if (grouped.root.length > 0) {
            grouped.root.forEach(note => {
                const li = this.createNoteListItem(note);
                fragment.appendChild(li);
            });
        }

        // 一度のDOM更新で全て反映
        noteList.innerHTML = '';
        noteList.appendChild(fragment);
    },

    /**
     * フォルダグループをレンダリング
     */
    renderFolderGroup(noteList, folder, notes, folderName) {
        // フォルダヘッダー
        const folderHeader = document.createElement('li');
        folderHeader.className = 'folder-group-header';

        const folderIcon = document.createElement('i');
        folderIcon.className = 'fas fa-chevron-down folder-toggle-icon';

        const folderTitle = document.createElement('span');
        folderTitle.className = 'folder-group-title';
        folderTitle.textContent = folderName;

        const noteCount = document.createElement('span');
        noteCount.className = 'folder-group-count';
        noteCount.textContent = `(${notes.length})`;

        folderHeader.appendChild(folderIcon);
        folderHeader.appendChild(folderTitle);
        folderHeader.appendChild(noteCount);

        // フォルダアクションボタン（フォルダが存在する場合のみ）
        if (folder) {
            const folderActions = document.createElement('div');
            folderActions.className = 'folder-group-actions';

            const renameBtn = document.createElement('button');
            renameBtn.className = 'folder-action-btn';
            renameBtn.innerHTML = '<i class="fas fa-edit"></i>';
            renameBtn.title = '名前を変更';
            renameBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.renameFolderDialog(folder);
            });

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'folder-action-btn';
            deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';
            deleteBtn.title = '削除';
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteFolderDialog(folder);
            });

            folderActions.appendChild(renameBtn);
            folderActions.appendChild(deleteBtn);
            folderHeader.appendChild(folderActions);
        }

        // 折りたたみ機能
        const groupId = folder ? `folder-${folder.id}` : 'folder-uncategorized';
        const isCollapsed = localStorage.getItem(`${groupId}-collapsed`) === 'true';

        folderHeader.addEventListener('click', (e) => {
            // ドラッグ&ドロップやアクションボタンのクリックは無視
            if (e.target.closest('.folder-group-actions')) return;

            const container = folderHeader.nextElementSibling;
            const isCurrentlyCollapsed = container.style.display === 'none';

            container.style.display = isCurrentlyCollapsed ? 'block' : 'none';
            folderIcon.className = isCurrentlyCollapsed ? 'fas fa-chevron-down folder-toggle-icon' : 'fas fa-chevron-right folder-toggle-icon';

            localStorage.setItem(`${groupId}-collapsed`, !isCurrentlyCollapsed);
        });

        // ドラッグ&ドロップ機能
        folderHeader.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            folderHeader.classList.add('drag-over');
        });

        folderHeader.addEventListener('dragleave', (e) => {
            if (e.target === folderHeader) {
                folderHeader.classList.remove('drag-over');
            }
        });

        folderHeader.addEventListener('drop', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            folderHeader.classList.remove('drag-over');

            const noteId = e.dataTransfer.getData('text/plain');
            if (!noteId) return;

            // メモを取得
            const note = await DB.getNote(noteId);
            if (!note) return;

            // FileSystemが有効な場合、古いファイルを削除してから新しい場所に保存
            if (FileSystem.isEnabled) {
                try {
                    // 古いファイルのみを削除（メタデータは残す）
                    await FileSystem.deleteFileOnly(note);
                } catch (error) {
                    console.error('旧ファイルの削除に失敗:', error);
                }
            }

            // フォルダに移動
            const targetFolderId = folder ? folder.id : null;
            note.folderId = targetFolderId;
            await DB.saveNote(note);

            // FileSystemに新しい場所で保存
            if (FileSystem.isEnabled) {
                try {
                    await FileSystem.saveNoteToFile(note);
                } catch (error) {
                    console.error('ファイルの移動に失敗:', error);
                    Dialog.alert('ファイルの移動に失敗しました', 'エラー', 'error');
                    await this.refreshNoteList();
                    return;
                }
            }

            // UI更新
            await this.refreshNoteList();

            // 通知
            if (targetFolderId) {
                Dialog.alert(`「${note.title}」を「${folder.name}」に移動しました`, '完了', 'success');
            } else {
                Dialog.alert(`「${note.title}」をフォルダなしに移動しました`, '完了', 'success');
            }
        });

        noteList.appendChild(folderHeader);

        // メモコンテナ
        const notesContainer = document.createElement('li');
        notesContainer.className = 'folder-group-notes';
        notesContainer.style.display = isCollapsed ? 'none' : 'block';

        if (isCollapsed) {
            folderIcon.className = 'fas fa-chevron-right folder-toggle-icon';
        }

        const notesList = document.createElement('ul');
        notesList.className = 'note-sublist';

        this.renderFlatNoteList(notes, notesList);

        notesContainer.appendChild(notesList);
        noteList.appendChild(notesContainer);
    },

    /**
     * 単一のメモアイテムを作成
     */
    createNoteListItem(note) {
        const li = document.createElement('li');
        li.className = 'note-item';
        li.draggable = true;
        li.dataset.noteId = note.id;

        if (Editor.currentNote && Editor.currentNote.id === note.id) {
            li.classList.add('active');
        }

        // ドラッグ開始
        li.addEventListener('dragstart', (e) => {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', note.id);
            li.classList.add('dragging');
        });

        // ドラッグ終了
        li.addEventListener('dragend', (e) => {
            li.classList.remove('dragging');
        });

        const title = document.createElement('div');
        title.className = 'note-item-title';
        if (note.isFavorite) {
            const starIcon = document.createElement('i');
            starIcon.className = 'fas fa-star favorite-star-small';
            title.appendChild(starIcon);
            title.appendChild(document.createTextNode(' ' + note.title));
        } else {
            title.textContent = note.title;
        }

        const meta = document.createElement('div');
        meta.className = 'note-item-meta';
        meta.textContent = Storage.formatDate(note.updatedAt);

        const preview = document.createElement('div');
        preview.className = 'note-item-preview';
        preview.textContent = note.content.substring(0, 50) + (note.content.length > 50 ? '...' : '');

        li.appendChild(title);
        li.appendChild(meta);
        li.appendChild(preview);

        // アクションボタンを追加
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'note-item-actions';

        // フォルダ移動ボタン
        const folderBtn = document.createElement('button');
        folderBtn.className = 'note-item-action-btn';
        folderBtn.innerHTML = '<i class="fas fa-folder"></i>';
        folderBtn.title = 'フォルダに移動';
        folderBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            await this.openFolderMoveDialog(note);
        });

        // 削除ボタン
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'note-item-action-btn';
        deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';
        deleteBtn.title = '削除';
        deleteBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            await this.deleteNoteFromList(note);
        });

        actionsDiv.appendChild(folderBtn);
        actionsDiv.appendChild(deleteBtn);
        li.appendChild(actionsDiv);

        li.addEventListener('click', (e) => {
            // アクションボタンのクリックは無視
            if (e.target.closest('.note-item-actions')) return;

            Editor.loadNote(note);
            this.updateNoteTagsDisplay();
            this.updateInlineTagsDisplay();
            this.updateFavoriteIcon();
            this.refreshCurrentTab();

            // モバイルでサイドバーを閉じる
            if (window.innerWidth < 768) {
                this.closeSidebar();
            }
        });

        return li;
    },

    /**
     * フラットなメモ一覧をレンダリング
     */
    renderFlatNoteList(notes, container) {
        notes.forEach(note => {
            const li = this.createNoteListItem(note);
            container.appendChild(li);
        });
    },

    /**
     * サイドバーからメモを削除
     */
    async deleteNoteFromList(note) {
        const confirmed = await Dialog.confirm(
            `「${note.title}」をゴミ箱に移動しますか？\nゴミ箱タブから復元できます。\n\n※Ctrl+Zで取り消せます`,
            'ゴミ箱へ移動',
            'warning'
        );

        if (!confirmed) return;

        try {
            const currentNoteId = Editor.currentNote ? Editor.currentNote.id : null;

            // アンドゥ用に記録
            UndoManager.record({
                type: 'deleteNote',
                note: {...note}, // ディープコピー
                currentNoteId: currentNoteId
            });

            await DB.deleteNote(note.id);

            // ファイルシステムからも削除
            if (FileSystem.isEnabled) {
                try {
                    await FileSystem.deleteNoteFile(note);
                } catch (error) {
                    console.error('ファイルシステムからの削除に失敗:', error);
                }
            }

            // 削除したメモが現在開いているメモの場合
            if (Editor.currentNote && Editor.currentNote.id === note.id) {
                // 次のメモを読み込む
                const notes = await DB.getAllNotes();
                if (notes.length > 0) {
                    Editor.loadNote(notes[0]);
                } else {
                    Editor.createNewNote();
                }
            }

            this.refreshCurrentTab();
            Dialog.alert('メモをゴミ箱に移動しました\n\n※Ctrl+Zで取り消せます', '完了', 'success');
        } catch (error) {
            console.error('削除に失敗:', error);
            Dialog.alert('メモの削除に失敗しました', 'エラー', 'error');
        }
    },


    /**
     * フォルダアイテムを作成
     */
    createFolderItem(folder, noteCount = 0) {
        const li = document.createElement('li');
        li.className = 'folder-item';
        if (this.currentFolderId === folder.id) {
            li.classList.add('active');
        }

        const colorSpan = document.createElement('span');
        colorSpan.className = 'folder-color';
        colorSpan.style.background = folder.color;

        const nameSpan = document.createElement('span');
        nameSpan.className = 'folder-name';
        nameSpan.textContent = folder.name;

        const countSpan = document.createElement('span');
        countSpan.className = 'folder-count';
        countSpan.textContent = noteCount;

        li.appendChild(colorSpan);
        li.appendChild(nameSpan);
        li.appendChild(countSpan);

        // フォルダなし以外のフォルダには編集・削除ボタンを追加
        if (folder.id !== null) {
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'folder-actions';

            const editBtn = document.createElement('button');
            editBtn.className = 'folder-action-btn';
            editBtn.innerHTML = '<i class="fas fa-edit"></i>';
            editBtn.title = '名前を変更';
            editBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await this.renameFolderDialog(folder);
            });

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'folder-action-btn';
            deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';
            deleteBtn.title = '削除';
            deleteBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await this.deleteFolderDialog(folder);
            });

            actionsDiv.appendChild(editBtn);
            actionsDiv.appendChild(deleteBtn);
            li.appendChild(actionsDiv);
        }

        li.addEventListener('click', async (e) => {
            // アクションボタンのクリックは無視
            if (e.target.closest('.folder-actions')) return;

            this.currentFolderId = folder.id;
            // フォルダ内のノートを取得してallタブに表示
            const notes = folder.id === null
                ? (await DB.getAllNotes()).filter(n => !n.folderId)
                : await DB.getNotesByFolder(folder.id);
            this.switchTab('all');
            this.renderNoteList(notes, 'note-list');
        });

        return li;
    },

    /**
     * タグクラウドを更新
     */
    async refreshTagCloud() {
        try {
            const tags = await DB.getAllTags();
            const tagCloud = document.getElementById('tag-cloud');
            tagCloud.innerHTML = '';

            if (tags.length === 0) {
                tagCloud.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--meta-color);">タグがありません</div>';
                return;
            }

            // タグの色設定を取得
            const tagColors = await DB.getSetting('tagColors', {});

            tags.forEach(({ tag, count }) => {
                const tagItem = document.createElement('div');
                tagItem.className = 'tag-item';

                // タグの色を適用
                if (tagColors[tag]) {
                    tagItem.style.backgroundColor = tagColors[tag];
                    tagItem.style.color = this.getContrastColor(tagColors[tag]);
                }

                const tagName = document.createElement('span');
                tagName.textContent = tag;

                const tagCountSpan = document.createElement('span');
                tagCountSpan.className = 'tag-count';
                tagCountSpan.textContent = count;

                // 色変更ボタン
                const colorBtn = document.createElement('button');
                colorBtn.className = 'tag-color-btn';
                colorBtn.innerHTML = '<i class="fas fa-palette"></i>';
                colorBtn.title = 'タグの色を変更';
                colorBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    await this.changeTagColor(tag);
                });

                tagItem.appendChild(tagName);
                tagItem.appendChild(tagCountSpan);
                tagItem.appendChild(colorBtn);

                tagItem.addEventListener('click', async () => {
                    const notes = await DB.getNotesByTag(tag);
                    this.switchTab('all');
                    this.renderNoteList(notes, 'note-list');
                });

                tagCloud.appendChild(tagItem);
            });
        } catch (error) {
            console.error('タグクラウドの取得に失敗:', error);
        }
    },

    /**
     * タグの色を変更
     */
    async changeTagColor(tag) {
        // カラーピッカーダイアログを作成
        const tagColors = await DB.getSetting('tagColors', {});
        const currentColor = tagColors[tag] || '#007bff';

        const dialogHtml = `
            <div class="custom-dialog-overlay active" id="tag-color-dialog-backdrop" style="display: flex;">
                <div class="custom-dialog" style="text-align: left;">
                    <div class="custom-dialog-title" style="text-align: center; font-size: 20px; margin-bottom: 20px;">
                        タグの色を変更
                    </div>
                    <div class="custom-dialog-message" style="text-align: center;">
                        <p style="margin-bottom: 12px;">「${tag}」の色を選択してください</p>
                        <input type="color" id="tag-color-picker" value="${currentColor}" style="width: 100%; height: 50px; border: none; cursor: pointer;">
                    </div>
                    <div class="custom-dialog-buttons" style="margin-top: 24px;">
                        <button class="custom-dialog-btn secondary" id="tag-color-reset">リセット</button>
                        <button class="custom-dialog-btn secondary" id="tag-color-cancel">キャンセル</button>
                        <button class="custom-dialog-btn primary" id="tag-color-ok">適用</button>
                    </div>
                </div>
            </div>
        `;

        // ダイアログをDOMに追加
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = dialogHtml;
        document.body.appendChild(tempDiv.firstElementChild);

        // イベントリスナーを設定
        const backdrop = document.getElementById('tag-color-dialog-backdrop');
        const cancelBtn = document.getElementById('tag-color-cancel');
        const okBtn = document.getElementById('tag-color-ok');
        const resetBtn = document.getElementById('tag-color-reset');
        const colorPicker = document.getElementById('tag-color-picker');

        return new Promise((resolve) => {
            const closeDialog = () => {
                backdrop.remove();
                resolve();
            };

            cancelBtn.addEventListener('click', closeDialog);

            backdrop.addEventListener('click', (e) => {
                if (e.target === backdrop) {
                    closeDialog();
                }
            });

            // リセットボタン
            resetBtn.addEventListener('click', async () => {
                delete tagColors[tag];
                await DB.saveSetting('tagColors', tagColors);
                await this.refreshTagCloud();
                this.updateInlineTagsDisplay();
                closeDialog();
                Dialog.alert('タグの色をリセットしました', '完了', 'success');
            });

            // 適用ボタン
            okBtn.addEventListener('click', async () => {
                const selectedColor = colorPicker.value;
                tagColors[tag] = selectedColor;
                await DB.saveSetting('tagColors', tagColors);
                await this.refreshTagCloud();
                this.updateInlineTagsDisplay();
                closeDialog();
                Dialog.alert('タグの色を変更しました', '完了', 'success');
            });
        });
    },

    /**
     * 背景色に対するコントラスト色を計算（白または黒を返す）
     */
    getContrastColor(hexColor) {
        // 16進数カラーをRGBに変換
        const r = parseInt(hexColor.slice(1, 3), 16);
        const g = parseInt(hexColor.slice(3, 5), 16);
        const b = parseInt(hexColor.slice(5, 7), 16);

        // 輝度を計算 (相対輝度の簡易版)
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

        // 輝度が0.5より大きい場合は黒、小さい場合は白を返す
        return luminance > 0.5 ? '#000000' : '#ffffff';
    },

    /**
     * お気に入りを切り替え
     */
    async toggleFavorite() {
        if (!Editor.currentNote) return;

        await DB.toggleFavorite(Editor.currentNote.id);
        Editor.currentNote.isFavorite = !Editor.currentNote.isFavorite;

        this.updateFavoriteIcon();
        this.refreshCurrentTab();
    },

    /**
     * お気に入りアイコンを更新
     */
    updateFavoriteIcon() {
        const icon = document.getElementById('favorite-icon');
        if (icon && Editor.currentNote) {
            if (Editor.currentNote.isFavorite) {
                icon.className = 'fas fa-star';
            } else {
                icon.className = 'far fa-star';
            }
            icon.classList.toggle('active', Editor.currentNote.isFavorite);
        }
    },

    /**
     * タグダイアログを開く
     */
    async openTagsDialog() {
        if (!Editor.currentNote) return;

        const dialog = document.getElementById('tags-dialog');
        dialog.classList.add('active');

        // 現在のタグを表示
        this.renderCurrentTags();

        // サジェストタグを表示
        const allTags = await DB.getAllTags();
        const suggestedTags = document.getElementById('suggested-tags');
        suggestedTags.innerHTML = '<h4>よく使うタグ</h4>';

        allTags.slice(0, 10).forEach(({ tag }) => {
            if (!Editor.currentNote.tags.includes(tag)) {
                const tagItem = document.createElement('span');
                tagItem.className = 'suggested-tag-item';
                tagItem.textContent = tag;
                tagItem.addEventListener('click', async () => {
                    await this.addTagToNote(tag);
                });
                suggestedTags.appendChild(tagItem);
            }
        });
    },

    /**
     * タグダイアログを閉じる
     */
    closeTagsDialog() {
        const dialog = document.getElementById('tags-dialog');
        dialog.classList.remove('active');
    },

    /**
     * 現在のタグを表示
     */
    renderCurrentTags() {
        const currentTags = document.getElementById('current-tags');
        currentTags.innerHTML = '';

        if (Editor.currentNote && Editor.currentNote.tags) {
            Editor.currentNote.tags.forEach(tag => {
                const chip = document.createElement('div');
                chip.className = 'current-tag-chip';

                const tagName = document.createElement('span');
                tagName.textContent = tag;

                const removeBtn = document.createElement('span');
                removeBtn.className = 'remove';
                removeBtn.textContent = '×';
                removeBtn.addEventListener('click', async () => {
                    await this.removeTagFromNote(tag);
                });

                chip.appendChild(tagName);
                chip.appendChild(removeBtn);
                currentTags.appendChild(chip);
            });
        }
    },

    /**
     * タグを追加
     */
    async addTag() {
        const input = document.getElementById('new-tag-input');
        const tag = input.value.trim();

        if (tag && Editor.currentNote) {
            await this.addTagToNote(tag);
            input.value = '';
        }
    },

    /**
     * メモにタグを追加
     */
    async addTagToNote(tag) {
        await DB.addTagToNote(Editor.currentNote.id, tag);
        Editor.currentNote.tags.push(tag);

        // メモを保存
        await DB.saveNote(Editor.currentNote);

        // FileSystemにも保存
        if (FileSystem.isEnabled) {
            try {
                await FileSystem.updateNoteMetadata(Editor.currentNote);
            } catch (error) {
                console.error('メタデータの保存に失敗:', error);
            }
        }

        this.renderCurrentTags();
        this.updateNoteTagsDisplay();
        this.refreshTagCloud();
    },

    /**
     * メモからタグを削除
     */
    async removeTagFromNote(tag) {
        await DB.removeTagFromNote(Editor.currentNote.id, tag);
        Editor.currentNote.tags = Editor.currentNote.tags.filter(t => t !== tag);

        // メモを保存
        await DB.saveNote(Editor.currentNote);

        // FileSystemにも保存
        if (FileSystem.isEnabled) {
            try {
                await FileSystem.updateNoteMetadata(Editor.currentNote);
            } catch (error) {
                console.error('メタデータの保存に失敗:', error);
            }
        }

        this.renderCurrentTags();
        this.updateNoteTagsDisplay();
        this.updateInlineTagsDisplay();
        this.refreshTagCloud();
    },

    /**
     * メモのタグ表示を更新
     */
    updateNoteTagsDisplay() {
        const display = document.getElementById('note-tags-display');
        display.innerHTML = '';

        if (Editor.currentNote && Editor.currentNote.tags && Editor.currentNote.tags.length > 0) {
            Editor.currentNote.tags.forEach(tag => {
                const chip = document.createElement('div');
                chip.className = 'note-tag-chip';

                const tagName = document.createElement('span');
                tagName.textContent = tag;

                const removeBtn = document.createElement('span');
                removeBtn.className = 'remove-tag';
                removeBtn.textContent = '×';
                removeBtn.addEventListener('click', async () => {
                    await this.removeTagFromNote(tag);
                });

                chip.appendChild(tagName);
                chip.appendChild(removeBtn);
                display.appendChild(chip);
            });
        }
    },

    /**
     * インラインタグ入力からタグを追加
     */
    async addTagInline(tagName) {
        if (!Editor.currentNote) {
            Dialog.alert('メモを選択してください', '通知', 'info');
            return;
        }

        // 既に同じタグがある場合はスキップ
        if (Editor.currentNote.tags && Editor.currentNote.tags.includes(tagName)) {
            Dialog.alert('既に追加されているタグです', '通知', 'info');
            return;
        }

        await this.addTagToNote(tagName);
        this.updateInlineTagsDisplay();
    },

    /**
     * タグ候補を更新して表示
     */
    async updateTagSuggestions(filterText) {
        const suggestions = document.getElementById('tag-suggestions');
        if (!suggestions) return;

        // 現在のメモがない場合は候補を表示しない
        if (!Editor.currentNote) {
            suggestions.style.display = 'none';
            return;
        }

        try {
            // 全タグを取得（使用頻度順）
            const allTags = await DB.getAllTags();

            // フィルタリング：
            // 1. 現在のメモに既に追加されているタグを除外
            // 2. 入力テキストでフィルタリング
            const currentTags = Editor.currentNote.tags || [];
            const filtered = allTags
                .filter(({ tag }) => !currentTags.includes(tag))
                .filter(({ tag }) => tag.toLowerCase().includes(filterText.toLowerCase()))
                .slice(0, 10); // 上位10件のみ

            if (filtered.length === 0) {
                suggestions.style.display = 'none';
                return;
            }

            // タグの色設定を取得
            const tagColors = await DB.getSetting('tagColors', {});

            // 候補を表示
            suggestions.innerHTML = '';
            filtered.forEach(({ tag, count }) => {
                const suggestionItem = document.createElement('div');
                suggestionItem.className = 'tag-suggestion-item';

                // タグの色を適用
                if (tagColors[tag]) {
                    suggestionItem.style.backgroundColor = tagColors[tag];
                    suggestionItem.style.color = this.getContrastColor(tagColors[tag]);
                }

                const tagNameSpan = document.createElement('span');
                tagNameSpan.textContent = tag;

                const tagCountSpan = document.createElement('span');
                tagCountSpan.className = 'tag-suggestion-count';
                tagCountSpan.textContent = `(${count})`;

                suggestionItem.appendChild(tagNameSpan);
                suggestionItem.appendChild(tagCountSpan);

                // クリックで追加
                suggestionItem.addEventListener('click', async () => {
                    await this.addTagInline(tag);
                    const tagInput = document.getElementById('tag-input');
                    if (tagInput) {
                        tagInput.value = '';
                        tagInput.focus();
                    }
                    this.updateTagSuggestions('');
                });

                suggestions.appendChild(suggestionItem);
            });

            suggestions.style.display = 'block';
        } catch (error) {
            console.error('タグ候補の取得に失敗:', error);
            suggestions.style.display = 'none';
        }
    },

    /**
     * インラインタグ表示を更新
     */
    async updateInlineTagsDisplay() {
        const display = document.getElementById('current-tags-inline');
        display.innerHTML = '';

        if (Editor.currentNote && Editor.currentNote.tags && Editor.currentNote.tags.length > 0) {
            // タグの色設定を取得
            const tagColors = await DB.getSetting('tagColors', {});

            Editor.currentNote.tags.forEach(tag => {
                const badge = document.createElement('div');
                badge.className = 'tag-badge-inline';

                // タグの色を適用
                if (tagColors[tag]) {
                    badge.style.backgroundColor = tagColors[tag];
                    badge.style.color = this.getContrastColor(tagColors[tag]);
                }

                const tagName = document.createElement('span');
                tagName.textContent = tag;

                const removeBtn = document.createElement('span');
                removeBtn.className = 'remove-tag';
                removeBtn.innerHTML = '&times;';
                removeBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    await this.removeTagFromNote(tag);
                    this.updateInlineTagsDisplay();
                });

                badge.appendChild(tagName);
                badge.appendChild(removeBtn);
                display.appendChild(badge);
            });
        }
    },

    /**
     * フォルダダイアログを開く
     */
    async openFolderDialog() {
        if (!Editor.currentNote) return;

        const dialog = document.getElementById('folder-dialog');
        dialog.classList.add('active');

        const folders = await DB.getAllFolders();
        const folderSelectList = document.getElementById('folder-select-list');
        folderSelectList.innerHTML = '';

        // フォルダなしオプション
        const uncategorizedItem = this.createFolderSelectItem({
            id: null,
            name: 'フォルダなし',
            color: '#6c757d'
        });
        folderSelectList.appendChild(uncategorizedItem);

        // フォルダオプション
        folders.forEach(folder => {
            const item = this.createFolderSelectItem(folder);
            folderSelectList.appendChild(item);
        });
    },

    /**
     * フォルダ選択アイテムを作成
     */
    createFolderSelectItem(folder) {
        const div = document.createElement('div');
        div.className = 'folder-select-item';
        if (Editor.currentNote && Editor.currentNote.folderId === folder.id) {
            div.classList.add('selected');
        }

        const colorSpan = document.createElement('span');
        colorSpan.className = 'folder-color';
        colorSpan.style.background = folder.color;

        const nameSpan = document.createElement('span');
        nameSpan.textContent = folder.name;

        div.appendChild(colorSpan);
        div.appendChild(nameSpan);

        div.addEventListener('click', async () => {
            await this.moveNoteToFolder(folder.id);
        });

        return div;
    },

    /**
     * メモをフォルダに移動
     */
    async moveNoteToFolder(folderId) {
        if (!Editor.currentNote) return;

        // FileSystemが有効な場合、古いファイルを削除してから新しい場所に保存
        if (FileSystem.isEnabled) {
            try {
                // 古いファイルのみを削除（メタデータは残す）
                await FileSystem.deleteFileOnly(Editor.currentNote);
            } catch (error) {
                console.error('旧ファイルの削除に失敗:', error);
            }
        }

        Editor.currentNote.folderId = folderId;
        await DB.saveNote(Editor.currentNote);

        // FileSystemに新しい場所で保存
        if (FileSystem.isEnabled) {
            try {
                await FileSystem.saveNoteToFile(Editor.currentNote);
            } catch (error) {
                console.error('ファイルの移動に失敗:', error);
                Dialog.alert('ファイルの移動に失敗しました', 'エラー', 'error');
                return;
            }
        }

        this.closeFolderDialog();
        await this.refreshNoteList();
        Dialog.alert('フォルダに移動しました', '完了', 'success');
    },

    /**
     * フォルダダイアログを閉じる
     */
    closeFolderDialog() {
        const dialog = document.getElementById('folder-dialog');
        dialog.classList.remove('active');
    },

    /**
     * 任意のメモをフォルダに移動するダイアログを開く
     */
    async openFolderMoveDialog(note) {
        const folders = await DB.getAllFolders();

        // カスタムダイアログを作成
        const dialogHtml = `
            <div class="custom-dialog-overlay active" id="folder-move-dialog-backdrop" style="display: flex;">
                <div class="custom-dialog" style="text-align: left;">
                    <div class="custom-dialog-title" style="text-align: center; font-size: 20px; margin-bottom: 20px;">
                        フォルダに移動
                    </div>
                    <div class="custom-dialog-message" style="text-align: left;">
                        <p style="margin-bottom: 12px;">「${note.title}」を移動するフォルダを選択してください</p>
                        <select id="folder-move-select" class="folder-move-select">
                            <option value="">フォルダなし</option>
                            ${folders.map(folder =>
                                `<option value="${folder.id}" ${note.folderId === folder.id ? 'selected' : ''}>
                                    ${folder.name}
                                </option>`
                            ).join('')}
                        </select>
                    </div>
                    <div class="custom-dialog-buttons" style="margin-top: 24px;">
                        <button class="custom-dialog-btn secondary" id="folder-move-cancel">キャンセル</button>
                        <button class="custom-dialog-btn primary" id="folder-move-ok">移動</button>
                    </div>
                </div>
            </div>
        `;

        // ダイアログをDOMに追加
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = dialogHtml;
        document.body.appendChild(tempDiv.firstElementChild);

        // イベントリスナーを設定
        const backdrop = document.getElementById('folder-move-dialog-backdrop');
        const cancelBtn = document.getElementById('folder-move-cancel');
        const okBtn = document.getElementById('folder-move-ok');
        const select = document.getElementById('folder-move-select');

        return new Promise((resolve) => {
            const closeDialog = () => {
                backdrop.remove();
                resolve();
            };

            cancelBtn.addEventListener('click', closeDialog);

            backdrop.addEventListener('click', (e) => {
                if (e.target === backdrop) {
                    closeDialog();
                }
            });

            okBtn.addEventListener('click', async () => {
                const selectedFolderId = select.value || null;

                // FileSystemが有効な場合、古いファイルを削除してから新しい場所に保存
                if (FileSystem.isEnabled) {
                    try {
                        // 古いファイルのみを削除（メタデータは残す）
                        await FileSystem.deleteFileOnly(note);
                    } catch (error) {
                        console.error('旧ファイルの削除に失敗:', error);
                    }
                }

                note.folderId = selectedFolderId;
                await DB.saveNote(note);

                // FileSystemに新しい場所で保存
                if (FileSystem.isEnabled) {
                    try {
                        await FileSystem.saveNoteToFile(note);
                    } catch (error) {
                        console.error('ファイルの移動に失敗:', error);
                        Dialog.alert('ファイルの移動に失敗しました', 'エラー', 'error');
                        closeDialog();
                        return;
                    }
                }

                await this.refreshNoteList();

                closeDialog();

                if (selectedFolderId) {
                    const selectedFolder = folders.find(f => f.id === selectedFolderId);
                    Dialog.alert(`「${selectedFolder.name}」に移動しました`, '完了', 'success');
                } else {
                    Dialog.alert('フォルダなしに移動しました', '完了', 'success');
                }
            });
        });
    },

    /**
     * 新規フォルダを作成
     */
    async createNewFolder() {
        const name = await Dialog.prompt('フォルダ名を入力してください', '新規フォルダ');
        if (name) {
            try {
                const color = '#' + Math.floor(Math.random()*16777215).toString(16);
                const folder = await DB.createFolder(name, null, color);

                // FileSystemにもディレクトリを作成
                if (FileSystem.isEnabled) {
                    try {
                        await FileSystem.createFolderDirectory(folder);
                        console.log(`フォルダディレクトリを作成: ${folder.name}`);
                    } catch (error) {
                        console.error('ディレクトリの作成に失敗:', error);
                    }
                }

                await this.refreshNoteList();
                Dialog.alert('フォルダを作成しました', '完了', 'success');
            } catch (error) {
                console.error('フォルダ作成に失敗:', error);
                Dialog.alert('フォルダの作成に失敗しました', 'エラー', 'error');
            }
        }
    },

    /**
     * フォルダ名を変更
     */
    async renameFolderDialog(folder) {
        const newName = await Dialog.prompt('新しいフォルダ名を入力してください', 'フォルダ名の変更', folder.name);
        if (newName && newName !== folder.name) {
            try {
                const oldName = folder.name;

                // FileSystemでディレクトリ名を変更
                if (FileSystem.isEnabled) {
                    try {
                        await FileSystem.renameFolderDirectory(oldName, newName);
                    } catch (error) {
                        console.error('ディレクトリ名の変更に失敗:', error);
                    }
                }

                folder.name = newName;

                // アンドゥ記録
                UndoManager.record({
                    type: 'renameFolder',
                    folderId: folder.id,
                    oldName: oldName,
                    newName: newName
                });

                // フォルダを更新
                const transaction = DB.db.transaction(['folders'], 'readwrite');
                const store = transaction.objectStore('folders');
                await new Promise((resolve, reject) => {
                    const request = store.put(folder);
                    request.onsuccess = () => resolve();
                    request.onerror = () => reject(request.error);
                });
                await this.refreshNoteList();
                Dialog.alert('フォルダ名を変更しました\n\n※Ctrl+Zで取り消せます', '完了', 'success');
            } catch (error) {
                console.error('フォルダ名の変更に失敗:', error);
                Dialog.alert('フォルダ名の変更に失敗しました', 'エラー', 'error');
            }
        }
    },

    /**
     * フォルダを削除
     */
    async deleteFolderDialog(folder) {
        // フォルダ内のメモ数を確認
        const notes = await DB.getNotesByFolder(folder.id);

        let message = `フォルダ「${folder.name}」を削除しますか？`;
        if (notes.length > 0) {
            message += `\n\nこのフォルダには${notes.length}件のメモがあります。\nメモは削除されません。`;
        }
        message += '\n\n※Ctrl+Zで取り消せます';

        const confirmed = await Dialog.confirm(message, 'フォルダの削除', 'warning');
        if (confirmed) {
            try {
                // アンドゥ記録（削除前にフォルダとノートIDを保存）
                const noteIds = notes.map(note => note.id);
                UndoManager.record({
                    type: 'deleteFolder',
                    folder: {...folder}, // ディープコピー
                    noteIds: noteIds
                });

                // フォルダ内のメモのfolder参照を削除
                for (const note of notes) {
                    note.folderId = null;
                    await DB.saveNote(note);

                    // ファイルシステムでルートに移動
                    if (FileSystem.isEnabled) {
                        try {
                            await FileSystem.saveNoteToFile(note);
                        } catch (error) {
                            console.error('ファイルの移動に失敗:', error);
                        }
                    }
                }

                // FileSystemでディレクトリを削除
                if (FileSystem.isEnabled) {
                    try {
                        await FileSystem.deleteFolderDirectory(folder.name);
                    } catch (error) {
                        console.error('ディレクトリの削除に失敗:', error);
                    }
                }

                // フォルダを削除
                await DB.deleteFolder(folder.id);
                await this.refreshNoteList();
                Dialog.alert('フォルダを削除しました\n\n※Ctrl+Zで取り消せます', '完了', 'success');
            } catch (error) {
                console.error('フォルダの削除に失敗:', error);
                Dialog.alert('フォルダの削除に失敗しました', 'エラー', 'error');
            }
        }
    },

    /**
     * 履歴ダイアログを開く
     */
    async openHistoryDialog() {
        if (!Editor.currentNote) return;

        const dialog = document.getElementById('history-dialog');
        dialog.classList.add('active');

        const histories = await DB.getNoteHistory(Editor.currentNote.id);
        const historyList = document.getElementById('history-list');
        historyList.innerHTML = '';

        if (histories.length === 0) {
            historyList.innerHTML = '<div style="padding: 40px 20px; text-align: center; color: var(--meta-color);">履歴がありません</div>';
            return;
        }

        histories.forEach(history => {
            const item = document.createElement('div');
            item.className = 'history-item';

            const time = document.createElement('div');
            time.className = 'history-item-time';
            time.textContent = Storage.formatDate(history.savedAt);

            const preview = document.createElement('div');
            preview.className = 'history-item-preview';
            preview.textContent = history.content.substring(0, 100) + '...';

            const diff = document.createElement('div');
            diff.className = 'history-item-diff';
            diff.textContent = `${history.content.length}文字`;

            item.appendChild(time);
            item.appendChild(preview);
            item.appendChild(diff);

            item.addEventListener('click', async () => {
                const confirmed = await Dialog.confirm('この履歴で復元しますか？', '履歴の復元');
                if (confirmed) {
                    Editor.currentNote.title = history.title;
                    Editor.currentNote.content = history.content;
                    Editor.loadNote(Editor.currentNote);
                    Editor.markDirty();
                    this.closeHistoryDialog();
                }
            });

            historyList.appendChild(item);
        });
    },

    /**
     * 履歴ダイアログを閉じる
     */
    closeHistoryDialog() {
        const dialog = document.getElementById('history-dialog');
        dialog.classList.remove('active');
    },

    // 以下、既存のメソッド
    toggleSidebar() {
        this.isSidebarOpen = !this.isSidebarOpen;
        const sidebar = document.getElementById('sidebar');
        sidebar.classList.toggle('closed', !this.isSidebarOpen);
    },

    closeSidebar() {
        this.isSidebarOpen = false;
        document.getElementById('sidebar').classList.add('closed');
    },

    openSidebar() {
        this.isSidebarOpen = true;
        document.getElementById('sidebar').classList.remove('closed');
    },

    checkMobileView() {
        if (window.innerWidth < 768) {
            this.closeSidebar();
        } else {
            this.openSidebar();
        }
    },

    openSettings() {
        document.getElementById('settings-modal').classList.add('active');
    },

    closeSettings() {
        document.getElementById('settings-modal').classList.remove('active');
    },

    openHelp() {
        document.getElementById('help-modal').classList.add('active');
    },

    closeHelp() {
        document.getElementById('help-modal').classList.remove('active');
    },

    /**
     * オーバーフローメニューを開く
     */
    openOverflowMenu() {
        const overflowBtn = document.getElementById('editor-overflow-btn');
        const overflowMenu = document.getElementById('editor-overflow-menu');

        if (overflowBtn && overflowMenu) {
            overflowMenu.classList.add('active');
            overflowMenu.setAttribute('aria-hidden', 'false');
            overflowBtn.setAttribute('aria-expanded', 'true');
        }
    },

    /**
     * オーバーフローメニューを閉じる
     */
    closeOverflowMenu() {
        const overflowBtn = document.getElementById('editor-overflow-btn');
        const overflowMenu = document.getElementById('editor-overflow-menu');

        if (overflowBtn && overflowMenu) {
            overflowMenu.classList.remove('active');
            overflowMenu.setAttribute('aria-hidden', 'true');
            overflowBtn.setAttribute('aria-expanded', 'false');
        }
    },

    /**
     * オーバーフローメニューのアクションを処理
     */
    handleOverflowAction(action) {
        switch (action) {
            case 'font-family':
                this.showFontFamilyDialog();
                break;
            case 'font-size':
                this.showFontSizeDialog();
                break;
            case 'regex-search':
                document.getElementById('open-regex-search')?.click();
                break;
            case 'export':
                document.getElementById('export-note')?.click();
                break;
        }
    },

    /**
     * フォントファミリー選択ダイアログ
     */
    showFontFamilyDialog() {
        const options = [
            { label: 'ゴシック', value: 'sans-serif' },
            { label: '明朝', value: 'serif' },
            { label: '等幅', value: 'monospace' }
        ];

        Dialog.select('フォントを選択', options, (value) => {
            if (value) {
                this.updateSetting('fontFamily', value);
                document.getElementById('header-font-family').value = value;
            }
        });
    },

    /**
     * フォントサイズ選択ダイアログ
     */
    showFontSizeDialog() {
        const options = [
            { label: '12px', value: '12' },
            { label: '14px', value: '14' },
            { label: '16px', value: '16' },
            { label: '18px', value: '18' },
            { label: '20px', value: '20' },
            { label: '22px', value: '22' },
            { label: '24px', value: '24' }
        ];

        Dialog.select('フォントサイズを選択', options, (value) => {
            if (value) {
                this.updateSetting('fontSize', parseInt(value));
                document.getElementById('header-font-size').value = value;
            }
        });
    },

    async changeTheme(theme) {
        const themeLink = document.getElementById('theme-stylesheet');
        themeLink.href = `css/themes/${theme}.css`;

        document.querySelectorAll('.theme-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.theme === theme);
        });

        await DB.saveSetting('theme', theme);
        Storage.saveLocalSettings({ theme });

        // サイドバー個別設定が無効な場合、サイドバーも同じテーマにする
        const separateSidebarTheme = await DB.getSetting('separateSidebarTheme', false);
        if (!separateSidebarTheme) {
            this.applySidebarTheme(theme);
        }

        // このテーマ用のカスタム設定を適用
        await this.applyCustomThemeForTheme(theme);
    },

    /**
     * 指定されたテーマのカスタム設定を適用
     */
    async applyCustomThemeForTheme(themeName) {
        const customThemes = await DB.getSetting('customThemes', {});

        // まず全てのカスタムプロパティをクリア
        const properties = [
            'editor-bg', 'text-color', 'primary-color', 'sidebar-bg',
            'border-color', 'hover-bg', 'active-bg', 'meta-color',
            'search-highlight-color', 'search-highlight-current-color', 'icon-color'
        ];
        properties.forEach(prop => {
            document.documentElement.style.removeProperty(`--${prop}`);
        });

        // このテーマのカスタム設定があれば適用
        if (customThemes[themeName]) {
            Object.entries(customThemes[themeName]).forEach(([key, value]) => {
                document.documentElement.style.setProperty(`--${key}`, value);
            });
            console.log(`${themeName}テーマのカスタム設定を適用しました`);
        }
    },

    /**
     * サイドバーテーマを変更
     */
    async changeSidebarTheme(theme) {
        document.querySelectorAll('.sidebar-theme-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.theme === theme);
        });

        await DB.saveSetting('sidebarTheme', theme);
        this.applySidebarTheme(theme);
    },

    /**
     * サイドバーにテーマを適用
     */
    applySidebarTheme(theme) {
        const sidebar = document.getElementById('sidebar');
        if (sidebar) {
            sidebar.setAttribute('data-theme', theme);
        }
    },

    async updateSetting(key, value) {
        const settings = {};
        settings[key] = value;

        Editor.applySettings(settings);
        await DB.saveSetting(key, value);
        Storage.saveLocalSettings(settings);
    },

    /**
     * メモ一覧のサイズを適用
     */
    applyNoteListSize(size) {
        const noteLists = document.querySelectorAll('.note-list, #favorites-list');
        noteLists.forEach(list => {
            list.classList.remove('compact', 'comfortable');
            list.classList.add(size);
        });
    },

    /**
     * システムのカラースキームを適用（ダークモード自動検出）
     */
    applySystemColorScheme() {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const savedTheme = localStorage.getItem('offnote_theme');

        // ユーザーがテーマを設定していない場合のみ、システムの設定を適用
        if (!savedTheme && prefersDark) {
            this.changeTheme('dark');
        }
    },

    /**
     * システムのカラースキーム変更を監視
     */
    listenToSystemColorScheme() {
        const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');

        // モダンブラウザ用
        if (darkModeQuery.addEventListener) {
            darkModeQuery.addEventListener('change', (e) => {
                // ユーザーがカスタムテーマを設定していない場合のみ変更
                const hasCustomTheme = localStorage.getItem('offnote_custom_theme');
                if (!hasCustomTheme) {
                    this.changeTheme(e.matches ? 'dark' : 'light');
                }
            });
        } else {
            // 旧ブラウザ用（Safari等）
            darkModeQuery.addListener((e) => {
                const hasCustomTheme = localStorage.getItem('offnote_custom_theme');
                if (!hasCustomTheme) {
                    this.changeTheme(e.matches ? 'dark' : 'light');
                }
            });
        }
    },

    async loadSettings() {
        try {
            const settings = await DB.getAllSettings();

            const theme = settings.theme || 'light';
            this.changeTheme(theme);

            // サイドバー個別テーマ設定を復元
            const separateSidebarTheme = settings.separateSidebarTheme || false;
            const separateThemeCheckbox = document.getElementById('separate-sidebar-theme');
            const sidebarThemeSection = document.getElementById('sidebar-theme-section');

            if (separateThemeCheckbox) {
                separateThemeCheckbox.checked = separateSidebarTheme;
                if (separateSidebarTheme) {
                    sidebarThemeSection.style.display = 'block';
                    const sidebarTheme = settings.sidebarTheme || theme;
                    this.applySidebarTheme(sidebarTheme);

                    // サイドバーテーマボタンのアクティブ状態を更新
                    document.querySelectorAll('.sidebar-theme-btn').forEach(btn => {
                        btn.classList.toggle('active', btn.dataset.theme === sidebarTheme);
                    });
                } else {
                    sidebarThemeSection.style.display = 'none';
                    this.applySidebarTheme(theme);
                }
            }

            // 旧形式のカスタムテーマを新形式に移行
            if (settings.customTheme && !settings.customThemes) {
                const customThemes = { [theme]: settings.customTheme };
                await DB.saveSetting('customThemes', customThemes);
                console.log('カスタムテーマを新形式に移行しました');
            }

            if (settings.fontFamily) {
                document.getElementById('font-family').value = settings.fontFamily;
                const headerFontFamily = document.getElementById('header-font-family');
                if (headerFontFamily) headerFontFamily.value = settings.fontFamily;
            }

            if (settings.fontSize) {
                document.getElementById('font-size').value = settings.fontSize;
                document.getElementById('font-size-value').textContent = settings.fontSize + 'px';
                const headerFontSize = document.getElementById('header-font-size');
                if (headerFontSize) headerFontSize.value = settings.fontSize;
            }

            if (settings.lineHeight) {
                document.getElementById('line-height').value = settings.lineHeight;
                document.getElementById('line-height-value').textContent = settings.lineHeight;
            }

            const noteListSize = settings.noteListSize || 'compact';
            document.getElementById('note-list-size').value = noteListSize;
            this.applyNoteListSize(noteListSize);

            Editor.applySettings(settings);
        } catch (error) {
            console.error('設定の読み込みに失敗:', error);
        }
    },

    async importFiles(files) {
        const results = await Storage.importFiles(files);

        if (results.success > 0) {
            Dialog.alert(`${results.success}件のメモをインポートしました`, 'インポート完了', 'success');
            this.refreshAllViews();

            if (results.notes.length > 0) {
                Editor.loadNote(results.notes[0]);
            }
        }

        if (results.failed > 0) {
            Dialog.alert(`${results.failed}件のインポートに失敗しました`, 'エラー', 'error');
        }
    },

    /**
     * ファイルシステムステータスを更新
     */
    updateFileSystemStatus() {
        const status = FileSystem.getStatus();
        const statusDiv = document.getElementById('filesystem-status');
        const syncToBtn = document.getElementById('sync-to-filesystem-btn');
        const syncFromBtn = document.getElementById('sync-from-filesystem-btn');
        const disableBtn = document.getElementById('disable-filesystem-btn');

        if (status.enabled && status.directory) {
            if (statusDiv) {
                statusDiv.innerHTML = `<p class="status-text">現在の保存先: <strong>ローカルフォルダ (${status.directory})</strong></p>`;
            }
            if (syncToBtn) syncToBtn.style.display = 'block';
            if (syncFromBtn) syncFromBtn.style.display = 'block';
            if (disableBtn) disableBtn.style.display = 'block';
        } else {
            if (statusDiv) {
                statusDiv.innerHTML = '<p class="status-text">現在の保存先: <strong>ブラウザ内 (IndexedDB)</strong></p>';
            }
            if (syncToBtn) syncToBtn.style.display = 'none';
            if (syncFromBtn) syncFromBtn.style.display = 'none';
            if (disableBtn) disableBtn.style.display = 'none';
        }
    },

    // ==================== ゴミ箱機能 ====================

    /**
     * ゴミ箱一覧を更新
     */
    async refreshTrashList() {
        try {
            const notes = await DB.getDeletedNotes();
            this.renderTrashList(notes);
        } catch (error) {
            console.error('ゴミ箱一覧の取得に失敗:', error);
        }
    },

    /**
     * ゴミ箱メモ一覧をレンダリング
     */
    renderTrashList(notes) {
        const trashList = document.getElementById('trash-list');
        trashList.innerHTML = '';

        if (notes.length === 0) {
            trashList.innerHTML = '<li class="note-list-empty">ゴミ箱は空です</li>';
            return;
        }

        notes.forEach(note => {
            const li = document.createElement('li');
            li.className = 'note-item trash-item';

            const title = document.createElement('div');
            title.className = 'note-item-title';
            title.textContent = note.title;

            const meta = document.createElement('div');
            meta.className = 'note-item-meta';
            meta.textContent = '削除日時: ' + Storage.formatDate(note.deletedAt);

            const preview = document.createElement('div');
            preview.className = 'note-item-preview';
            preview.textContent = note.content.substring(0, 50) + (note.content.length > 50 ? '...' : '');

            li.appendChild(title);
            li.appendChild(meta);
            li.appendChild(preview);

            // アクションボタン（復元・完全削除）
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'note-item-actions trash-actions';

            // 復元ボタン
            const restoreBtn = document.createElement('button');
            restoreBtn.className = 'note-item-action-btn restore-btn';
            restoreBtn.innerHTML = '<i class="fas fa-undo"></i>';
            restoreBtn.title = '復元';
            restoreBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await this.restoreNoteFromTrash(note);
            });

            // 完全削除ボタン
            const permanentDeleteBtn = document.createElement('button');
            permanentDeleteBtn.className = 'note-item-action-btn permanent-delete-btn';
            permanentDeleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
            permanentDeleteBtn.title = '完全に削除';
            permanentDeleteBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await this.permanentlyDeleteNote(note);
            });

            actionsDiv.appendChild(restoreBtn);
            actionsDiv.appendChild(permanentDeleteBtn);
            li.appendChild(actionsDiv);

            // クリックで内容をプレビュー（読み取り専用）
            li.addEventListener('click', () => {
                this.previewTrashNote(note);
            });

            trashList.appendChild(li);
        });
    },

    /**
     * ゴミ箱のメモをプレビュー
     */
    async previewTrashNote(note) {
        await Dialog.alert(
            `【タイトル】\n${note.title}\n\n【内容】\n${note.content.substring(0, 200)}${note.content.length > 200 ? '...' : ''}\n\n※ゴミ箱内のメモは編集できません。復元してから編集してください。`,
            'メモのプレビュー',
            'info'
        );
    },

    /**
     * メモを復元
     */
    async restoreNoteFromTrash(note) {
        const confirmed = await Dialog.confirm(
            `「${note.title}」を復元しますか？`,
            '復元の確認',
            'info'
        );

        if (!confirmed) return;

        try {
            await DB.restoreNote(note.id);
            await this.refreshTrashList();
            await this.refreshAllViews();
            Dialog.alert('メモを復元しました', '完了', 'success');
        } catch (error) {
            console.error('復元に失敗:', error);
            Dialog.alert('メモの復元に失敗しました', 'エラー', 'error');
        }
    },

    /**
     * メモを完全に削除
     */
    async permanentlyDeleteNote(note) {
        const confirmed = await Dialog.confirm(
            `「${note.title}」を完全に削除しますか？\nこの操作は取り消せません。`,
            '完全削除の確認',
            'warning'
        );

        if (!confirmed) return;

        try {
            await DB.permanentlyDeleteNote(note.id);

            // ファイルシステムからも削除
            if (FileSystem.isEnabled) {
                try {
                    await FileSystem.deleteNoteFile(note);
                } catch (error) {
                    console.error('ファイルシステムからの削除に失敗:', error);
                }
            }

            await this.refreshTrashList();
            Dialog.alert('メモを完全に削除しました', '完了', 'success');
        } catch (error) {
            console.error('完全削除に失敗:', error);
            Dialog.alert('メモの完全削除に失敗しました', 'エラー', 'error');
        }
    }
};
