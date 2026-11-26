import { Request, Response } from "express";
import { getRepository } from "../db";
import { SecurityService } from "../services/security.service";
import { ScanQueueService } from "../services/scan-queue.service";
import { isAuthPaused } from "../middleware/auth";

async function isProjectAuthorized(userId: string, projectId: string): Promise<boolean> {
  const repo = getRepository();
  const project = await repo.findProjectByIdAndOwner(projectId, userId);
  return !!project || isAuthPaused();
}

async function verifyScanAccess(scanId: string, userId: string): Promise<{ authorized: boolean; scan: any }> {
  const repo = getRepository();
  const scan = await repo.findScanById(scanId);
  if (!scan) return { authorized: false, scan: null };
  const authorized = await isProjectAuthorized(userId, scan.projectId);
  return { authorized, scan };
}

async function verifyWebsiteAccess(websiteId: string, userId: string): Promise<{ authorized: boolean; website: any }> {
  const repo = getRepository();
  const website = await repo.findWebsiteById(websiteId);
  if (!website) return { authorized: false, website: null };
  const authorized = await isProjectAuthorized(userId, website.projectId);
  return { authorized, website };
}

export async function registerWebsiteHandler(req: Request, res: Response): Promise<void> {
  const { url, domain, projectId } = req.body;
  const target = url || domain;
  const userId = req.user!.id;

  if (!target || typeof target !== "string") {
    res.status(400).json({ error: "BadRequest", message: "A valid website URL or domain is required." });
    return;
  }

  const validation = await SecurityService.validateTargetUrl(target);
  if (!validation.isValid || !validation.normalizedUrl || !validation.domain) {
    res.status(400).json({ error: "InvalidTarget", message: validation.error || "Invalid website URL or target rejected." });
    return;
  }

  const repo = getRepository();
  let effectiveProjectId = projectId;
  if (!effectiveProjectId) {
    const userProjects = await repo.listProjectsByOwner(userId);
    effectiveProjectId = userProjects[0]?.id || (isAuthPaused() ? "proj_dev_testing" : null);
  }

  if (!effectiveProjectId) {
    res.status(400).json({ error: "BadRequest", message: "User has no projects. Please create a project first." });
    return;
  }

  const authorized = await isProjectAuthorized(userId, effectiveProjectId);
  if (!authorized) {
    res.status(403).json({ error: "Forbidden", message: "Not authorized to register website for this project." });
    return;
  }

  try {
    const existing = await repo.findWebsiteByDomain(effectiveProjectId, validation.domain);
    if (existing) {
      res.status(200).json({ success: true, data: existing });
      return;
    }

    const website = await repo.createWebsite({
      projectId: effectiveProjectId,
      domain: validation.domain,
      normalizedBaseUrl: validation.normalizedUrl,
      createdBy: userId
    });

    res.status(201).json({ success: true, data: website });
  } catch (err: any) {
    res.status(500).json({ error: "InternalError", message: err.message });
  }
}

export async function listWebsitesHandler(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const reqProjectId = req.query.projectId as string | undefined;
  const repo = getRepository();

  try {
    if (reqProjectId) {
      const authorized = await isProjectAuthorized(userId, reqProjectId);
      if (!authorized) {
        res.status(403).json({ error: "Forbidden", message: "Not authorized for this project." });
        return;
      }
      const websites = await repo.listWebsitesByProject(reqProjectId);
      res.status(200).json({ success: true, data: websites });
      return;
    }

    const userProjects = await repo.listProjectsByOwner(userId);
    let allWebsites: any[] = [];
    for (const p of userProjects) {
      const sites = await repo.listWebsitesByProject(p.id);
      allWebsites = allWebsites.concat(sites);
    }

    if (allWebsites.length === 0 && isAuthPaused()) {
      allWebsites = await repo.listWebsitesByProject("proj_dev_testing");
    }

    res.status(200).json({ success: true, data: allWebsites });
  } catch (err: any) {
    res.status(500).json({ error: "InternalError", message: err.message });
  }
}

export async function verifyWebsiteHandler(req: Request, res: Response): Promise<void> {
  const { websiteId } = req.params;
  const userId = req.user!.id;
  const repo = getRepository();

  try {
    const { authorized, website } = await verifyWebsiteAccess(websiteId, userId);
    if (!website) {
      res.status(404).json({ error: "NotFound", message: "Website not found." });
      return;
    }
    if (!authorized) {
      res.status(403).json({ error: "Forbidden", message: "Not authorized to verify this website." });
      return;
    }

    const verificationResult = await SecurityService.verifyDomainOwnership(
      website.domain,
      website.verificationToken
    );

    if (verificationResult.verified) {
      const updated = await repo.updateWebsiteVerification(website.id, "verified", new Date());
      res.status(200).json({ success: true, data: updated, message: verificationResult.details });
    } else {
      res.status(400).json({
        success: false,
        error: "VerificationFailed",
        message: verificationResult.details
      });
    }
  } catch (err: any) {
    res.status(500).json({ error: "InternalError", message: err.message });
  }
}

export async function createScanHandler(req: Request, res: Response): Promise<void> {
  const { websiteId, url, scanType, configuration } = req.body;
  const userId = req.user!.id;
  const repo = getRepository();

  try {
    let effectiveProjectId = (req.body.projectId as string) || (req as any).user?.projectId;
    if (!effectiveProjectId) {
      const userProjects = await repo.listProjectsByOwner(userId);
      effectiveProjectId = userProjects[0]?.id || (isAuthPaused() ? "proj_dev_testing" : null);
    }

    if (!effectiveProjectId) {
      res.status(400).json({ error: "BadRequest", message: "User has no project." });
      return;
    }

    const authorized = await isProjectAuthorized(userId, effectiveProjectId);
    if (!authorized) {
      res.status(403).json({ error: "Forbidden", message: "Not authorized to create scans for this project." });
      return;
    }

    let targetWebsite: any = null;

    if (websiteId) {
      const access = await verifyWebsiteAccess(websiteId, userId);
      if (!access.website) {
        res.status(404).json({ error: "NotFound", message: "Website not found." });
        return;
      }
      if (!access.authorized) {
        res.status(403).json({ error: "Forbidden", message: "Not authorized for this website." });
        return;
      }
      targetWebsite = access.website;
    } else if (url) {
      const validation = await SecurityService.validateTargetUrl(url);
      if (!validation.isValid || !validation.normalizedUrl || !validation.domain) {
        res.status(400).json({ error: "InvalidTarget", message: validation.error || "Invalid target URL." });
        return;
      }

      targetWebsite = await repo.findWebsiteByDomain(effectiveProjectId, validation.domain);
      if (!targetWebsite) {
        targetWebsite = await repo.createWebsite({
          projectId: effectiveProjectId,
          domain: validation.domain,
          normalizedBaseUrl: validation.normalizedUrl,
          createdBy: userId
        });
      }
    }

    if (!targetWebsite) {
      res.status(400).json({ error: "BadRequest", message: "Either 'websiteId' or 'url' must be supplied." });
      return;
    }

    // Check verification status (skip in dev mode)
    if (
      process.env.NODE_ENV !== "development" &&
      process.env.PAUSE_AUTH !== "true" &&
      targetWebsite.verificationStatus !== "verified"
    ) {
      res.status(403).json({
        error: "Forbidden",
        message: "Domain must be verified before running automated scans in production."
      });
      return;
    }

    const scanRecord = await repo.createWebsiteScan({
      websiteId: targetWebsite.id,
      projectId: effectiveProjectId,
      initiatedBy: userId,
      scanType: scanType || "quick",
      configurationJson: configuration || {}
    });

    // Enqueue scan execution
    await ScanQueueService.enqueueScan(
      scanRecord.id,
      targetWebsite.normalizedBaseUrl,
      {
        scanType: (scanType as any) || "quick",
        ...(configuration || {})
      }
    );

    res.status(202).json({
      success: true,
      data: scanRecord,
      message: "Website scan initiated successfully."
    });
  } catch (err: any) {
    console.error("[createScanHandler] Error:", err);
    res.status(500).json({ error: "InternalError", message: err.message });
  }
}

export async function listScansHandler(req: Request, res: Response): Promise<void> {
  const { websiteId, projectId } = req.query;
  const userId = req.user!.id;
  const repo = getRepository();

  try {
    let scans: any[] = [];
    if (websiteId) {
      const access = await verifyWebsiteAccess(websiteId as string, userId);
      if (!access.website) {
        res.status(404).json({ error: "NotFound", message: "Website not found." });
        return;
      }
      if (!access.authorized) {
        res.status(403).json({ error: "Forbidden", message: "Not authorized for this website." });
        return;
      }
      scans = await repo.listScansByWebsite(websiteId as string);
    } else {
      const effProject = (projectId as string) || (req as any).user?.projectId;
      if (effProject) {
        const authorized = await isProjectAuthorized(userId, effProject);
        if (!authorized) {
          res.status(403).json({ error: "Forbidden", message: "Not authorized for this project." });
          return;
        }
        scans = await repo.listScansByProject(effProject);
      } else {
        const userProjects = await repo.listProjectsByOwner(userId);
        for (const p of userProjects) {
          const s = await repo.listScansByProject(p.id);
          scans = scans.concat(s);
        }
        if (scans.length === 0 && isAuthPaused()) {
          scans = await repo.listScansByProject("proj_dev_testing");
        }
      }
    }

    res.status(200).json({ success: true, data: scans });
  } catch (err: any) {
    res.status(500).json({ error: "InternalError", message: err.message });
  }
}

export async function getScanHandler(req: Request, res: Response): Promise<void> {
  const { scanId } = req.params;
  const userId = req.user!.id;

  try {
    const { authorized, scan } = await verifyScanAccess(scanId, userId);
    if (!scan) {
      res.status(404).json({ error: "NotFound", message: "Scan not found." });
      return;
    }
    if (!authorized) {
      res.status(403).json({ error: "Forbidden", message: "Not authorized to access this scan." });
      return;
    }

    res.status(200).json({ success: true, data: scan });
  } catch (err: any) {
    res.status(500).json({ error: "InternalError", message: err.message });
  }
}

export async function getScanProgressHandler(req: Request, res: Response): Promise<void> {
  const { scanId } = req.params;
  const userId = req.user!.id;

  try {
    const { authorized, scan } = await verifyScanAccess(scanId, userId);
    if (!scan) {
      res.status(404).json({ error: "NotFound", message: "Scan not found." });
      return;
    }
    if (!authorized) {
      res.status(403).json({ error: "Forbidden", message: "Not authorized to access this scan." });
      return;
    }

    const liveJob = ScanQueueService.getLiveProgress(scanId);

    res.status(200).json({
      success: true,
      data: {
        scanId: scan.id,
        status: liveJob?.status || scan.status,
        pagesDiscovered: liveJob?.pagesDiscovered ?? scan.pagesDiscovered,
        pagesScanned: liveJob?.pagesScanned ?? scan.pagesScanned,
        currentUrl: liveJob?.currentUrl,
        healthScore: scan.healthScore,
        completedAt: scan.completedAt,
        errorSummary: scan.errorSummary
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: "InternalError", message: err.message });
  }
}

export async function cancelScanHandler(req: Request, res: Response): Promise<void> {
  const { scanId } = req.params;
  const userId = req.user!.id;

  try {
    const { authorized, scan } = await verifyScanAccess(scanId, userId);
    if (!scan) {
      res.status(404).json({ error: "NotFound", message: "Scan not found." });
      return;
    }
    if (!authorized) {
      res.status(403).json({ error: "Forbidden", message: "Not authorized to cancel this scan." });
      return;
    }

    const cancelled = ScanQueueService.cancelScan(scanId);
    if (cancelled) {
      res.status(200).json({ success: true, message: "Scan cancellation requested." });
    } else {
      res.status(400).json({ error: "CannotCancel", message: "Scan is either not running or already finished." });
    }
  } catch (err: any) {
    res.status(500).json({ error: "InternalError", message: err.message });
  }
}

export async function getScanFindingsHandler(req: Request, res: Response): Promise<void> {
  const { scanId } = req.params;
  const { category, severity, verificationStatus } = req.query;
  const userId = req.user!.id;
  const repo = getRepository();

  try {
    const { authorized, scan } = await verifyScanAccess(scanId, userId);
    if (!scan) {
      res.status(404).json({ error: "NotFound", message: "Scan not found." });
      return;
    }
    if (!authorized) {
      res.status(403).json({ error: "Forbidden", message: "Not authorized to access findings for this scan." });
      return;
    }

    const findings = await repo.listScanFindings(scanId, {
      category: category as string,
      severity: severity as string,
      verificationStatus: verificationStatus as string
    });

    res.status(200).json({ success: true, data: findings });
  } catch (err: any) {
    res.status(500).json({ error: "InternalError", message: err.message });
  }
}

export async function getScanReportHandler(req: Request, res: Response): Promise<void> {
  const { scanId } = req.params;
  const userId = req.user!.id;
  const repo = getRepository();

  try {
    const { authorized, scan } = await verifyScanAccess(scanId, userId);
    if (!scan) {
      res.status(404).json({ error: "NotFound", message: "Scan not found." });
      return;
    }
    if (!authorized) {
      res.status(403).json({ error: "Forbidden", message: "Not authorized to access report for this scan." });
      return;
    }

    const report = await repo.findScanReportByScanId(scanId);
    const pages = await repo.listScannedPages(scanId);
    const findings = await repo.listScanFindings(scanId);

    res.status(200).json({
      success: true,
      data: {
        scan,
        report,
        pages,
        findings
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: "InternalError", message: err.message });
  }
}

export async function exportScanReportHandler(req: Request, res: Response): Promise<void> {
  const { scanId } = req.params;
  const userId = req.user!.id;
  const repo = getRepository();

  try {
    const { authorized, scan } = await verifyScanAccess(scanId, userId);
    if (!scan) {
      res.status(404).json({ error: "NotFound", message: "Scan not found." });
      return;
    }
    if (!authorized) {
      res.status(403).json({ error: "Forbidden", message: "Not authorized to export this scan." });
      return;
    }

    const report = await repo.findScanReportByScanId(scanId);
    const findings = await repo.listScanFindings(scanId);

    const exportPayload = {
      app: "TracePilot AI Website Bug Scanner",
      version: "1.0.0",
      exportedAt: new Date().toISOString(),
      scan,
      report,
      findings
    };

    res.setHeader("Content-Disposition", `attachment; filename="tracepilot-scan-${scanId}.json"`);
    res.setHeader("Content-Type", "application/json");
    res.status(200).send(JSON.stringify(exportPayload, null, 2));
  } catch (err: any) {
    res.status(500).json({ error: "InternalError", message: err.message });
  }
}

export async function getFindingByIdHandler(req: Request, res: Response): Promise<void> {
  const { findingId } = req.params;
  const userId = req.user!.id;
  const repo = getRepository();

  try {
    const finding = await repo.findScanFindingById(findingId);
    if (!finding) {
      res.status(404).json({ error: "NotFound", message: "Finding not found." });
      return;
    }

    const { authorized } = await verifyScanAccess(finding.scanId, userId);
    if (!authorized) {
      res.status(403).json({ error: "Forbidden", message: "Not authorized to access this finding." });
      return;
    }

    res.status(200).json({ success: true, data: finding });
  } catch (err: any) {
    res.status(500).json({ error: "InternalError", message: err.message });
  }
}

/**
 * Seamlessly converts a Website Scan Finding into a native TracePilot Incident Bug ticket.
 */
export async function convertFindingToBugHandler(req: Request, res: Response): Promise<void> {
  const { findingId } = req.params;
  const userId = req.user!.id;
  const repo = getRepository();

  try {
    const finding = await repo.findScanFindingById(findingId);
    if (!finding) {
      res.status(404).json({ error: "NotFound", message: "Finding not found." });
      return;
    }

    const { authorized, scan } = await verifyScanAccess(finding.scanId, userId);
    if (!authorized) {
      res.status(403).json({ error: "Forbidden", message: "Not authorized to convert this finding." });
      return;
    }

    if (finding.incidentId) {
      res.status(200).json({
        success: true,
        data: {
          findingId: finding.id,
          incidentId: finding.incidentId
        },
        message: "Bug already linked to an existing Incident."
      });
      return;
    }

    const projectId = scan?.projectId || "proj_dev_testing";

    // Create TracePilot native Incident
    const incident = await repo.createIncident({
      projectId,
      fingerprint: finding.issueFingerprint,
      eventType: "exception",
      exceptionType: `WebsiteScanner:${finding.category}`,
      message: `[${finding.severity.toUpperCase()}] ${finding.title}: ${finding.description}`,
      stackTrace: finding.evidenceJson?.stackTrace || null,
      environment: "production",
      release: "website-scan",
      runtime: { name: "browser", engine: "chromium", platform: "web" },
      context: {
        source: "WebsiteBugScanner",
        scanId: finding.scanId,
        websiteId: finding.websiteId,
        pageUrl: (finding as any).pageUrl,
        category: finding.category,
        severity: finding.severity,
        evidence: finding.evidenceJson,
        expectedBehavior: finding.expectedBehavior,
        actualBehavior: finding.actualBehavior,
        reproductionSteps: finding.reproductionSteps,
        suggestedFix: finding.suggestedFix
      },
      occurredAt: new Date()
    });

    // Link back to finding
    await repo.updateScanFindingIncident(finding.id, incident.id);

    res.status(201).json({
      success: true,
      data: {
        findingId: finding.id,
        incidentId: incident.id,
        incident
      },
      message: "Successfully converted finding into a TracePilot Incident bug ticket."
    });
  } catch (err: any) {
    console.error("[convertFindingToBugHandler] Error:", err);
    res.status(500).json({ error: "InternalError", message: err.message });
  }
}
