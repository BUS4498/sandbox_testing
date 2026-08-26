/** Use the existing Codex thread and installed Outlook Email app as transport. */
export class CodexOutlookTransport {
  constructor({ runManager }) {
    if (typeof runManager?.sendOutlookMessages !== "function") {
      throw new TypeError("CodexOutlookTransport requires the local workflow manager with Outlook support.");
    }
    this.runManager = runManager;
  }

  sendBatch(messages) {
    return this.runManager.sendOutlookMessages(messages);
  }

  readiness(options) {
    return this.runManager.checkOutlookReadiness(options);
  }
}
