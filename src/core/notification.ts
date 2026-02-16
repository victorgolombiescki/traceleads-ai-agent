// Removed tRPC dependency - using NestJS exceptions instead
// Using process.env directly

// Simple error class to replace TRPCError
class NotificationError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'NotificationError';
  }
}

export type NotificationPayload = {
  title: string;
  content: string;
};

const TITLE_MAX_LENGTH = 1200;
const CONTENT_MAX_LENGTH = 20000;

const trimValue = (value: string): string => value.trim();
const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const buildEndpointUrl = (baseUrl: string): string => {
  const normalizedBase = baseUrl.endsWith("/")
    ? baseUrl
    : `${baseUrl}/`;
  return new URL(
    "webdevtoken.v1.WebDevService/SendNotification",
    normalizedBase
  ).toString();
};

const validatePayload = (input: NotificationPayload): NotificationPayload => {
  if (!isNonEmptyString(input.title)) {
    throw new NotificationError('BAD_REQUEST', "Notification title is required.");
  }
  if (!isNonEmptyString(input.content)) {
    throw new NotificationError('BAD_REQUEST', "Notification content is required.");
  }

  const title = trimValue(input.title);
  const content = trimValue(input.content);

  if (title.length > TITLE_MAX_LENGTH) {
    throw new NotificationError('BAD_REQUEST', `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`);
  }

  if (content.length > CONTENT_MAX_LENGTH) {
    throw new NotificationError('BAD_REQUEST', `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`);
  }

  return { title, content };
};

/**
 * Dispatches a project-owner notification through the Manus Notification Service.
 * Returns `true` if the request was accepted, `false` when the upstream service
 * cannot be reached (callers can fall back to email/slack). Validation errors
 * bubble up as TRPC errors so callers can fix the payload.
 */
export async function notifyOwner(
  payload: NotificationPayload
): Promise<boolean> {
  const { title, content } = validatePayload(payload);

  const apiUrl = process.env.OPENAI_API_URL || "";
  const apiKey = process.env.OPENAI_API_KEY || "";
  
  if (!apiUrl) {
    throw new NotificationError('INTERNAL_SERVER_ERROR', "OPENAI_API_URL is not configured.");
  }

  if (!apiKey) {
    throw new NotificationError('INTERNAL_SERVER_ERROR', "OPENAI_API_KEY is not configured.");
  }

  const endpoint = buildEndpointUrl(apiUrl);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
        "connect-protocol-version": "1",
      },
      body: JSON.stringify({ title, content }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn(
        `[Notification] Failed to notify owner (${response.status} ${response.statusText})${
          detail ? `: ${detail}` : ""
        }`
      );
      return false;
    }

    return true;
  } catch (error) {
    console.warn("[Notification] Error calling notification service:", error);
    return false;
  }
}
