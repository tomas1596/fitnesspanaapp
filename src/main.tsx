import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerRunTrackingServiceWorker } from "@/lib/runTrackingSw";

void registerRunTrackingServiceWorker();

createRoot(document.getElementById("root")!).render(<App />);
