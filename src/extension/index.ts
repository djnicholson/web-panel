import * as fs from "fs";
import * as nodeFetch from "node-fetch";
import * as path from "path";
import * as vscode from "vscode";

const PATTERN = "**/.vscode/webpanel.json";

const FLAG_ACCEPTING_MESSAGES = "accepting-messages";
const FLAG_PANEL_UP = "panel-up";

let fileSystemWatcher: vscode.FileSystemWatcher | null = null;

let panelsByUrl: { [url: string]: vscode.WebviewPanel } = {};

let context: vscode.ExtensionContext | null = null;

let urls: {
  [url: string]: boolean;
} = {};

function ensurePanel(url: string) {
  if (!context) {
    return;
  }
  const existingPanel = panelsByUrl[url];
  if (existingPanel) {
    return;
  }
  const newPanel = vscode.window.createWebviewPanel(
    `web-panel-${url}`,
    url,
    vscode.ViewColumn.Two,
    { enableScripts: true, retainContextWhenHidden: true }
  );
  newPanel.webview.html = fs
    .readFileSync(
      path.join(context.extensionPath, "dist", "panel", "index.html")
    )
    .toString()
    .replace(
      "[BASE_HREF]",
      newPanel.webview
        .asWebviewUri(
          vscode.Uri.file(path.join(context.extensionPath, "dist", "panel"))
        )
        .toString() + "/"
    );
  newPanel.webview.onDidReceiveMessage(
    () => ((newPanel as any)[FLAG_ACCEPTING_MESSAGES] = true)
  );
  newPanel.onDidDispose(() => delete panelsByUrl[url]);
  panelsByUrl[url] = newPanel;
}

function extractUrls(webPanelJsonFile: vscode.Uri): string[] {
  const result: string[] = [];
  try {
    const fileContents = fs.readFileSync(webPanelJsonFile.fsPath);
    const urlList = JSON.parse(fileContents.toString());
    if (!Array.isArray(urlList)) {
      vscode.window.showErrorMessage(
        "Your webpanel.json file should contain a single array of URLs."
      );
    } else {
      result.push(...urlList);
    }
  } catch (e) {
    vscode.window.showErrorMessage(
      `Error processing webpanel.json file: ${e.message}`
    );
  }
  return result;
}

async function monitorPanels() {
  if (!context) {
    return;
  }
  try {
    for (const url of Object.getOwnPropertyNames(urls)) {
      ensurePanel(url);
      const panel = panelsByUrl[url];
      if (panel) {
        const acceptingMessages = (panel as any)[FLAG_ACCEPTING_MESSAGES];
        const panelUp = (panel as any)[FLAG_PANEL_UP];
        if (!panelUp) {
          if (acceptingMessages) {
            try {
              await nodeFetch.default(url);
              try {
                panel.webview.postMessage({ url });
                console.log("web-panel", url, "URL up");
                (panel as any)[FLAG_PANEL_UP] = true;
              } catch (e) {
                console.log("web-panel", url, "Panel error", e.message);
              }
            } catch (e) {
              console.log("web-panel", url, "Waiting for URL");
            }
          } else {
            console.log("web-panel", url, "Waiting for panel to initialize");
          }
        }
      } else {
        console.log("web-panel", url, "Waiting for panel to open");
      }
    }
  } finally {
    setTimeout(monitorPanels, 1000);
  }
}

async function parseAllUrls() {
  const urlsToRemove = { ...urls };
  const webPanelJsonFiles = await vscode.workspace.findFiles(PATTERN);
  for (const webPanelJsonFile of webPanelJsonFiles) {
    const urlsThisFile = extractUrls(webPanelJsonFile);
    for (const url of urlsThisFile) {
      urls[url] = true;
      if (!!urlsToRemove[url]) {
        delete urlsToRemove[url];
      }
    }
  }
  for (const urlToRemove of Object.getOwnPropertyNames(urlsToRemove)) {
    delete urls[urlToRemove];
  }
}

export async function activate(extensionContext: vscode.ExtensionContext) {
  context = extensionContext;
  fileSystemWatcher?.dispose();
  fileSystemWatcher = vscode.workspace.createFileSystemWatcher(PATTERN);
  fileSystemWatcher.onDidChange(parseAllUrls);
  fileSystemWatcher.onDidCreate(parseAllUrls);
  await parseAllUrls();
  await monitorPanels();
}

export function deactivate() {
  context = null;
  fileSystemWatcher?.dispose();
  fileSystemWatcher = null;
  for (const url of Object.getOwnPropertyNames(panelsByUrl)) {
    panelsByUrl[url].dispose();
  }
}
