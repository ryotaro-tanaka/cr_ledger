import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";
import { SelectionProvider } from "./lib/selection";
import { CommonPlayersProvider } from "./lib/commonPlayers";
import { CardMasterProvider } from "./cards/CardMasterProvider";

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js");
  });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <SelectionProvider>
        <CommonPlayersProvider>
          <CardMasterProvider>
            <App />
          </CardMasterProvider>
        </CommonPlayersProvider>
      </SelectionProvider>
    </BrowserRouter>
  </React.StrictMode>
);
