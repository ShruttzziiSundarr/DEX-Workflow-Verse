import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { ThemeProvider } from "next-themes";

// Polyfill Buffer for browser compatibility (needed for Marinade SDK)
import { Buffer } from 'buffer';
(window as any).Buffer = Buffer;
(globalThis as any).Buffer = Buffer;

createRoot(document.getElementById("root")!).render(
  <ThemeProvider attribute="class" defaultTheme="dark">
    <App />
  </ThemeProvider>
);
