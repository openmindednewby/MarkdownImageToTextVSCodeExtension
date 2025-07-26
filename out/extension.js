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
            edit.insert(doc.uri, insertPosition, `\n\n${formattedText}\n`);
            await vscode.workspace.applyEdit(edit);
        }
        catch (err) {
            vscode.window.showErrorMessage(`OCR failed: ${err instanceof Error ? err.message : err}`);
        }
    });
    context.subscriptions.push(disposable);
    const scanAllImagesCommand = vscode.commands.registerCommand('markdown-image-to-text.getTextFromAllImages', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage("No active editor found.");
            return;
        }
        const doc = editor.document;
        const regex = /!\[.*?\]\((.+?)\)/g;
        const edit = new vscode.WorkspaceEdit();
        for (let lineNum = 0; lineNum < doc.lineCount; lineNum++) {
            const line = doc.lineAt(lineNum);
            let match;
            regex.lastIndex = 0; // Reset regex for each line
            while ((match = regex.exec(line.text))) {
                const imagePath = match[1];
                try {
                    const imageData = await getImageData({ imagePath, docUri: doc.uri.toString(), line: lineNum }, doc);
                    const formattedText = await getFormattedText(imageData);
                    const insertPosition = new vscode.Position(lineNum + 1, 0);
                    edit.insert(doc.uri, insertPosition, `\n\n**OCR result:**\n\n${formattedText}\n`);
                }
                catch (err) {
                    vscode.window.showErrorMessage(`Failed to OCR image on line ${lineNum + 1}: ${err instanceof Error ? err.message : err}`);
                }
            }
        }
        await vscode.workspace.applyEdit(edit);
    });
    context.subscriptions.push(scanAllImagesCommand);
}
function deactivate() { }
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
//# sourceMappingURL=extension.js.map