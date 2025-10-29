/**
 * ストレージ管理モジュール（エクスポート/インポート）
 */

const Storage = {
    /**
     * 単一メモをテキストファイルとしてエクスポート
     */
    exportNote(note) {
        const content = note.content;
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const filename = this.sanitizeFilename(note.title) + '.txt';
        this.downloadBlob(blob, filename);
    },

    /**
     * 全メモをZIPでエクスポート（簡易版：個別にダウンロード）
     */
    async exportAllNotes() {
        const notes = await DB.getAllNotes();

        if (notes.length === 0) {
            alert('エクスポートするメモがありません');
            return;
        }

        // 簡易実装: 各メモを個別にダウンロード
        // 本格実装にはJSZipライブラリを使用
        const confirmation = confirm(`${notes.length}件のメモを個別にダウンロードします。よろしいですか？`);

        if (confirmation) {
            notes.forEach((note, index) => {
                setTimeout(() => {
                    this.exportNote(note);
                }, index * 200); // ダウンロード間隔を200msに設定
            });
        }
    },

    /**
     * テキストファイルをインポート
     */
    async importTextFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = async (e) => {
                const content = e.target.result;
                const title = file.name.replace(/\.txt$/, '');

                try {
                    const note = await DB.createNote(title, content);
                    resolve(note);
                } catch (error) {
                    reject(error);
                }
            };

            reader.onerror = () => {
                reject(new Error('ファイルの読み込みに失敗しました'));
            };

            reader.readAsText(file, 'UTF-8');
        });
    },

    /**
     * 複数ファイルをインポート
     */
    async importFiles(files) {
        const results = {
            success: 0,
            failed: 0,
            notes: []
        };

        for (const file of files) {
            try {
                const note = await this.importTextFile(file);
                results.success++;
                results.notes.push(note);
            } catch (error) {
                console.error(`ファイル ${file.name} のインポートに失敗:`, error);
                results.failed++;
            }
        }

        return results;
    },

    /**
     * 日付をフォーマット
     */
    formatDate(date) {
        if (typeof date === 'string') {
            date = new Date(date);
        }

        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');

        return `${year}/${month}/${day} ${hours}:${minutes}`;
    },

    /**
     * 相対時間を取得
     */
    getRelativeTime(date) {
        if (typeof date === 'string') {
            date = new Date(date);
        }

        const now = new Date();
        const diff = now - date;
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (seconds < 60) {
            return 'たった今';
        } else if (minutes < 60) {
            return `${minutes}分前`;
        } else if (hours < 24) {
            return `${hours}時間前`;
        } else if (days < 7) {
            return `${days}日前`;
        } else {
            return this.formatDate(date);
        }
    },

    /**
     * ファイル名をサニタイズ
     */
    sanitizeFilename(filename) {
        return filename
            .replace(/[<>:"\/\\|?*\x00-\x1F]/g, '') // 無効な文字を削除
            .replace(/\s+/g, '_') // スペースをアンダースコアに
            .substring(0, 200); // 長さを制限
    },

    /**
     * Blobをダウンロード
     */
    downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    /**
     * ローカルストレージに設定を保存
     */
    saveLocalSettings(settings) {
        Object.entries(settings).forEach(([key, value]) => {
            localStorage.setItem(`offnote_${key}`, JSON.stringify(value));
        });
    },

    /**
     * ローカルストレージから設定を取得
     */
    getLocalSetting(key, defaultValue = null) {
        const value = localStorage.getItem(`offnote_${key}`);
        return value ? JSON.parse(value) : defaultValue;
    }
};
