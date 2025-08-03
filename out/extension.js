"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs_1 = require("fs");
const tesseract_js_1 = require("tesseract.js");
const https = __importStar(require("https"));
const http = __importStar(require("http"));
const url_1 = require("url");
function activate(context) {
    const hoverProvider = vscode.languages.registerHoverProvider('markdown', {
        provideHover: async (doc, pos) => {
            const line = doc.lineAt(pos.line);
            const regex = /!\[.*?\]\((.+?)\)/g;
            let m;
            while ((m = regex.exec(line.text))) {
                const start = m.index;
                const end = regex.lastIndex;
                const imgRange = new vscode.Range(pos.line, start, pos.line, end);
                if (imgRange.contains(pos)) {
                    const commandUri = vscode.Uri.parse(`command:markdown-image-to-text.getTextFromImage?${encodeURIComponent(JSON.stringify({
                        imagePath: m[1],
                        docUri: doc.uri.toString(),
                        line: pos.line
                    }))}`);
                    const markdown = new vscode.MarkdownString(`[Extract text from image](${commandUri})`);
                    markdown.isTrusted = true;
                    return new vscode.Hover(markdown, imgRange);
                }
            }
            return null;
        }
    });
    context.subscriptions.push(hoverProvider);
    const disposable = vscode.commands.registerCommand('markdown-image-to-text.getTextFromImage', async (args) => {
        try {
            const doc = await vscode.workspace.openTextDocument(vscode.Uri.parse(args.docUri));
            const imageData = await getImageData(args, doc);
            const formattedText = await getFormattedText(imageData);
            const edit = new vscode.WorkspaceEdit();
            const insertPosition = new vscode.Position(args.line + 1, 0);
            insertFormattedText(edit, doc, insertPosition, formattedText);
            await vscode.workspace.applyEdit(edit);
        }
        catch (err) {
            vscode.window.showErrorMessage(`OCR failed: ${err instanceof Error ? err.message : err}`);
        }
    });
    context.subscriptions.push(disposable);
    const scanAllImagesCommand = vscode.commands.registerCommand('markdown-image-to-text.getTextFromAllImages', async () => {
        const config = vscode.workspace.getConfiguration("markdownImageToText");
        const MAX_CONCURRENT_WORKERS = config.get("maxConcurrentWorkers", 4);
        const THROTTLE_DELAY_MS = config.get("throttleDelayMs", 5);
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage("No active editor found.");
            return;
        }
        const doc = editor.document;
        const imageTasks = collectImageLinks(doc);
        const total = imageTasks.length;
        if (total === 0) {
            vscode.window.showInformationMessage("No images found in document.");
            return;
        }
        const edit = new vscode.WorkspaceEdit();
        const startTime = Date.now();
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Running OCR on all images...",
            cancellable: false
        }, async (progress) => {
            let completed = 0;
            const queue = [...imageTasks];
            const runningWorkers = [];
            const runWorker = async (task) => {
                const { line, path } = task;
                try {
                    const imageData = await getImageData({ imagePath: path, docUri: doc.uri.toString(), line }, doc);
                    const formattedText = await getFormattedText(imageData);
                    const insertPos = new vscode.Position(line + 1, 0);
                    insertFormattedText(edit, doc, insertPos, formattedText);
                }
                catch (err) {
                    vscode.window.showErrorMessage(`OCR failed at line ${line + 1}: ${err instanceof Error ? err.message : err}`);
                }
                finally {
                    completed++;
                    printReport(startTime, completed, total, progress, task);
                    if (THROTTLE_DELAY_MS > 0)
                        await delay(THROTTLE_DELAY_MS);
                }
            };
            const spawnWorkers = async () => {
                while (queue.length > 0) {
                    while (runningWorkers.length < MAX_CONCURRENT_WORKERS && queue.length > 0) {
                        const task = queue.shift();
                        const worker = runWorker(task).finally(() => {
                            const index = runningWorkers.indexOf(worker);
                            if (index !== -1)
                                runningWorkers.splice(index, 1);
                        });
                        runningWorkers.push(worker);
                    }
                    await Promise.race(runningWorkers);
                }
                await Promise.all(runningWorkers);
            };
            await spawnWorkers();
        });
        await vscode.workspace.applyEdit(edit);
        vscode.window.showInformationMessage(`OCR complete for ${imageTasks.length} image(s).`);
    });
    context.subscriptions.push(scanAllImagesCommand);
    const scanAllImagesLargeFileCommand = vscode.commands.registerCommand('markdown-image-to-text.getTextFromAllImagesLargeFile', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage("No active editor found.");
            return;
        }
        const doc = editor.document;
        const imageTasks = collectImageLinks(doc);
        const total = imageTasks.length;
        if (total === 0) {
            vscode.window.showInformationMessage("No images found in document.");
            return;
        }
        const edit = new vscode.WorkspaceEdit();
        const startTime = Date.now();
        const BATCH_SIZE = 10;
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Running OCR on all images...",
            cancellable: false
        }, async (progress) => {
            let completed = 0;
            for (let i = 0; i < total; i += BATCH_SIZE) {
                const batch = imageTasks.slice(i, i + BATCH_SIZE);
                const worker = await (0, tesseract_js_1.createWorker)();
                await worker.load();
                for (const task of batch) {
                    try {
                        const imageData = await getImageData({ imagePath: task.path, docUri: doc.uri.toString(), line: task.line }, doc);
                        const { data: { text } } = await worker.recognize(imageData);
                        const formattedText = text.trim().replace(/\r?\n/g, '  \n');
                        const insertPos = new vscode.Position(task.line + 1, 0);
                        insertFormattedText(edit, doc, insertPos, formattedText);
                    }
                    catch (err) {
                        vscode.window.showErrorMessage(`OCR failed at line ${task.line + 1}: ${err instanceof Error ? err.message : err}`);
                    }
                    finally {
                        completed++;
                        printReport(startTime, completed, total, progress, task);
                    }
                }
                await worker.terminate();
                global.gc?.();
            }
        });
        await vscode.workspace.applyEdit(edit);
        vscode.window.showInformationMessage(`OCR complete for ${imageTasks.length} image(s).`);
    });
    context.subscriptions.push(scanAllImagesLargeFileCommand);
}
function deactivate() { }
function printReport(startTime, completed, total, progress, task) {
    const elapsed = (Date.now() - startTime) / 1000;
    const rate = completed / elapsed;
    const eta = rate > 0 ? ((total - completed) / rate) : 0;
    progress.report({
        message: `Processed ${completed}/${total} | Line ${task.line + 1} | ETA: ${eta.toFixed(1)}s`,
        increment: (100 / total)
    });
}
function insertFormattedText(edit, doc, insertPosition, formattedText) {
    edit.insert(doc.uri, insertPosition, `\n\n${formattedText}\n`);
}
async function getFormattedText(imageData) {
    const worker = await (0, tesseract_js_1.createWorker)();
    await worker.load();
    const { data: { text } } = await worker.recognize(imageData);
    const formattedText = text.trim().replace(/\r?\n/g, '  \n'); // Adds markdown line breaks
    await worker.terminate();
    return formattedText;
}
async function getImageData(args, doc) {
    let imageData;
    if (args.imagePath.startsWith('http')) {
        imageData = await fetchImageBuffer(args.imagePath);
    }
    else {
        const workspaceRoot = vscode.workspace.getWorkspaceFolder(doc.uri)?.uri.fsPath;
        const fullPath = workspaceRoot
            ? path.join(workspaceRoot, args.imagePath)
            : path.resolve(path.dirname(doc.uri.fsPath), args.imagePath);
        imageData = await fs_1.promises.readFile(fullPath);
    }
    return imageData;
}
function fetchImageBuffer(urlStr) {
    return new Promise((resolve, reject) => {
        const urlObj = new url_1.URL(urlStr);
        const client = urlObj.protocol === 'https:' ? https : http;
        client.get(urlStr, (res) => {
            const data = [];
            res.on('data', chunk => data.push(chunk));
            res.on('end', () => resolve(Buffer.concat(data)));
        }).on('error', reject);
    });
}
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
function collectImageLinks(doc) {
    const regex = /!\[.*?\]\((.+?)\)/g;
    const results = [];
    for (let line = 0; line < doc.lineCount; line++) {
        const text = doc.lineAt(line).text;
        regex.lastIndex = 0;
        let match;
        while ((match = regex.exec(text))) {
            results.push({ line, path: match[1] });
        }
    }
    return results;
}
//# sourceMappingURL=extension.js.map