// ui.js: opens and closes dialogs and remembers which ones are open.
export class UIManager {
  constructor() {
    this.dialogStack = [];
  }

  open(dialogEl) {
    if (!dialogEl || dialogEl.open) return;
    dialogEl.showModal();
    this.dialogStack.push(dialogEl);
  }

  close(dialogEl) {
    if (!dialogEl || !dialogEl.open) return;
    dialogEl.close();
    this.dialogStack = this.dialogStack.filter(d => d !== dialogEl);
  }

  closeTop() {
    const top = this.dialogStack.pop();
    if (top && top.open) {
      top.close();
      return true;
    }
    return false;
  }

  hasOpenDialogs() {
    this.dialogStack = this.dialogStack.filter(d => d.open);
    return this.dialogStack.length > 0;
  }

  announce(text) {
    const el = document.getElementById('liveAnnouncer');
    if (el) el.textContent = text;
  }
}

export const UI = new UIManager();