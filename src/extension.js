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
        const doc = await vscode.workspace.openTextDocument(vscode.Uri.parse(args.docUri));
        const workspaceRoot = vscode.workspace.getWorkspaceFolder(doc.uri)?.uri.fsPath;
        const fullPath = args.imagePath.startsWith('http')
            ? undefined
            : workspaceRoot
                ? path.join(workspaceRoot, args.imagePath)
                : path.resolve(path.dirname(doc.uri.fsPath), args.imagePath);
        if (!fullPath) {
            vscode.window.showErrorMessage('Only local image files supported.');
            return;
        }
        try {
            const data = await fs_1.promises.readFile(fullPath);
            const worker = await tesseract_js_1.createWorker({
                logger: (m) => console.log(m),
            });
            await worker.load();
            await worker.loadLanguage('eng');
            await worker.initialize('eng');
            const { data: { text } } = await worker.recognize(data);
            await worker.terminate();
            const edit = new vscode.WorkspaceEdit();
            const insertPosition = new vscode.Position(args.line + 1, 0);
            edit.insert(doc.uri, insertPosition, `\n\n> OCR result:\n\`\`\`\n${text.trim()}\n\`\`\`\n`);
            await vscode.workspace.applyEdit(edit);
        }
        catch (err) {
            vscode.window.showErrorMessage(`Error reading image or OCR: ${err}`);
        }
    });
    context.subscriptions.push(disposable);
}
function deactivate() { }
//# sourceMappingURL=extension.js.map