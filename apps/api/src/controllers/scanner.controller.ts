import { Request, Response } from "express";
import { scanWebsiteForBugs } from "../services/scanner.service";

export async function auditUrlHandler(req: Request, res: Response): Promise<void> {
  const { url, projectId, simulateClicks } = req.body;

  if (!url || typeof url !== "string" || !url.trim()) {
    res.status(400).json({ error: "BadRequest", message: "A valid website URL is required." });
    return;
  }

  try {
    const result = await scanWebsiteForBugs({
      url: url.trim(),
      projectId: projectId || "proj_dev_testing",
      simulateClicks: !!simulateClicks
    });

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (err: any) {
    console.error("[Scanner] Audit failed:", err);
    res.status(500).json({
      error: "ScannerError",
      message: err.message || "Failed to audit website URL."
    });
  }
}
