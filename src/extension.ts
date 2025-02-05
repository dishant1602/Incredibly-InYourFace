// A lot of the code used to make this extension is from the following repos:
// https://github.com/phindle/error-lens/blob/master/src/extension.ts
// https://github.com/microsoft/vscode-extension-samples/tree/main/webview-sample
// https://github.com/microsoft/vscode-extension-samples/tree/main/webview-view-sample
// https://code.visualstudio.com/api/extension-guides/webview
// and more that I can't find anymore

"use strict";
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  console.log("Extension activated");

  const provider = new CustomSidebarViewProvider(context.extensionUri);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      CustomSidebarViewProvider.viewType,
      provider
    )
  );

  let _statusBarItem: vscode.StatusBarItem;
  let errorLensEnabled: boolean = true;

  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // console.log('Visual Studio Code Extension "errorlens" is now active');

  // Commands are defined in the package.json file
  let disposableEnableErrorLens = vscode.commands.registerCommand(
    "ErrorLens.enable",
    () => {
      errorLensEnabled = true;

      const activeTextEditor: vscode.TextEditor | undefined =
        vscode.window.activeTextEditor;
      if (activeTextEditor) {
        updateDecorationsForUri(activeTextEditor.document.uri);
      }
    }
  );

  context.subscriptions.push(disposableEnableErrorLens);

  let disposableDisableErrorLens = vscode.commands.registerCommand(
    "ErrorLens.disable",
    () => {
      errorLensEnabled = false;

      const activeTextEditor: vscode.TextEditor | undefined =
        vscode.window.activeTextEditor;
      if (activeTextEditor) {
        updateDecorationsForUri(activeTextEditor.document.uri);
      }
    }
  );

  context.subscriptions.push(disposableDisableErrorLens);

  vscode.languages.onDidChangeDiagnostics(
    (diagnosticChangeEvent) => {
      onChangedDiagnostics(diagnosticChangeEvent);
    },
    null,
    context.subscriptions
  );

  // Note: URIs for onDidOpenTextDocument() can contain schemes other than file:// (such as git://)
  vscode.workspace.onDidOpenTextDocument(
    (textDocument) => {
      updateDecorationsForUri(textDocument.uri);
    },
    null,
    context.subscriptions
  );

  // Update on editor switch.
  vscode.window.onDidChangeActiveTextEditor(
    (textEditor) => {
      if (textEditor === undefined) {
        return;
      }
      updateDecorationsForUri(textEditor.document.uri);
    },
    null,
    context.subscriptions
  );

  function onChangedDiagnostics(
    diagnosticChangeEvent: vscode.DiagnosticChangeEvent
  ) {
    if (!vscode.window) {
      return;
    }

    const activeTextEditor: vscode.TextEditor | undefined =
      vscode.window.activeTextEditor;
    if (!activeTextEditor) {
      return;
    }

    // Many URIs can change - we only need to decorate the active text editor
    for (const uri of diagnosticChangeEvent.uris) {
      // Only update decorations for the active text editor.
      if (uri.fsPath === activeTextEditor.document.uri.fsPath) {
        updateDecorationsForUri(uri);
        break;
      }
    }
  }

  function updateDecorationsForUri(uriToDecorate: vscode.Uri) {
    if (!uriToDecorate) {
      return;
    }

    // Only process "file://" URIs.
    if (uriToDecorate.scheme !== "file") {
      return;
    }

    if (!vscode.window) {
      return;
    }

    const activeTextEditor: vscode.TextEditor | undefined =
      vscode.window.activeTextEditor;
    if (!activeTextEditor) {
      return;
    }

    if (!activeTextEditor.document.uri.fsPath) {
      return;
    }

    let numErrors = 0;
    let numWarnings = 0;

    if (errorLensEnabled) {
      let aggregatedDiagnostics: any = {};
      let diagnostic: vscode.Diagnostic;

      // Iterate over each diagnostic that VS Code has reported for this file. For each one, add to
      // a list of objects, grouping together diagnostics which occur on a single line.
      for (diagnostic of vscode.languages.getDiagnostics(uriToDecorate)) {
        let key = "line" + diagnostic.range.start.line;

        if (aggregatedDiagnostics[key]) {
          // Already added an object for this key, so augment the arrayDiagnostics[] array.
          aggregatedDiagnostics[key].arrayDiagnostics.push(diagnostic);
        } else {
          // Create a new object for this key, specifying the line: and a arrayDiagnostics[] array
          aggregatedDiagnostics[key] = {
            line: diagnostic.range.start.line,
            arrayDiagnostics: [diagnostic],
          };
        }

        switch (diagnostic.severity) {
          case 0:
            numErrors += 1;
            break;

          case 1:
            numWarnings += 1;
            break;

          // Ignore other severities.
        }
      }
    }
  }
}

class CustomSidebarViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "in-your-face.openview";

  private _view?: vscode.WebviewView;

  constructor(private readonly _extensionUri: vscode.Uri) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext<unknown>,
    token: vscode.CancellationToken
  ): void | Thenable<void> {
    this._view = webviewView;

    webviewView.webview.options = {
      // Allow scripts in the webview
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    // default webview will show doom face 0
    webviewView.webview.html = this.getHtmlContent(webviewView.webview, false);

    // This is called every second is decides which doom face to show in the webview
    setInterval(() => {
      webviewView.webview.html = this.getHtmlContent(webviewView.webview, true);
      
    }, 1000);
  }

  private getHtmlContent(webview: vscode.Webview, flag:boolean): string {

    let errorFace:any;
    let warningFace:any;

    let errors = getNumErrAndWarn()[0];
    let warnings = getNumErrAndWarn()[1];
    
    //Condition to check if function is called for first time or not. 
    if(!flag){
      errorFace = webview.asWebviewUri(
        vscode.Uri.joinPath(this._extensionUri, "assets", "incredible0.png")
        );
      warningFace = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "assets", "incredible0.png"));
    }
    else{
      if(errors===0){
        errorFace = webview.asWebviewUri(
          vscode.Uri.joinPath(this._extensionUri, "assets", "incredible0.png")
          );
      }
      else if(errors<5){
        errorFace = webview.asWebviewUri(
          vscode.Uri.joinPath(this._extensionUri, "assets", "incredible1.png")
          );
      }
      else if(errors<10){
        errorFace = webview.asWebviewUri(
          vscode.Uri.joinPath(this._extensionUri, "assets", "incredible2.png")
          );
      }
      else{
        errorFace = webview.asWebviewUri(
          vscode.Uri.joinPath(this._extensionUri, "assets", "incredible3.png")
          );
      }
      if(warnings===0){
        warningFace = webview.asWebviewUri(
          vscode.Uri.joinPath(this._extensionUri, "assets", "incredible0.png")
          );
      }
      else if(warnings<5){
        warningFace = webview.asWebviewUri(
          vscode.Uri.joinPath(this._extensionUri, "assets", "incredible1.png")
          );
      }
      else if(warnings<10){
        warningFace = webview.asWebviewUri(
          vscode.Uri.joinPath(this._extensionUri, "assets", "incredible2.png")
          );
      }
      else{
        warningFace = webview.asWebviewUri(
          vscode.Uri.joinPath(this._extensionUri, "assets", "incredible3.png")
          );
      }
    }
	  return getHtml(errorFace, warningFace);
	}
}

function getHtml(incredibleErrorFace: any, incredibleWarningFace:any) {
  return `
    <!DOCTYPE html>
			<html lang="en">
			<head>

			</head>

			<body>
			<section class="wrapper">
      <img class="doomFaces" src="${incredibleErrorFace}" alt="" >
      <h1 id="errorNum">${getNumErrAndWarn()[0] + " errors"}</h1>
      <img class="doomFaces" src="${incredibleWarningFace}" alt="" >
      <h1 id="errorNum">${getNumErrAndWarn()[1] + " warnings"}</h1>
			</section>
      </body>

		</html>
  `;
}

// function to get the number of errors and warnings in the open file
function getNumErrAndWarn(): number[] {
  const activeTextEditor: vscode.TextEditor | undefined =
    vscode.window.activeTextEditor;
    let numErrors = 0;
    let numWarnings = 0;
    let numErrandWarn:number[] = [];
  if (!activeTextEditor) {
    numErrandWarn[0] = numErrors;
    numErrandWarn[1] = numWarnings;
    return numErrandWarn;
  }
  const document: vscode.TextDocument = activeTextEditor.document;
  let aggregatedDiagnostics: any = {};
  let diagnostic: vscode.Diagnostic;

  // Iterate over each diagnostic that VS Code has reported for this file. For each one, add to
  // a list of objects, grouping together diagnostics which occur on a single line.
  for (diagnostic of vscode.languages.getDiagnostics(document.uri)) {
    let key = "line" + diagnostic.range.start.line;

    if (aggregatedDiagnostics[key]) {
      // Already added an object for this key, so augment the arrayDiagnostics[] array.
      aggregatedDiagnostics[key].arrayDiagnostics.push(diagnostic);
    } else {
      // Create a new object for this key, specifying the line: and a arrayDiagnostics[] array
      aggregatedDiagnostics[key] = {
        line: diagnostic.range.start.line,
        arrayDiagnostics: [diagnostic],
      };
    }

    switch (diagnostic.severity) {
      case 0:
        numErrors += 1;
        break;

      case 1:
        numWarnings += 1;
        break;

      // Ignore other severities.
    }
  }

  
  numErrandWarn[0] = numErrors;
  numErrandWarn[1] = numWarnings;

  return numErrandWarn;
}

// this method is called when your extension is deactivated
export function deactivate() {}
