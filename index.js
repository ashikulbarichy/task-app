import { registerRootComponent } from "expo";
import App from "./App";
// Register background location task at global entry point for headless execution
import "./src/features/tracking/backgroundTask";

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
