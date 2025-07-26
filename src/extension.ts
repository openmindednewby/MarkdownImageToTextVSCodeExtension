import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
		console.log('Congratulations, your extension "markdown-image-to-text" is now active!'); 

	const disposable = vscode.commands.registerCommand('markdown-image-to-text.getTextFromImage', () => {
		vscode.window.showInformationMessage('Hello World from MarkdownImageToText!');
	});

	context.subscriptions.push(disposable);
}

export function deactivate() {}
