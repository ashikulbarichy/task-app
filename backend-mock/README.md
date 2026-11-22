# DNP Backend Mock & Test CLI

This folder contains a lightweight Express server and CLI push notification tester.

## Setup
1. In the [Firebase Console](https://console.firebase.google.com/):
   - Navigate to **Project settings** -> **Service accounts**.
   - Click **Generate new private key**.
2. Save the downloaded JSON file into this directory as:
   `serviceAccountKey.json` (this file is ignored by Git).
3. Run the mock server:
   ```bash
   npm run mock:server
   ```
4. Send test push notifications:
   ```bash
   npm run mock:notify 1
   ```
