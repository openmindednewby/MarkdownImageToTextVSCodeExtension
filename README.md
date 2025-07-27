# 🖼️ Markdown Image to Text (OCR)

A Visual Studio Code extension that extracts text from images in Markdown files using [Tesseract.js](https://github.com/naptha/tesseract.js).  
Simply hover over an image in a Markdown file and click **Extract text** — or run OCR across the entire document in one go!

---

## 🚀 Features

- 🔍 **Hover over an image** to extract its text
- 📑 **Batch scan** all images in a document and paste extracted text below each one
- ⏱️ **Progress indicator** with ETA and image count
- ⚙️ **Configurable concurrency and throttling**
- 🧠 Uses Tesseract.js under the hood for client-side OCR

---

## ✨ Demo

**Extract Simple Image On Hover**
![Extract Simple Image On Hover](https://github.com/openmindednewby/MarkdownImageToTextVSCodeExtension/extractTextFromSingleImage.gif)

**Extract For the Whole File**
![Extract For the Whole File](https://github.com/openmindednewby/MarkdownImageToTextVSCodeExtension/extractTextFromTheWholeFile.gif)

---

## 📥 Installation

Install via the **Extensions** panel in VS Code:

1. Open the Extensions view: `Ctrl+Shift+X` (or `Cmd+Shift+X` on macOS)
2. Search for `Markdown Image to Text`
3. Click **Install**

Or install from the [VS Code Marketplace](https://marketplace.visualstudio.com/VSCode).

---

## 🧑‍🏫 How to Use

### ▶️ 1. Hover to Extract

- In a Markdown file, hover over an image link:
  ```markdown
  ![example](./example.png)
