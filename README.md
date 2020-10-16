# web-panel README

This is a Visual Studio Code extension that looks for a `webpanel.json` file in the
`.vscode` folder in the current workspace and (if it finds one) keeps a tab/tabs open at
all times that point to the URL(s) specified in that file.

`webpanel.json` should contain an array of URLs, e.g.: `["http://localhost:3000/"]`.
