import { Router } from "express";
import { getPublicSettings } from "../lib/settingsConfig.js";

export const settingsRouter = Router();

settingsRouter.get("/", (req, res) => {
  const settings = getPublicSettings();
  res.json({ ok: true, settings });
});