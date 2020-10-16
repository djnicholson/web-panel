import * as vscode from "vscode";
import * as fs from "fs";

let fileSystemWatcher: vscode.FileSystemWatcher | null = null;

let panelsByUrl: { [url: string]: vscode.WebviewPanel } = {};

let active = false;

function loader(url: string) {
  return `
<!DOCTYPE html>
<html lang="en">
<html style="height: 100%;>
  <head>
    <script>
      function onError() {
        setTimeout(() => document.querySelector("#iframe").src = "${url}", 1000);
      }
    </script>
  </head>
  <body style="width: 100%; height: 100%; margin: 0; padding: 0;">
    <iframe id="iframe" style="width: 100%; height: 100%; margin: 0; border: 0" src="${url}" onError="onError()" />
  </body>
</html>
`;
}

function ensurePanel(url: string) {
  if (!panelsByUrl[url] || !panelsByUrl[url].visible) {
    const newPanel = vscode.window.createWebviewPanel(
      `web-panel-${url}`,
      url,
      vscode.ViewColumn.Beside,
      { enableScripts: true }
    );
    newPanel.webview.html = loader(url);
    panelsByUrl[url] = newPanel;
  }
}

function refresh(file: vscode.Uri) {
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

export async function activate() {
  fileSystemWatcher?.dispose();
  fileSystemWatcher = vscode.workspace.createFileSystemWatcher(
    "**/.vscode/webpanel.json"
  );
  fileSystemWatcher.onDidChange(refresh);
  fileSystemWatcher.onDidCreate(refresh);
  active = true;
  const runNow = await vscode.workspace.findFiles("**/.vscode/webpanel.json");
  for (const file of runNow) {
    refresh(file);
  }
}

export function deactivate() {
  active = false;
  fileSystemWatcher?.dispose();
  fileSystemWatcher = null;
  for (const url of Object.getOwnPropertyNames(panelsByUrl)) {
    panelsByUrl[url].dispose();
  }
}
