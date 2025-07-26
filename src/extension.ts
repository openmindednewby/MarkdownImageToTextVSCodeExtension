import * as vscode from 'vscode';
import * as path from 'path';
import { promises as fs } from 'fs';
import { createWorker } from 'tesseract.js';

export function activate(context: vscode.ExtensionContext) {
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
                    const commandUri = vscode.Uri.parse(
                        `command:markdown-image-to-text.getTextFromImage?${encodeURIComponent(JSON.stringify({
                            imagePath: m[1],
                            docUri: doc.uri.toString(),
                            line: pos.line
                        }))}`
                    );
                    const markdown = new vscode.MarkdownString(`[Extract text from image](${commandUri})`);
                    markdown.isTrusted = true;
                    return new vscode.Hover(markdown, imgRange);
                }
            }
            return null;
        }
    });
    context.subscriptions.push(hoverProvider);

    const disposable = vscode.commands.registerCommand('markdown-image-to-text.getTextFromImage',
        async (args: { imagePath: string; docUri: string; line: number }) => {
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
                vscode.window.showErrorMessage(`Reading image file: ${fullPath}`);
                const data = await fs.readFile(fullPath);
                vscode.window.showErrorMessage(`Reading image data: ${data}`);
                const worker = await (createWorker)();
                await worker.load();
                await worker.loadLanguage('eng');
                await worker.initialize('eng');
                const { data: { text } } = await worker.recognize(data);
                vscode.window.showErrorMessage(`Reading image text: ${text}`);
                await worker.terminate();

                const edit = new vscode.WorkspaceEdit();
                const insertPosition = new vscode.Position(args.line + 1, 0);
                edit.insert(doc.uri, insertPosition, `\n\n> OCR result:\n\`\`\`\n${text.trim()}\n\`\`\`\n`);
                await vscode.workspace.applyEdit(edit);
            } catch (err) {
                vscode.window.showErrorMessage(`Error reading image or OCR: ${err}`);
            }
        });
    context.subscriptions.push(disposable);
}

export function deactivate() {}
