import React from "react";
import { Routes, Route } from "react-router-dom";

import Home from "./Home";
import CampaignDemo from "./page/Campaign/CampaignDemo";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/demo" element={<CampaignDemo />} />
    </Routes>
  );
}
