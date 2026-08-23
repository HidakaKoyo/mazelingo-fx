import { init } from "./init";

try {
  await init();
} catch (error) {
  console.error("[mlg:popup] init failed:", error);
}
