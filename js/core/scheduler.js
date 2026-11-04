/**
 * js/core/scheduler.js
 * Deterministic Freeze-Aware Task Scheduler
 * Pauses remaining delta-time and resumes without softlocks or timer racing.
 */
export class Scheduler {
  constructor() {
    this.tasks = new Map();
    this.nextId = 1;
    this.isPaused = false;
    this.disposed = false;
  }

  after(ms, fn) {
    if (this.disposed) return -1;
    const id = this.nextId++;
    const task = {
      id,
      fn,
      duration: ms,
      remaining: ms,
      isInterval: false,
      timerId: null,
      startTime: Date.now()
    };

    if (!this.isPaused) {
      task.timerId = setTimeout(() => this.execute(id), ms);
    }

    this.tasks.set(id, task);
    return id;
  }

  every(ms, fn) {
    if (this.disposed) return -1;
    const id = this.nextId++;
    const task = {
      id,
      fn,
      duration: ms,
      remaining: ms,
      isInterval: true,
      timerId: null,
      startTime: Date.now()
    };

    if (!this.isPaused) {
      task.timerId = setTimeout(() => this.execute(id), ms);
    }

    this.tasks.set(id, task);
    return id;
  }

  execute(id) {
    if (this.disposed) return;
    const task = this.tasks.get(id);
    if (!task) return;

    try {
      task.fn();
    } catch (err) {
      console.error(`[Scheduler] Task ${id} threw:`, err);
    }

    if (task.isInterval && !this.disposed && this.tasks.has(id)) {
      task.remaining = task.duration;
      task.startTime = Date.now();
      if (!this.isPaused) {
        task.timerId = setTimeout(() => this.execute(id), task.duration);
      }
    } else {
      this.tasks.delete(id);
    }
  }

  pause() {
    if (this.isPaused || this.disposed) return;
    this.isPaused = true;
    const now = Date.now();

    for (const task of this.tasks.values()) {
      clearTimeout(task.timerId);
      const elapsed = now - task.startTime;
      task.remaining = Math.max(0, task.remaining - elapsed);
    }
  }

  resume() {
    if (!this.isPaused || this.disposed) return;
    this.isPaused = false;
    const now = Date.now();

    for (const task of this.tasks.values()) {
      task.startTime = now;
      task.timerId = setTimeout(() => this.execute(task.id), task.remaining);
    }
  }

  cancel(id) {
    const task = this.tasks.get(id);
    if (task) {
      clearTimeout(task.timerId);
      this.tasks.delete(id);
    }
  }

  cancelAll() {
    for (const task of this.tasks.values()) {
      clearTimeout(task.timerId);
    }
    this.tasks.clear();
  }

  dispose() {
    this.disposed = true;
    this.cancelAll();
  }
}