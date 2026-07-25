import { randomUUID } from "node:crypto";

export const JOB_EVENT_SCHEMA = "lyt.job-event.v1";

const EVENT_TYPES = new Set([
  "queued",
  "started",
  "progress",
  "artifact",
  "retrying",
  "completed",
  "failed",
  "canceled",
]);

export function createJobId(prefix = "lyt") {
  return `${prefix}-${randomUUID()}`;
}

export function jobEvent({
  jobId,
  sequence,
  type,
  version,
  timestamp = new Date().toISOString(),
  url,
  data,
}) {
  if (!jobId || typeof jobId !== "string") {
    throw new TypeError("jobId must be a non-empty string");
  }

  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new TypeError("sequence must be a positive integer");
  }

  if (!EVENT_TYPES.has(type)) {
    throw new TypeError(`Unknown job event type: ${type}`);
  }

  return {
    schema: JOB_EVENT_SCHEMA,
    version,
    jobId,
    sequence,
    timestamp,
    type,
    ...(url ? { url } : {}),
    ...(data && Object.keys(data).length > 0 ? { data } : {}),
  };
}

export function createJobEventWriter({
  out = process.stdout,
  version,
  jobId = createJobId(),
  now = () => new Date().toISOString(),
} = {}) {
  let sequence = 0;

  return {
    jobId,
    emit(type, { url, ...data } = {}) {
      const event = jobEvent({
        jobId,
        sequence: ++sequence,
        type,
        version,
        timestamp: now(),
        url,
        data,
      });
      out.write(`${JSON.stringify(event)}\n`);
      return event;
    },
  };
}

export function parseJobEvent(line) {
  const value = JSON.parse(String(line));

  if (value?.schema !== JOB_EVENT_SCHEMA || !EVENT_TYPES.has(value?.type)) {
    throw new TypeError("Not a lyt.job-event.v1 event");
  }

  return value;
}
