import * as fs from "fs";
import * as nodeFetch from "node-fetch";
import * as path from "path";
import * as vscode from "vscode";

let fileSystemWatcher: vscode.FileSystemWatcher | null = null;

let panelsByUrl: { [url: string]: vscode.WebviewPanel } = {};

let active = false;

let context: vscode.ExtensionContext | null = null;

let loading: { url: string; panel: vscode.WebviewPanel }[] = [];

function ensurePanel(url: string) {
  if (!active || !context) {
    return;
  }
  const existingPanel = panelsByUrl[url];
  if (!existingPanel || !existingPanel.visible) {
    const newPanel = vscode.window.createWebviewPanel(
      `web-panel-${url}`,
      url,
      vscode.ViewColumn.Beside,
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
      () => ((newPanel as any)["accepting-messages"] = true)
    );
    newPanel.onDidDispose(() => delete panelsByUrl[url]);
    panelsByUrl[url] = newPanel;
    loading.push({ url, panel: newPanel });
  }
}

async function loadUrls() {
  if (!active) {
    return;
  }
  try {
    const toProcess = loading;
    loading = [];
    for (const _ of toProcess) {
      const url = _.url;
      const panel = _.panel;
      const acceptingMessages = (panel as any)["accepting-messages"];
      if (!acceptingMessages) {
        console.log("web-panel", url, "Waiting for panel");
        loading.push(_);
      } else {
        try {
          await nodeFetch.default(url);
          try {
            panel.webview.postMessage({ url });
            console.log("web-panel", url, "URL up");
          } catch (e) {
            console.log("web-panel", url, "Panel error", e.message);
          }
        } catch (e) {
          console.log("web-panel", url, "Waiting for URL");
          loading.push(_);
        }
      }
    }
  } finally {
    setTimeout(loadUrls, 1000);
  }
}

function refreshWebPanelJson(file: vscode.Uri) {
  if (!active || !context) {
    return;
  }
  try {
    const fileContents = fs.readFileSync(file.fsPath);
    const urlList = JSON.parse(fileContents.toString());
    if (!Array.isArray(urlList)) {
      vscode.window.showErrorMessage(
        "Your webpanel.json file should contain a single array of URLs."
      );
    } else {
      for (const url of urlList) {
        ensurePanel(url);
      }
    }
  } catch (e) {
    vscode.window.showErrorMessage(
      `Error processing webpanel.json file: ${e.message}`
    );
  }
}

export async function activate(extensionContext: vscode.ExtensionContext) {
  context = extensionContext;
  fileSystemWatcher?.dispose();
  fileSystemWatcher = vscode.workspace.createFileSystemWatcher(
    "**/.vscode/webpanel.json"
  );
  fileSystemWatcher.onDidChange(refreshWebPanelJson);
  fileSystemWatcher.onDidCreate(refreshWebPanelJson);
  active = true;
  const runNow = await vscode.workspace.findFiles("**/.vscode/webpanel.json");
  for (const file of runNow) {
    refreshWebPanelJson(file);
  }
  loadUrls();
}

export function deactivate() {
  active = false;
  fileSystemWatcher?.dispose();
  fileSystemWatcher = null;
  for (const url of Object.getOwnPropertyNames(panelsByUrl)) {
    panelsByUrl[url].dispose();
  }
}
