import React from "react";
import { createRoot } from "react-dom/client";
import App, { BootNet } from "./App.jsx";

/* ⚠ 그물은 반드시 App **바깥**에 있어야 한다. 안에 두면 App 이 던질 때 그물도 같이 죽는다.
   2026-08-31 라이브 사고(첫 방문자가 빈 화면) 이후 신설 — 사유는 App.jsx 의 BootNet 주석. */
createRoot(document.getElementById("root")).render(
  <BootNet><App /></BootNet>
);
