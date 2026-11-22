import { z } from "zod";

const EnvSchema = z.object({
  EXPO_PUBLIC_API_URL: z
    .string()
    .url("EXPO_PUBLIC_API_URL must be a valid URL")
    .default("http://localhost:3000/api"),
  EXPO_PUBLIC_API_TIMEOUT_MS: z.coerce.number().positive().default(15000),
  EXPO_PUBLIC_NOTIFICATION_CHANNEL_ID: z
    .string()
    .min(1)
    .default("delivery-updates"),
  EXPO_PUBLIC_APP_SCHEME: z.string().min(1).default("dnpdelivery"),
  EXPO_PUBLIC_DEFAULT_STALE_TIME_MS: z.coerce
    .number()
    .positive()
    .default(30000),
  EXPO_PUBLIC_ENABLE_DEBUG_LOGS: z
    .enum(["true", "false"])
    .transform((val) => val === "true")
    .default("true"),
});

export type Env = z.infer<typeof EnvSchema>;

// Parsing environment variables
function parseEnv(): Env {
  const result = EnvSchema.safeParse({
    EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
    EXPO_PUBLIC_API_TIMEOUT_MS: process.env.EXPO_PUBLIC_API_TIMEOUT_MS,
    EXPO_PUBLIC_NOTIFICATION_CHANNEL_ID:
      process.env.EXPO_PUBLIC_NOTIFICATION_CHANNEL_ID,
    EXPO_PUBLIC_APP_SCHEME: process.env.EXPO_PUBLIC_APP_SCHEME,
    EXPO_PUBLIC_DEFAULT_STALE_TIME_MS:
      process.env.EXPO_PUBLIC_DEFAULT_STALE_TIME_MS,
    EXPO_PUBLIC_ENABLE_DEBUG_LOGS: process.env.EXPO_PUBLIC_ENABLE_DEBUG_LOGS,
  });

  if (!result.success) {
    if (__DEV__) {
      console.error(
        "❌ [Env] Invalid environment variables:",
        result.error.flatten().fieldErrors,
      );
    }
    return EnvSchema.parse({});
  }

  return result.data;
}

export const env = parseEnv();
