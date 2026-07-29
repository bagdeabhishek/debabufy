import path from "node:path";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  shell
} from "electron";
import { getWorkflow, listWorkflows } from "../../workflows/registry.js";
import {
  chromeDefaults,
  launchOrdinaryChrome
} from "./chrome.js";

const appDirectory = path.dirname(fileURLToPath(import.meta.url));
const proposals = new Map();
let mainWindow;
let workflowRunning = false;

function trustedSender(event) {
  const senderUrl = event.senderFrame?.url;
  return senderUrl?.startsWith("file:") &&
    senderUrl.endsWith("/apps/desktop/renderer/index.html");
}

function assertTrusted(event) {
  if (!trustedSender(event)) {
    throw new Error("Rejected a request from an untrusted application page.");
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 920,
    height: 780,
    minWidth: 720,
    minHeight: 650,
    show: false,
    backgroundColor: "#f6f1e7",
    title: "DeBabufy",
    webPreferences: {
      preload: path.join(appDirectory, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.removeMenu();
  mainWindow.loadFile(path.join(appDirectory, "renderer", "index.html"));
  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://github.com/")) shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event) => event.preventDefault());
}

function registerIpc() {
  ipcMain.handle("app:list-workflows", (event) => {
    assertTrusted(event);
    return listWorkflows();
  });

  ipcMain.handle("file:choose-statement", async (event) => {
    assertTrusted(event);
    const result = await dialog.showOpenDialog(mainWindow, {
      title: "Choose the previous Form 141 challan statement",
      properties: ["openFile"],
      filters: [
        {
          name: "Challan statements",
          extensions: ["pdf", "json", "txt"]
        }
      ]
    });
    if (result.canceled) return null;
    return {
      path: result.filePaths[0],
      name: path.basename(result.filePaths[0])
    };
  });

  ipcMain.handle("chrome:launch", async (event) => {
    assertTrusted(event);
    const chromeProfile = path.join(app.getPath("userData"), "chrome-profile");
    return launchOrdinaryChrome({
      userDataDirectory: chromeProfile,
      cdp: chromeDefaults.cdp
    });
  });

  ipcMain.handle("workflow:prepare", async (event, request) => {
    assertTrusted(event);
    if (workflowRunning) throw new Error("A workflow is already running.");
    const workflow = getWorkflow(String(request?.workflowId ?? ""));
    const previousChallan = String(request?.previousChallan ?? "");
    const currentAmount = Number(request?.currentAmount);
    if (!path.isAbsolute(previousChallan)) {
      throw new Error("Choose a previous challan statement.");
    }
    if (!Number.isFinite(currentAmount) || currentAmount <= 0) {
      throw new Error("Enter a positive current payment amount.");
    }

    const proposal = await workflow.prepare({
      previousChallan,
      currentAmount
    });
    const token = randomUUID();
    proposals.clear();
    proposals.set(token, {
      workflowId: workflow.manifest.id,
      filing: proposal.filing,
      createdAt: Date.now()
    });
    return { token, summary: proposal.summary };
  });

  ipcMain.handle("workflow:run", async (event, request) => {
    assertTrusted(event);
    if (workflowRunning) throw new Error("A workflow is already running.");
    if (request?.reviewed !== true) {
      throw new Error("Review the proposal before running the workflow.");
    }
    const proposal = proposals.get(String(request?.token ?? ""));
    if (!proposal || Date.now() - proposal.createdAt > 30 * 60_000) {
      throw new Error("The proposal expired. Prepare it again.");
    }

    workflowRunning = true;
    const workflow = getWorkflow(proposal.workflowId);
    const diagnosticsDirectory = path.join(
      app.getPath("userData"),
      "diagnostics"
    );
    try {
      return await workflow.run({
        filing: proposal.filing,
        cdp: chromeDefaults.cdp,
        diagnosticsDirectory,
        onProgress(progress) {
          if (!mainWindow?.isDestroyed()) {
            mainWindow.webContents.send("workflow:progress", progress);
          }
        }
      });
    } finally {
      workflowRunning = false;
    }
  });

  ipcMain.handle("diagnostics:open", async (event) => {
    assertTrusted(event);
    const diagnosticsDirectory = path.join(
      app.getPath("userData"),
      "diagnostics"
    );
    await fs.mkdir(diagnosticsDirectory, { recursive: true });
    return shell.openPath(diagnosticsDirectory);
  });
}

app.whenReady().then(() => {
  registerIpc();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
