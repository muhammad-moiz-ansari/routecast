import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { Providers } from "./app/providers";
import { router } from "./app/router";
import { wakeBackend } from "./api/client";
import "./styles/tokens.css";
import "./styles/globals.css";
// Once per page load, so the backend is waking while the visitor reads or fills in the form.
wakeBackend();
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Providers>
      <RouterProvider router={router} />
    </Providers>
  </StrictMode>,
);
