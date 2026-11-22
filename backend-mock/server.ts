import cors from "cors";
import express, { type Request, type Response } from "express";
import fs from "fs";
import path from "path";

const app = express();
const PORT = Number(process.env.MOCK_SERVER_PORT || process.env.PORT || 3000);
const TOKEN_CACHE_FILE = path.join(__dirname, ".latest-token.txt");

app.use(cors());
app.use(express.json());

let latestRegisteredToken: string | null = null;
const latestTrackingLocations = new Map<string, any>();

let notificationSettings = {
  orderUpdates: true,
  deliveryAlerts: true,
  soundEnabled: true,
  promotional: false,
};

const deliveries = [
  {
    id: "del-101",
    orderNumber: "ORD-9481",
    status: "pending",
    customerName: "Alex Rivera",
    address: "Road 103, House 14, Gulshan-2, Dhaka 1212",
    latitude: 23.7925,
    longitude: 90.4078,
    items: ["2x Gourmet Pizza", "1x Sparkling Water"],
    notes: "Please leave on porch if no answer.",
    updatedAt: new Date().toLocaleTimeString(),
  },
  {
    id: "del-102",
    orderNumber: "ORD-9482",
    status: "started",
    customerName: "Samantha Chen",
    address: "Road 27 (Old), House 42, Dhanmondi, Dhaka 1209",
    latitude: 23.7538,
    longitude: 90.3752,
    items: ["1x Thai Iced Tea", "1x Pad Thai"],
    notes: "Ring bell twice.",
    updatedAt: new Date().toLocaleTimeString(),
  },
  {
    id: "del-103",
    orderNumber: "ORD-9483",
    status: "completed",
    customerName: "David Miller",
    address: "Road 11, Block D, Banani, Dhaka 1213",
    latitude: 23.7937,
    longitude: 90.4035,
    items: ["1x Family Meal Deal"],
    notes: "Delivered to reception desk.",
    recipientName: "David M.",
    updatedAt: new Date().toLocaleTimeString(),
  },
];

app.use((req, _res, next) => {
  console.log(`[MockServer] ${req.method} ${req.url}`);
  next();
});

app.get("/api/deliveries", (_req: Request, res: Response) => {
  res.json(deliveries);
});

app.get("/api/deliveries/:id", (req: Request, res: Response): void => {
  const delivery = deliveries.find((d) => d.id === req.params.id);
  if (!delivery) {
    res.status(404).json({
      message: `Delivery with ID '${req.params.id}' was not found.`,
      code: "NOT_FOUND",
    });
    return;
  }
  res.json(delivery);
});

app.patch("/api/deliveries/:id/status", (req: Request, res: Response): void => {
  if (req.headers["x-mock-error"] === "500" || req.query.simulateError === "500") {
    console.log(`[MockServer] 💥 SIMULATING 500 ERROR on PATCH status for ${req.params.id}`);
    res.status(500).json({
      message: "Simulated Internal Server Error (500) to test React Query optimistic rollback.",
      code: "SERVER_ERROR",
    });
    return;
  }

  const delivery = deliveries.find((d) => d.id === req.params.id);
  if (!delivery) {
    res.status(404).json({
      message: `Delivery with ID '${req.params.id}' was not found.`,
      code: "NOT_FOUND",
    });
    return;
  }

  const { status } = req.body;
  if (!status) {
    res.status(400).json({
      message: "Missing 'status' in request body.",
      code: "VALIDATION_ERROR",
    });
    return;
  }

  delivery.status = status;
  delivery.updatedAt = new Date().toLocaleTimeString();
  console.log(`[MockServer] Delivery ${delivery.id} status updated to '${status}'.`);
  res.json(delivery);
});

app.post("/api/deliveries/:id/complete", (req: Request, res: Response): void => {
  if (req.headers["x-mock-error"] === "500" || req.query.simulateError === "500") {
    console.log(`[MockServer] 💥 SIMULATING 500 ERROR on complete delivery for ${req.params.id}`);
    res.status(500).json({
      message: "Simulated Internal Server Error (500) to test React Query optimistic rollback.",
      code: "SERVER_ERROR",
    });
    return;
  }

  const delivery = deliveries.find((d) => d.id === req.params.id);
  if (!delivery) {
    res.status(404).json({
      message: `Delivery with ID '${req.params.id}' was not found.`,
      code: "NOT_FOUND",
    });
    return;
  }

  const { recipientName, notes } = req.body;
  if (!recipientName) {
    res.status(400).json({
      message: "Missing 'recipientName' in request body.",
      code: "VALIDATION_ERROR",
    });
    return;
  }

  delivery.status = "completed";
  delivery.recipientName = recipientName;
  delivery.notes = notes || "";
  delivery.updatedAt = new Date().toLocaleTimeString();

  console.log(`[MockServer] Delivery ${delivery.id} completed. Recipient: ${recipientName}`);
  res.json(delivery);
});

app.post("/api/notifications/token", (req: Request, res: Response): void => {
  const { token, platform, deviceModel } = req.body;
  if (!token) {
    res.status(400).json({
      message: "Missing 'token' in request body.",
      code: "VALIDATION_ERROR",
    });
    return;
  }

  latestRegisteredToken = token;
  try {
    fs.writeFileSync(TOKEN_CACHE_FILE, token, "utf-8");
  } catch (err) {
    console.error("[MockServer] Failed to write token cache file:", err);
  }

  console.log(`\n======================================================`);
  console.log(`[FCM TOKEN REGISTERED]`);
  console.log(`Platform: ${platform} (${deviceModel || "Unknown Device"})`);
  console.log(`Token: ${token}`);
  console.log(`======================================================\n`);

  res.json({ success: true, message: "Token registered successfully" });
});

app.get("/api/notifications/settings", (_req: Request, res: Response) => {
  res.json(notificationSettings);
});

app.put("/api/notifications/settings", (req: Request, res: Response) => {
  notificationSettings = {
    ...notificationSettings,
    ...req.body,
  };
  console.log("[MockServer] Updated settings:", notificationSettings);
  res.json(notificationSettings);
});

app.post("/api/tracking/batch", (req: Request, res: Response) => {
  const locations = req.body?.locations || [];
  for (const loc of locations) {
    if (loc.deliveryId) {
      latestTrackingLocations.set(loc.deliveryId, loc);
    }
  }
  console.log(`[MockServer] Received tracking batch: ${locations.length} points.`);
  res.json({ success: true, processed: locations.length });
});

app.get("/api/tracking/:deliveryId/latest", (req: Request, res: Response): void => {
  const deliveryId = req.params.deliveryId;
  if (!deliveryId) {
    res.status(400).json({ message: "Delivery ID parameter is required", code: "VALIDATION_ERROR" });
    return;
  }

  const loc = latestTrackingLocations.get(deliveryId);
  if (loc) {
    res.json(loc);
    return;
  }

  const delivery = deliveries.find((d) => d.id === deliveryId);
  if (delivery && delivery.latitude && delivery.longitude) {
    res.json({
      latitude: delivery.latitude - 0.003,
      longitude: delivery.longitude - 0.003,
      accuracy: 12,
      speed: 7.2,
      heading: 90,
      timestamp: Date.now(),
      deliveryId: delivery.id,
    });
    return;
  }

  res.status(404).json({ message: "No tracking fixes available", code: "NOT_FOUND" });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`\n🚀 DNP Mock Backend Server running at:`);
  console.log(`   - Local:    http://localhost:${PORT}/api`);
  console.log(`   - Network:  http://<YOUR_LOCAL_IP>:${PORT}/api`);
  console.log(`   Waiting for physical device connections...\n`);
});
