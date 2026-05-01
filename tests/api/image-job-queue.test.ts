import { describe, expect, it } from "vitest";
import { GET as getTask, POST as cancelTask } from "@/app/api/tasks/[taskId]/route";
import { POST as exchangeImportCode } from "@/app/api/import/exchange/route";
import { getSession, resetDevStore } from "@/server/services/dev-store";
import {
  createImageTask,
  getImageTaskForUser,
  resetImageTaskStore
} from "@/server/services/image-task-service";
import {
  enqueueImageJob,
  expireStaleImageJobs,
  getImageJobForTask,
  resetImageJobQueueStore
} from "@/server/services/image-job-queue-service";

async function bindSession() {
  const response = await exchangeImportCode(
    new Request("http://localhost/api/import/exchange", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ import_code: "valid_one_time_code" })
    })
  );

  return response.headers.get("set-cookie")?.split(";")[0] ?? "";
}

function createQueuedTask(userId: string, keyBindingId: string) {
  return createImageTask({
    userId,
    keyBindingId,
    type: "generation",
    prompt: "Queued prompt",
    params: {
      prompt: "Queued prompt",
      model: "gpt-image-2",
      size: "1024x1024",
      quality: "medium",
      n: 1,
      output_format: "png",
      output_compression: null,
      background: "auto",
      moderation: "auto"
    }
  });
}

describe("image job queue service", () => {
  it("keeps excess jobs queued behind the active user limit", async () => {
    resetDevStore();
    resetImageTaskStore();
    resetImageJobQueueStore();
    const cookie = await bindSession();
    const session = getSession(cookie.replace("psypic_session=", ""));

    if (!session) {
      throw new Error("expected session");
    }

    const firstTask = createQueuedTask(session.user_id, session.key_binding_id);
    const secondTask = createQueuedTask(session.user_id, session.key_binding_id);
    const firstJob = enqueueImageJob({
      userId: session.user_id,
      taskId: firstTask.id,
      maxActivePerUser: 1
    });
    const secondJob = enqueueImageJob({
      userId: session.user_id,
      taskId: secondTask.id,
      maxActivePerUser: 1
    });

    expect(firstJob.status).toBe("running");
    expect(secondJob.status).toBe("queued");
    expect(getImageTaskForUser(firstTask.id, session.user_id)?.status).toBe(
      "running"
    );
    expect(getImageTaskForUser(secondTask.id, session.user_id)?.status).toBe(
      "queued"
    );
  });

  it("cancels queued jobs through the existing task API", async () => {
    resetDevStore();
    resetImageTaskStore();
    resetImageJobQueueStore();
    const cookie = await bindSession();
    const session = getSession(cookie.replace("psypic_session=", ""));

    if (!session) {
      throw new Error("expected session");
    }

    const task = createQueuedTask(session.user_id, session.key_binding_id);
    enqueueImageJob({
      userId: session.user_id,
      taskId: task.id,
      maxActivePerUser: 0
    });

    const response = await cancelTask(
      new Request(`http://localhost/api/tasks/${task.id}`, {
        method: "POST",
        headers: { cookie }
      }),
      { params: Promise.resolve({ taskId: task.id }) }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.status).toBe("canceled");
    expect(getImageJobForTask(task.id)?.status).toBe("canceled");
  });

  it("expires stale running jobs and reflects failure in task status", async () => {
    resetDevStore();
    resetImageTaskStore();
    resetImageJobQueueStore();
    const cookie = await bindSession();
    const session = getSession(cookie.replace("psypic_session=", ""));

    if (!session) {
      throw new Error("expected session");
    }

    const task = createQueuedTask(session.user_id, session.key_binding_id);
    enqueueImageJob({
      userId: session.user_id,
      taskId: task.id,
      maxActivePerUser: 1,
      now: "2026-05-01T00:00:00.000Z"
    });

    expireStaleImageJobs({
      now: "2026-05-01T00:06:00.000Z",
      timeoutMs: 5 * 60 * 1000
    });
    const response = await getTask(
      new Request(`http://localhost/api/tasks/${task.id}`, {
        headers: { cookie }
      }),
      { params: Promise.resolve({ taskId: task.id }) }
    );
    const body = await response.json();

    expect(getImageJobForTask(task.id)?.status).toBe("timed_out");
    expect(body.data.status).toBe("failed");
    expect(body.data.error.code).toBe("timeout");
  });
});
