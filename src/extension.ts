import * as vscode from 'vscode';
import * as path from 'path';
import { promises as fs } from 'fs';
import { createWorker } from 'tesseract.js';
import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';

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
            try {
                const doc = await vscode.workspace.openTextDocument(vscode.Uri.parse(args.docUri));

                const imageData: Buffer = await getImageData(args, doc);
                const formattedText = await getFormattedText(imageData);

                const edit = new vscode.WorkspaceEdit();
                const insertPosition = new vscode.Position(args.line + 1, 0);
				edit.insert(doc.uri, insertPosition, `\n\n${formattedText}\n`);                await vscode.workspace.applyEdit(edit);
            } catch (err) {
                vscode.window.showErrorMessage(`OCR failed: ${err instanceof Error ? err.message : err}`);
            }
        });

    context.subscriptions.push(disposable);
}

export function deactivate() {}

async function getFormattedText(imageData: Buffer<ArrayBufferLike>) {
    const worker = await createWorker();
    await worker.load();
    const { data: { text } } = await worker.recognize(imageData);
    const formattedText = text.trim().replace(/\r?\n/g, '  \n'); // Adds markdown line breaks
    await worker.terminate();
    return formattedText;
}

async function getImageData(args: { imagePath: string; docUri: string; line: number; }, doc: vscode.TextDocument) {
	let imageData: Buffer;

	if (args.imagePath.startsWith('http')) {
		imageData = await fetchImageBuffer(args.imagePath);
	} else {
		const workspaceRoot = vscode.workspace.getWorkspaceFolder(doc.uri)?.uri.fsPath;
		const fullPath = workspaceRoot
			? path.join(workspaceRoot, args.imagePath)
			: path.resolve(path.dirname(doc.uri.fsPath), args.imagePath);

		imageData = await fs.readFile(fullPath);
	}
	return imageData;
}

function fetchImageBuffer(urlStr: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(urlStr);
        const client = urlObj.protocol === 'https:' ? https : http;

        client.get(urlStr, (res) => {
            const data: Uint8Array[] = [];
            res.on('data', chunk => data.push(chunk));
            res.on('end', () => resolve(Buffer.concat(data)));
        }).on('error', reject);
    });
}
