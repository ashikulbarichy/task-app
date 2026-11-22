import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging, type Message } from "firebase-admin/messaging";
import fs from "fs";
import path from "path";
import readline from "readline";

const TOKEN_CACHE_FILE = path.join(__dirname, ".latest-token.txt");
const SERVICE_ACCOUNT_FILE = path.join(__dirname, "serviceAccountKey.json");

/**
 * Initializes Firebase Admin SDK.
 * Looks for `serviceAccountKey.json` inside backend-mock/ or root.
 */
function initializeFirebaseAdmin(): boolean {
  if (getApps().length > 0) {
    return true;
  }

  let serviceAccountPath: string | null = null;

  if (fs.existsSync(SERVICE_ACCOUNT_FILE)) {
    serviceAccountPath = SERVICE_ACCOUNT_FILE;
  } else if (fs.existsSync(path.join(__dirname, "..", "serviceAccountKey.json"))) {
    serviceAccountPath = path.join(__dirname, "..", "serviceAccountKey.json");
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  }

  if (!serviceAccountPath) {
    console.error("\n❌ ERROR: Firebase Admin SDK requires a service account key!");
    console.error("Please place 'serviceAccountKey.json' in 'backend-mock/' or root.");
    console.error("How to obtain it: Firebase Console -> Project Settings -> Service accounts -> Generate new private key.\n");
    return false;
  }

  try {
    const serviceAccount = JSON.parse(
      fs.readFileSync(serviceAccountPath, "utf-8"),
    );
    initializeApp({
      credential: cert(serviceAccount),
    });
    console.log(" Connected to Firebase Admin SDK.");
    return true;
  } catch (error) {
    console.error("❌ Failed to parse service account JSON:", error);
    return false;
  }
}

/**
 * Resolves the target device FCM token from CLI arguments or cached file.
 */
function resolveFcmToken(cliToken?: string): string | null {
  if (cliToken && cliToken.trim().length > 0) {
    return cliToken.trim();
  }

  if (fs.existsSync(TOKEN_CACHE_FILE)) {
    const token = fs.readFileSync(TOKEN_CACHE_FILE, "utf-8").trim();
    if (token) {
      console.log(` Using automatically cached device token from ${TOKEN_CACHE_FILE}`);
      return token;
    }
  }

  return null;
}

interface NotificationScenario {
  name: string;
  description: string;
  buildMessage: (token: string) => Message;
}

const SCENARIOS: Record<string, NotificationScenario> = {
  "1": {
    name: "Order Update (Valid Payload)",
    description: "Sends an 'order_update' push. Expect query invalidation and immediate UI refresh.",
    buildMessage: (token) => ({
      token,
      notification: {
        title: "Driver Has Arrived!",
        body: "Alex Rivera is outside with order #ORD-9481.",
      },
      data: {
        type: "order_update",
        deliveryId: "del-101",
        status: "arrived",
        title: "Driver Has Arrived!",
        body: "Alex Rivera is outside with order #ORD-9481.",
      },
      android: {
        priority: "high",
        notification: {
          channelId: "delivery-updates",
          sound: "default",
          priority: "max",
        },
      },
      apns: {
        payload: {
          aps: {
            sound: "default",
            badge: 1,
          },
        },
      },
    }),
  },
  "2": {
    name: "Deep-Link Navigation (Valid Payload)",
    description: "Sends a push targeting order #ORD-9482. Tap to test navigation from killed/background states.",
    buildMessage: (token) => ({
      token,
      notification: {
        title: "New Delivery Assigned",
        body: "Tap to review details for order #ORD-9482.",
      },
      data: {
        type: "order_update",
        deliveryId: "del-102",
        status: "assigned",
        title: "New Delivery Assigned",
        body: "Tap to review details for order #ORD-9482.",
      },
      android: {
        priority: "high",
        notification: {
          channelId: "delivery-updates",
          sound: "default",
        },
      },
      apns: {
        payload: {
          aps: {
            sound: "default",
          },
        },
      },
    }),
  },
  "3": {
    name: "Malformed Payload (Crash Resilience Test)",
    description: "Sends invalid data missing required fields. The app must ignore it cleanly and NOT crash.",
    buildMessage: (token) => ({
      token,
      notification: {
        title: "Corrupted Test Push",
        body: "This payload has invalid schema types.",
      },
      data: {
        // Intentionally invalid: missing deliveryId, invalid type for testing Zod safeParse
        type: "unknown_corrupted_type",
        corruptedField: "true",
        invalidNumber: "not-a-number",
      },
      android: {
        priority: "high",
        notification: {
          channelId: "delivery-updates",
        },
      },
    }),
  },
};

async function sendNotification(scenarioKey: string, token: string) {
  const scenario = SCENARIOS[scenarioKey];
  if (!scenario) {
    console.error(`Unknown scenario: ${scenarioKey}`);
    return;
  }

  console.log(`\n-----------------------------------------------------`);
  console.log(`🚀 Executing Scenario ${scenarioKey}: ${scenario.name}`);
  console.log(`Description: ${scenario.description}`);
  console.log(`Target Token: ${token.substring(0, 20)}...`);
  console.log(`-----------------------------------------------------`);

  const message = scenario.buildMessage(token);

  try {
    const response = await getMessaging().send(message);
    console.log(` Message successfully sent! Message ID: ${response}\n`);
  } catch (error) {
    console.error("❌ Failed to send push notification:", error);
  }
}

async function runCli() {
  const isReady = initializeFirebaseAdmin();
  if (!isReady) {
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const cliScenario = args[0];
  const cliToken = args[1];

  const token = resolveFcmToken(cliToken);
  if (!token) {
    console.error("\n❌ ERROR: No target FCM token available!");
    console.error("Options:");
    console.error("  1. Run the app on your physical device with 'npm run mock:server' active; it will auto-cache the token.");
    console.error("  2. Or provide the token directly: npm run mock:notify <scenario: 1|2|3> <token>\n");
    process.exit(1);
  }

  if (cliScenario && SCENARIOS[cliScenario]) {
    await sendNotification(cliScenario, token);
    process.exit(0);
  }

  // Interactive prompt mode
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log("\n=======================================================");
  console.log("   DNP PUSH NOTIFICATION TEST SCRIPT (Feature 1)");
  console.log("=======================================================");
  console.log("Select a test scenario to send to your physical device:\n");
  Object.entries(SCENARIOS).forEach(([key, val]) => {
    console.log(`  [${key}] ${val.name}`);
    console.log(`      ${val.description}`);
  });
  console.log("  [q] Quit\n");

  rl.question("Enter choice (1/2/3/q): ", async (answer) => {
    const choice = answer.trim();
    if (choice === "q" || choice === "Q") {
      rl.close();
      return;
    }

    if (SCENARIOS[choice]) {
      await sendNotification(choice, token);
    } else {
      console.log("Invalid option selected.");
    }
    rl.close();
  });
}

void runCli();
