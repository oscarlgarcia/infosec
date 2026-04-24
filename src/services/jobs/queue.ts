type QueueTask = {
  id: string;
  run: () => Promise<void>;
};

class AsyncJobQueue {
  private readonly tasks: QueueTask[] = [];
  private running = false;

  enqueue(task: QueueTask) {
    this.tasks.push(task);
    void this.drain();
  }

  getState() {
    return {
      running: this.running,
      queued: this.tasks.length,
    };
  }

  private async drain() {
    if (this.running) return;
    this.running = true;

    while (this.tasks.length > 0) {
      const task = this.tasks.shift();
      if (!task) break;
      try {
        await task.run();
      } catch (error) {
        console.error(`Queue task ${task.id} failed`, error);
      }
    }

    this.running = false;
  }
}

export const appJobQueue = new AsyncJobQueue();
