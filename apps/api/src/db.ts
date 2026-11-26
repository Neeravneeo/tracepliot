import { PrismaClient } from "@prisma/client";
import crypto from "crypto";

// Global Prisma client instance
let prismaInstance: PrismaClient | null = null;

export function getPrismaClient(): PrismaClient {
  if (!prismaInstance) {
    prismaInstance = new PrismaClient({
      log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"]
    });
  }
  return prismaInstance;
}

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectRecord {
  id: string;
  name: string;
  ownerId: string | null;
  environments?: string[];
  retentionDays?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectMemberRecord {
  id: string;
  projectId: string;
  userId?: string;
  email: string;
  role: "owner" | "admin" | "member";
  createdAt: Date;
}

export interface SpanRecord {
  id: string;
  traceId: string;
  spanId: string;
  parentSpanId?: string | null;
  projectId: string;
  serviceName: string;
  name: string;
  startTime: Date;
  endTime: Date;
  durationMs: number;
  statusCode: "ok" | "error" | "unset";
  statusMessage?: string | null;
  attributes: Record<string, unknown>;
  events?: Array<{ name: string; timestamp: Date; attributes?: Record<string, unknown> }>;
  createdAt: Date;
}

export interface IngestSpanInput {
  traceId: string;
  spanId: string;
  parentSpanId?: string | null;
  projectId: string;
  serviceName: string;
  name: string;
  startTime: Date;
  endTime: Date;
  durationMs?: number;
  statusCode?: "ok" | "error" | "unset";
  statusMessage?: string | null;
  attributes?: Record<string, unknown>;
  events?: Array<{ name: string; timestamp: Date; attributes?: Record<string, unknown> }>;
}

export interface TraceSummary {
  traceId: string;
  projectId: string;
  rootSpanName: string;
  serviceName: string;
  serviceCount: number;
  spanCount: number;
  durationMs: number;
  hasError: boolean;
  startTime: Date;
}

export interface ApiKeyRecord {
  id: string;
  projectId: string;
  keyHash: string;
  name: string;
  createdAt: Date;
  revokedAt: Date | null;
}

export interface IncidentRecord {
  id: string;
  projectId: string;
  fingerprint: string;
  eventType: string;
  exceptionType: string;
  message: string;
  stackTrace?: string | null;
  environment: string;
  release: string;
  runtime: any;
  context?: any;
  occurredAt: Date;
  status: string;
  occurrences?: number;
  lastSeenAt?: Date;
  eventId?: string | null;
  createdAt: Date;
}

export interface CreateIncidentInput {
  projectId: string;
  fingerprint: string;
  eventType: string;
  exceptionType: string;
  message: string;
  stackTrace?: string;
  environment: string;
  release: string;
  runtime: Record<string, unknown>;
  context?: Record<string, unknown>;
  occurredAt: Date;
  status?: string;
  occurrences?: number;
  lastSeenAt?: Date;
  eventId?: string;
}

export interface WebsiteRecord {
  id: string;
  projectId: string;
  createdBy: string | null;
  domain: string;
  normalizedBaseUrl: string;
  verificationStatus: string;
  verificationMethod: string;
  verificationToken: string;
  verifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface WebsiteScanRecord {
  id: string;
  websiteId: string;
  projectId: string;
  initiatedBy: string | null;
  scanType: string;
  status: string;
  configurationJson: any;
  startedAt: Date | null;
  completedAt: Date | null;
  pagesDiscovered: number;
  pagesScanned: number;
  healthScore: number | null;
  coverageJson: any | null;
  errorSummary: string | null;
  createdAt: Date;
}

export interface ScannedPageRecord {
  id: string;
  scanId: string;
  normalizedUrl: string;
  httpStatus: number | null;
  pageTitle: string | null;
  loadMetricsJson: any | null;
  screenshotRef: string | null;
  scanStatus: string;
  errorMessage: string | null;
  scannedAt: Date;
}

export interface ScanFindingRecord {
  id: string;
  scanId: string;
  websiteId: string;
  pageId: string | null;
  issueFingerprint: string;
  title: string;
  description: string;
  category: string;
  severity: string;
  confidence: string;
  verificationStatus: string;
  expectedBehavior: string | null;
  actualBehavior: string | null;
  reproductionSteps: any | null;
  evidenceJson: any | null;
  suggestedFix: string | null;
  aiAnalysisJson: any | null;
  incidentId: string | null;
  firstSeenAt: Date;
  lastSeenAt: Date;
  createdAt: Date;
}

export interface ScanReportRecord {
  id: string;
  scanId: string;
  summaryJson: any;
  scoreBreakdownJson: any;
  coverageJson: any;
  generatedAt: Date;
  exportStorageKey: string | null;
}

export interface CodeEvidenceRecord {
  id: string;
  projectId: string;
  repo: string;
  commitSha: string;
  filePath: string;
  contentHash: string;
  chunkIndex: number;
  startLine: number;
  endLine: number;
  content: string;
  embeddingModel: string;
  createdAt: Date;
}

export interface IngestionJobRecord {
  id: string;
  projectId: string;
  repo: string;
  commitSha: string;
  status: "pending" | "running" | "completed" | "failed";
  filesProcessed: number;
  chunksCreated: number;
  error?: string | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
  createdAt: Date;
}

export interface AnalysisJobRecord {
  id: string;
  incidentId: string;
  projectId: string;
  status: "pending" | "running" | "completed" | "failed";
  summary?: string | null;
  rootCause?: string | null;
  supportLevel?: string | null;
  alternativeHypotheses?: string[];
  suggestedFix?: string | null;
  validationSteps?: string[];
  patchDiff?: string | null;
  uncertainty?: string | null;
  evidenceRefs?: string[];
  modelVersion?: string | null;
  rankingVersion?: string | null;
  patchValidationStatus?: "Passed" | "Failed" | "Not run" | null;
  isRootCauseConfirmed?: boolean | null;
  manifestId?: string | null;
  error?: string | null;
  feedback?: { helpful: boolean; score?: number; comment?: string; submittedAt: Date } | null;
  createdAt: Date;
  completedAt?: Date | null;
}

export interface ITracePilotRepository {
  // Auth & Users
  findUserByEmail(email: string): Promise<UserRecord | null>;
  findUserById(id: string): Promise<UserRecord | null>;
  createUser(email: string, passwordHash: string): Promise<UserRecord>;
  
  // Projects & SDK Keys
  findProjectByApiKeyHash(hash: string): Promise<ProjectRecord | null>;
  findProjectByIdAndOwner(projectId: string, ownerId: string): Promise<ProjectRecord | null>;
  listProjectsByOwner(ownerId: string): Promise<ProjectRecord[]>;
  createProject(name: string, ownerId: string, id?: string): Promise<ProjectRecord>;
  updateProject(id: string, updates: Partial<ProjectRecord>): Promise<ProjectRecord | null>;
  deleteProject(id: string): Promise<boolean>;
  listProjectMembers(projectId: string): Promise<ProjectMemberRecord[]>;
  addProjectMember(projectId: string, email: string, role?: "owner" | "admin" | "member"): Promise<ProjectMemberRecord>;
  removeProjectMember(projectId: string, memberId: string): Promise<boolean>;
  createApiKey(projectId: string, keyHash: string, name: string): Promise<ApiKeyRecord>;
  revokeApiKey(projectId: string, keyId: string): Promise<boolean>;
  createIncident(data: CreateIncidentInput): Promise<IncidentRecord>;
  findIncidentById(id: string): Promise<IncidentRecord | null>;
  listIncidents(filters?: {
    projectId?: string;
    environment?: string;
    release?: string;
    status?: string;
    service?: string;
    severity?: string;
    search?: string;
    cursor?: string;
    limit?: number;
  }): Promise<IncidentRecord[]>;

  // Distributed Tracing
  ingestSpans(spans: IngestSpanInput[]): Promise<SpanRecord[]>;
  listTraces(filters: { projectId: string; serviceName?: string; status?: string; minDurationMs?: number; limit?: number }): Promise<TraceSummary[]>;
  findTraceSpans(projectId: string, traceId: string): Promise<SpanRecord[]>;

  // Website Bug Scanner
  createWebsite(data: { projectId: string; domain: string; normalizedBaseUrl: string; createdBy?: string }): Promise<WebsiteRecord>;
  findWebsiteById(id: string): Promise<WebsiteRecord | null>;
  findWebsiteByDomain(projectId: string, domain: string): Promise<WebsiteRecord | null>;
  listWebsitesByProject(projectId: string): Promise<WebsiteRecord[]>;
  updateWebsiteVerification(id: string, status: string, verifiedAt?: Date): Promise<WebsiteRecord>;

  createWebsiteScan(data: {
    websiteId: string;
    projectId: string;
    initiatedBy?: string;
    scanType?: string;
    configurationJson: any;
  }): Promise<WebsiteScanRecord>;
  findScanById(id: string): Promise<WebsiteScanRecord | null>;
  listScansByWebsite(websiteId: string): Promise<WebsiteScanRecord[]>;
  listScansByProject(projectId: string): Promise<WebsiteScanRecord[]>;
  updateScanProgress(id: string, progress: { status?: string; pagesDiscovered?: number; pagesScanned?: number; healthScore?: number; coverageJson?: any; errorSummary?: string; startedAt?: Date; completedAt?: Date }): Promise<WebsiteScanRecord>;

  createScannedPage(data: {
    scanId: string;
    normalizedUrl: string;
    httpStatus?: number;
    pageTitle?: string;
    loadMetricsJson?: any;
    screenshotRef?: string;
    scanStatus?: string;
    errorMessage?: string;
  }): Promise<ScannedPageRecord>;
  listScannedPages(scanId: string): Promise<ScannedPageRecord[]>;

  createScanFinding(data: {
    scanId: string;
    websiteId: string;
    pageId?: string;
    issueFingerprint: string;
    title: string;
    description: string;
    category: string;
    severity: string;
    confidence?: string;
    verificationStatus?: string;
    expectedBehavior?: string;
    actualBehavior?: string;
    reproductionSteps?: any;
    evidenceJson?: any;
    suggestedFix?: string;
    aiAnalysisJson?: any;
  }): Promise<ScanFindingRecord>;
  findScanFindingById(id: string): Promise<ScanFindingRecord | null>;
  listScanFindings(scanId: string, filters?: { category?: string; severity?: string; verificationStatus?: string }): Promise<ScanFindingRecord[]>;
  updateScanFindingIncident(findingId: string, incidentId: string): Promise<ScanFindingRecord>;

  createScanReport(data: {
    scanId: string;
    summaryJson: any;
    scoreBreakdownJson: any;
    coverageJson: any;
    exportStorageKey?: string;
  }): Promise<ScanReportRecord>;
  findScanReportByScanId(scanId: string): Promise<ScanReportRecord | null>;

  // Code Ingestion & Evidence
  upsertCodeEvidence(chunks: CodeEvidenceRecord[]): Promise<number>;
  findCodeEvidenceById(id: string): Promise<CodeEvidenceRecord | null>;
  findCodeEvidenceByRevision(projectId: string, commitSha: string): Promise<CodeEvidenceRecord[]>;
  findCodeEvidenceByFile(projectId: string, filePath: string, commitSha?: string): Promise<CodeEvidenceRecord[]>;
  listCodeEvidence(projectId: string): Promise<CodeEvidenceRecord[]>;
  pruneStaleEvidence(projectId: string, commitSha: string, activeFilePaths: string[]): Promise<number>;

  // Ingestion Jobs
  createIngestionJob(data: Omit<IngestionJobRecord, "id" | "createdAt">): Promise<IngestionJobRecord>;
  updateIngestionJob(id: string, updates: Partial<IngestionJobRecord>): Promise<IngestionJobRecord | null>;
  findIngestionJobById(id: string): Promise<IngestionJobRecord | null>;
  listIngestionJobs(projectId: string): Promise<IngestionJobRecord[]>;

  // Analysis Jobs & Feedback
  createAnalysisJob(data: Omit<AnalysisJobRecord, "id" | "createdAt">): Promise<AnalysisJobRecord>;
  updateAnalysisJob(id: string, updates: Partial<AnalysisJobRecord>): Promise<AnalysisJobRecord | null>;
  findAnalysisJobById(id: string): Promise<AnalysisJobRecord | null>;
  listAnalysisJobsByIncident(incidentId: string): Promise<AnalysisJobRecord[]>;
  saveAnalysisFeedback(jobId: string, feedback: { helpful: boolean; score?: number; comment?: string }): Promise<AnalysisJobRecord | null>;
}

export class PrismaTracePilotRepository implements ITracePilotRepository {
  private prisma: PrismaClient;
  private inMemory: InMemoryTracePilotRepository;

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma || getPrismaClient();
    this.inMemory = new InMemoryTracePilotRepository();
  }

  async findUserByEmail(email: string): Promise<UserRecord | null> {
    try {
      return await this.prisma.user.findUnique({ where: { email } });
    } catch {
      return this.inMemory.findUserByEmail(email);
    }
  }

  async findUserById(id: string): Promise<UserRecord | null> {
    try {
      return await this.prisma.user.findUnique({ where: { id } });
    } catch {
      return this.inMemory.findUserById(id);
    }
  }

  async createUser(email: string, passwordHash: string): Promise<UserRecord> {
    try {
      return await this.prisma.user.create({
        data: { email, passwordHash }
      });
    } catch {
      return this.inMemory.createUser(email, passwordHash);
    }
  }

  async findProjectByApiKeyHash(hash: string): Promise<ProjectRecord | null> {
    try {
      const apiKey = await this.prisma.apiKey.findUnique({
        where: { keyHash: hash },
        include: { project: true }
      });
      if (apiKey && !apiKey.revokedAt) {
        return apiKey.project;
      }
      return null;
    } catch {
      return this.inMemory.findProjectByApiKeyHash(hash);
    }
  }

  async findProjectByIdAndOwner(projectId: string, ownerId: string): Promise<ProjectRecord | null> {
    try {
      return await this.prisma.project.findFirst({
        where: { id: projectId, ownerId }
      });
    } catch {
      return this.inMemory.findProjectByIdAndOwner(projectId, ownerId);
    }
  }

  async listProjectsByOwner(ownerId: string): Promise<ProjectRecord[]> {
    try {
      return await this.prisma.project.findMany({
        where: { ownerId },
        orderBy: { createdAt: "desc" }
      });
    } catch {
      return this.inMemory.listProjectsByOwner(ownerId);
    }
  }

  async createProject(name: string, ownerId: string, id?: string): Promise<ProjectRecord> {
    try {
      return await this.prisma.project.create({
        data: {
          id,
          name,
          ownerId
        }
      });
    } catch {
      return this.inMemory.createProject(name, ownerId, id);
    }
  }

  async createApiKey(projectId: string, keyHash: string, name: string): Promise<ApiKeyRecord> {
    try {
      return await this.prisma.apiKey.create({
        data: { projectId, keyHash, name }
      });
    } catch {
      return this.inMemory.createApiKey(projectId, keyHash, name);
    }
  }

  async revokeApiKey(projectId: string, keyId: string): Promise<boolean> {
    try {
      const res = await this.prisma.apiKey.updateMany({
        where: { id: keyId, projectId, revokedAt: null },
        data: { revokedAt: new Date() }
      });
      return res.count > 0;
    } catch {
      return this.inMemory.revokeApiKey(projectId, keyId);
    }
  }

  async updateProject(id: string, updates: Partial<ProjectRecord>): Promise<ProjectRecord | null> {
    return this.inMemory.updateProject(id, updates);
  }

  async deleteProject(id: string): Promise<boolean> {
    return this.inMemory.deleteProject(id);
  }

  async listProjectMembers(projectId: string): Promise<ProjectMemberRecord[]> {
    return this.inMemory.listProjectMembers(projectId);
  }

  async addProjectMember(projectId: string, email: string, role: "owner" | "admin" | "member" = "member"): Promise<ProjectMemberRecord> {
    return this.inMemory.addProjectMember(projectId, email, role);
  }

  async removeProjectMember(projectId: string, memberId: string): Promise<boolean> {
    return this.inMemory.removeProjectMember(projectId, memberId);
  }

  async ingestSpans(spans: IngestSpanInput[]): Promise<SpanRecord[]> {
    return this.inMemory.ingestSpans(spans);
  }

  async listTraces(filters: any): Promise<TraceSummary[]> {
    return this.inMemory.listTraces(filters);
  }

  async findTraceSpans(projectId: string, traceId: string): Promise<SpanRecord[]> {
    return this.inMemory.findTraceSpans(projectId, traceId);
  }

  async createIncident(data: CreateIncidentInput): Promise<IncidentRecord> {
    try {
      return await this.prisma.incident.create({
        data: {
          projectId: data.projectId,
          fingerprint: data.fingerprint,
          eventType: data.eventType,
          exceptionType: data.exceptionType,
          message: data.message,
          stackTrace: data.stackTrace,
          environment: data.environment,
          release: data.release,
          runtime: data.runtime as any,
          context: data.context as any,
          occurredAt: data.occurredAt,
          status: data.status || "unresolved"
        }
      });
    } catch {
      return this.inMemory.createIncident(data);
    }
  }

  async findIncidentById(id: string): Promise<IncidentRecord | null> {
    try {
      return await this.prisma.incident.findUnique({
        where: { id }
      });
    } catch {
      return this.inMemory.findIncidentById(id);
    }
  }

  async listIncidents(filters?: {
    projectId?: string;
    environment?: string;
    release?: string;
    status?: string;
    limit?: number;
  }): Promise<IncidentRecord[]> {
    try {
      return await this.prisma.incident.findMany({
        where: {
          projectId: filters?.projectId,
          environment: filters?.environment,
          release: filters?.release,
          status: filters?.status
        },
        orderBy: { occurredAt: "desc" },
        take: filters?.limit ?? 50
      });
    } catch {
      return this.inMemory.listIncidents(filters);
    }
  }

  // --- Website Bug Scanner methods ---
  async createWebsite(data: { projectId: string; domain: string; normalizedBaseUrl: string; createdBy?: string }): Promise<WebsiteRecord> {
    try {
      const token = `tp_verify_${crypto.randomBytes(16).toString("hex")}`;
      return await (this.prisma as any).website.create({
        data: {
          projectId: data.projectId,
          domain: data.domain,
          normalizedBaseUrl: data.normalizedBaseUrl,
          createdBy: data.createdBy,
          verificationToken: token,
          verificationStatus: "pending",
          verificationMethod: "token"
        }
      });
    } catch {
      return this.inMemory.createWebsite(data);
    }
  }

  async findWebsiteById(id: string): Promise<WebsiteRecord | null> {
    try {
      return await (this.prisma as any).website.findUnique({ where: { id } });
    } catch {
      return this.inMemory.findWebsiteById(id);
    }
  }

  async findWebsiteByDomain(projectId: string, domain: string): Promise<WebsiteRecord | null> {
    try {
      return await (this.prisma as any).website.findFirst({ where: { projectId, domain } });
    } catch {
      return this.inMemory.findWebsiteByDomain(projectId, domain);
    }
  }

  async listWebsitesByProject(projectId: string): Promise<WebsiteRecord[]> {
    try {
      return await (this.prisma as any).website.findMany({ where: { projectId }, orderBy: { createdAt: "desc" } });
    } catch {
      return this.inMemory.listWebsitesByProject(projectId);
    }
  }

  async updateWebsiteVerification(id: string, status: string, verifiedAt?: Date): Promise<WebsiteRecord> {
    try {
      return await (this.prisma as any).website.update({
        where: { id },
        data: { verificationStatus: status, verifiedAt: verifiedAt || (status === "verified" ? new Date() : null) }
      });
    } catch {
      return this.inMemory.updateWebsiteVerification(id, status, verifiedAt);
    }
  }

  async createWebsiteScan(data: {
    websiteId: string;
    projectId: string;
    initiatedBy?: string;
    scanType?: string;
    configurationJson: any;
  }): Promise<WebsiteScanRecord> {
    try {
      return await (this.prisma as any).websiteScan.create({
        data: {
          websiteId: data.websiteId,
          projectId: data.projectId,
          initiatedBy: data.initiatedBy,
          scanType: data.scanType || "quick",
          status: "pending",
          configurationJson: data.configurationJson,
          pagesDiscovered: 0,
          pagesScanned: 0
        }
      });
    } catch {
      return this.inMemory.createWebsiteScan(data);
    }
  }

  async findScanById(id: string): Promise<WebsiteScanRecord | null> {
    try {
      return await (this.prisma as any).websiteScan.findUnique({ where: { id } });
    } catch {
      return this.inMemory.findScanById(id);
    }
  }

  async listScansByWebsite(websiteId: string): Promise<WebsiteScanRecord[]> {
    try {
      return await (this.prisma as any).websiteScan.findMany({ where: { websiteId }, orderBy: { createdAt: "desc" } });
    } catch {
      return this.inMemory.listScansByWebsite(websiteId);
    }
  }

  async listScansByProject(projectId: string): Promise<WebsiteScanRecord[]> {
    try {
      return await (this.prisma as any).websiteScan.findMany({ where: { projectId }, orderBy: { createdAt: "desc" } });
    } catch {
      return this.inMemory.listScansByProject(projectId);
    }
  }

  async updateScanProgress(id: string, progress: { status?: string; pagesDiscovered?: number; pagesScanned?: number; healthScore?: number; coverageJson?: any; errorSummary?: string; startedAt?: Date; completedAt?: Date }): Promise<WebsiteScanRecord> {
    try {
      return await (this.prisma as any).websiteScan.update({
        where: { id },
        data: progress
      });
    } catch {
      return this.inMemory.updateScanProgress(id, progress);
    }
  }

  async createScannedPage(data: {
    scanId: string;
    normalizedUrl: string;
    httpStatus?: number;
    pageTitle?: string;
    loadMetricsJson?: any;
    screenshotRef?: string;
    scanStatus?: string;
    errorMessage?: string;
  }): Promise<ScannedPageRecord> {
    try {
      return await (this.prisma as any).scannedPage.create({ data });
    } catch {
      return this.inMemory.createScannedPage(data);
    }
  }

  async listScannedPages(scanId: string): Promise<ScannedPageRecord[]> {
    try {
      return await (this.prisma as any).scannedPage.findMany({ where: { scanId }, orderBy: { scannedAt: "asc" } });
    } catch {
      return this.inMemory.listScannedPages(scanId);
    }
  }

  async createScanFinding(data: {
    scanId: string;
    websiteId: string;
    pageId?: string;
    issueFingerprint: string;
    title: string;
    description: string;
    category: string;
    severity: string;
    confidence?: string;
    verificationStatus?: string;
    expectedBehavior?: string;
    actualBehavior?: string;
    reproductionSteps?: any;
    evidenceJson?: any;
    suggestedFix?: string;
    aiAnalysisJson?: any;
  }): Promise<ScanFindingRecord> {
    try {
      return await (this.prisma as any).scanFinding.create({ data });
    } catch {
      return this.inMemory.createScanFinding(data);
    }
  }

  async findScanFindingById(id: string): Promise<ScanFindingRecord | null> {
    try {
      return await (this.prisma as any).scanFinding.findUnique({ where: { id } });
    } catch {
      return this.inMemory.findScanFindingById(id);
    }
  }

  async listScanFindings(scanId: string, filters?: { category?: string; severity?: string; verificationStatus?: string }): Promise<ScanFindingRecord[]> {
    try {
      return await (this.prisma as any).scanFinding.findMany({
        where: {
          scanId,
          category: filters?.category,
          severity: filters?.severity,
          verificationStatus: filters?.verificationStatus
        },
        orderBy: { createdAt: "desc" }
      });
    } catch {
      return this.inMemory.listScanFindings(scanId, filters);
    }
  }

  async updateScanFindingIncident(findingId: string, incidentId: string): Promise<ScanFindingRecord> {
    try {
      return await (this.prisma as any).scanFinding.update({
        where: { id: findingId },
        data: { incidentId }
      });
    } catch {
      return this.inMemory.updateScanFindingIncident(findingId, incidentId);
    }
  }

  async createScanReport(data: {
    scanId: string;
    summaryJson: any;
    scoreBreakdownJson: any;
    coverageJson: any;
    exportStorageKey?: string;
  }): Promise<ScanReportRecord> {
    try {
      return await (this.prisma as any).scanReport.create({ data });
    } catch {
      return this.inMemory.createScanReport(data);
    }
  }

  async findScanReportByScanId(scanId: string): Promise<ScanReportRecord | null> {
    try {
      return await (this.prisma as any).scanReport.findUnique({ where: { scanId } });
    } catch {
      return this.inMemory.findScanReportByScanId(scanId);
    }
  }

  // Code Evidence Delegation
  async upsertCodeEvidence(chunks: CodeEvidenceRecord[]): Promise<number> {
    return this.inMemory.upsertCodeEvidence(chunks);
  }
  async findCodeEvidenceById(id: string): Promise<CodeEvidenceRecord | null> {
    return this.inMemory.findCodeEvidenceById(id);
  }
  async findCodeEvidenceByRevision(projectId: string, commitSha: string): Promise<CodeEvidenceRecord[]> {
    return this.inMemory.findCodeEvidenceByRevision(projectId, commitSha);
  }
  async findCodeEvidenceByFile(projectId: string, filePath: string, commitSha?: string): Promise<CodeEvidenceRecord[]> {
    return this.inMemory.findCodeEvidenceByFile(projectId, filePath, commitSha);
  }
  async listCodeEvidence(projectId: string): Promise<CodeEvidenceRecord[]> {
    return this.inMemory.listCodeEvidence(projectId);
  }
  async pruneStaleEvidence(projectId: string, commitSha: string, activeFilePaths: string[]): Promise<number> {
    return this.inMemory.pruneStaleEvidence(projectId, commitSha, activeFilePaths);
  }

  // Ingestion Jobs Delegation
  async createIngestionJob(data: Omit<IngestionJobRecord, "id" | "createdAt">): Promise<IngestionJobRecord> {
    return this.inMemory.createIngestionJob(data);
  }
  async updateIngestionJob(id: string, updates: Partial<IngestionJobRecord>): Promise<IngestionJobRecord | null> {
    return this.inMemory.updateIngestionJob(id, updates);
  }
  async findIngestionJobById(id: string): Promise<IngestionJobRecord | null> {
    return this.inMemory.findIngestionJobById(id);
  }
  async listIngestionJobs(projectId: string): Promise<IngestionJobRecord[]> {
    return this.inMemory.listIngestionJobs(projectId);
  }

  // Analysis Jobs & Feedback Delegation
  async createAnalysisJob(data: Omit<AnalysisJobRecord, "id" | "createdAt">): Promise<AnalysisJobRecord> {
    return this.inMemory.createAnalysisJob(data);
  }
  async updateAnalysisJob(id: string, updates: Partial<AnalysisJobRecord>): Promise<AnalysisJobRecord | null> {
    return this.inMemory.updateAnalysisJob(id, updates);
  }
  async findAnalysisJobById(id: string): Promise<AnalysisJobRecord | null> {
    return this.inMemory.findAnalysisJobById(id);
  }
  async listAnalysisJobsByIncident(incidentId: string): Promise<AnalysisJobRecord[]> {
    return this.inMemory.listAnalysisJobsByIncident(incidentId);
  }
  async saveAnalysisFeedback(jobId: string, feedback: { helpful: boolean; score?: number; comment?: string }): Promise<AnalysisJobRecord | null> {
    return this.inMemory.saveAnalysisFeedback(jobId, feedback);
  }
}

/**
 * In-memory fallback repository for isolated unit/integration tests without external DB dependencies.
 */
export class InMemoryTracePilotRepository implements ITracePilotRepository {
  public users: UserRecord[] = [];
  public projects: ProjectRecord[] = [];
  public incidents: IncidentRecord[] = [];
  public apiKeys: ApiKeyRecord[] = [];
  public websites: WebsiteRecord[] = [];
  public scans: WebsiteScanRecord[] = [];
  public pages: ScannedPageRecord[] = [];
  public findings: ScanFindingRecord[] = [];
  public reports: ScanReportRecord[] = [];
  public codeEvidence: CodeEvidenceRecord[] = [];
  public ingestionJobs: IngestionJobRecord[] = [];
  public analysisJobs: AnalysisJobRecord[] = [];
  public spans: SpanRecord[] = [];
  public projectMembers: ProjectMemberRecord[] = [];

  constructor() {
    const devUser: UserRecord = {
      id: "usr_dev_testing",
      email: "developer@tracepilot.dev",
      passwordHash: "dev_pw_hash",
      createdAt: new Date(),
      updatedAt: new Date()
    };
    const devProj: ProjectRecord = {
      id: "proj_dev_testing",
      name: "TracePilot Demo Project",
      ownerId: "usr_dev_testing",
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.users.push(devUser);
    this.projects.push(devProj);

    const defaultKey = process.env.TRACEPILOT_API_KEY || "tp_dev_secret_key_demo123456789";
    const defaultKeyHash = crypto.createHash("sha256").update(defaultKey.trim()).digest("hex");
    this.apiKeys.push({
      id: "key_default_demo",
      projectId: "proj_dev_testing",
      keyHash: defaultKeyHash,
      name: "Default Demo Key",
      createdAt: new Date(),
      revokedAt: null
    });
  }

  async findUserByEmail(email: string): Promise<UserRecord | null> {
    return this.users.find(u => u.email === email) || null;
  }

  async findUserById(id: string): Promise<UserRecord | null> {
    return this.users.find(u => u.id === id) || null;
  }

  async createUser(email: string, passwordHash: string): Promise<UserRecord> {
    const user: UserRecord = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      email,
      passwordHash,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.users.push(user);
    return user;
  }

  async findProjectByApiKeyHash(hash: string): Promise<ProjectRecord | null> {
    const key = this.apiKeys.find(k => k.keyHash === hash && !k.revokedAt);
    if (key) {
      return this.projects.find(p => p.id === key.projectId) || null;
    }
    return null;
  }

  async findProjectByIdAndOwner(projectId: string, ownerId: string): Promise<ProjectRecord | null> {
    return this.projects.find(p => p.id === projectId && p.ownerId === ownerId) || null;
  }

  async listProjectsByOwner(ownerId: string): Promise<ProjectRecord[]> {
    return this.projects.filter(p => p.ownerId === ownerId);
  }

  async createProject(name: string, ownerId: string, id?: string): Promise<ProjectRecord> {
    const project: ProjectRecord = {
      id: id || `proj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name,
      ownerId,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.projects.push(project);
    return project;
  }

  async createApiKey(projectId: string, keyHash: string, name: string): Promise<ApiKeyRecord> {
    const key: ApiKeyRecord = {
      id: `key_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      projectId,
      keyHash,
      name,
      createdAt: new Date(),
      revokedAt: null
    };
    this.apiKeys.push(key);
    return key;
  }

  async revokeApiKey(projectId: string, keyId: string): Promise<boolean> {
    const key = this.apiKeys.find((k) => k.id === keyId && k.projectId === projectId && !k.revokedAt);
    if (key) {
      key.revokedAt = new Date();
      return true;
    }
    return false;
  }

  async updateProject(id: string, updates: Partial<ProjectRecord>): Promise<ProjectRecord | null> {
    const project = this.projects.find((p) => p.id === id);
    if (!project) return null;
    if (updates.name !== undefined) project.name = updates.name;
    if (updates.environments !== undefined) project.environments = updates.environments;
    if (updates.retentionDays !== undefined) project.retentionDays = updates.retentionDays;
    project.updatedAt = new Date();
    return project;
  }

  async deleteProject(id: string): Promise<boolean> {
    const idx = this.projects.findIndex((p) => p.id === id);
    if (idx === -1) return false;
    this.projects.splice(idx, 1);
    this.incidents = this.incidents.filter((i) => i.projectId !== id);
    this.spans = this.spans.filter((s) => s.projectId !== id);
    this.apiKeys = this.apiKeys.filter((k) => k.projectId !== id);
    this.projectMembers = this.projectMembers.filter((m) => m.projectId !== id);
    return true;
  }

  async listProjectMembers(projectId: string): Promise<ProjectMemberRecord[]> {
    return this.projectMembers.filter((m) => m.projectId === projectId);
  }

  async addProjectMember(projectId: string, email: string, role: "owner" | "admin" | "member" = "member"): Promise<ProjectMemberRecord> {
    const existing = this.projectMembers.find((m) => m.projectId === projectId && m.email === email);
    if (existing) {
      existing.role = role;
      return existing;
    }
    const member: ProjectMemberRecord = {
      id: `mem_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      projectId,
      email,
      role,
      createdAt: new Date()
    };
    this.projectMembers.push(member);
    return member;
  }

  async removeProjectMember(projectId: string, memberId: string): Promise<boolean> {
    const index = this.projectMembers.findIndex((m) => m.projectId === projectId && m.id === memberId);
    if (index === -1) return false;
    const member = this.projectMembers[index];
    if (member.role === "owner") {
      const ownerCount = this.projectMembers.filter((m) => m.projectId === projectId && m.role === "owner").length;
      if (ownerCount <= 1) {
        throw new Error("Cannot remove the last owner of the project.");
      }
    }
    this.projectMembers.splice(index, 1);
    return true;
  }

  async createIncident(data: CreateIncidentInput): Promise<IncidentRecord> {
    // P3-B01: Incident Grouping & Deduplication
    const existing = this.incidents.find(
      (i) =>
        i.projectId === data.projectId &&
        (i.fingerprint === data.fingerprint || (data.eventId && i.eventId === data.eventId))
    );
    if (existing) {
      existing.occurrences = (existing.occurrences || 1) + (data.occurrences || 1);
      existing.lastSeenAt = data.occurredAt || new Date();
      return existing;
    }

    const incident: IncidentRecord = {
      id: `inc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      projectId: data.projectId,
      fingerprint: data.fingerprint,
      eventType: data.eventType,
      exceptionType: data.exceptionType,
      message: data.message,
      stackTrace: data.stackTrace || null,
      environment: data.environment,
      release: data.release,
      runtime: data.runtime,
      context: data.context || null,
      occurredAt: data.occurredAt,
      status: data.status || "unresolved",
      occurrences: data.occurrences || 1,
      lastSeenAt: data.occurredAt,
      eventId: data.eventId || null,
      createdAt: new Date()
    };
    this.incidents.push(incident);
    return incident;
  }

  async findIncidentById(id: string): Promise<IncidentRecord | null> {
    return this.incidents.find((i) => i.id === id) || null;
  }

  async listIncidents(filters?: {
    projectId?: string;
    environment?: string;
    release?: string;
    status?: string;
    search?: string;
    cursor?: string;
    limit?: number;
  }): Promise<IncidentRecord[]> {
    let results = [...this.incidents];
    if (filters?.projectId) results = results.filter((i) => i.projectId === filters.projectId);
    if (filters?.environment) results = results.filter((i) => i.environment === filters.environment);
    if (filters?.release) results = results.filter((i) => i.release === filters.release);
    if (filters?.status) results = results.filter((i) => i.status === filters.status);
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      results = results.filter(
        (i) =>
          i.message.toLowerCase().includes(q) ||
          i.exceptionType.toLowerCase().includes(q) ||
          (i.stackTrace && i.stackTrace.toLowerCase().includes(q))
      );
    }
    results.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
    if (filters?.cursor) {
      const cursorIndex = results.findIndex((i) => i.id === filters.cursor);
      if (cursorIndex >= 0) {
        results = results.slice(cursorIndex + 1);
      }
    }
    return results.slice(0, filters?.limit ?? 50);
  }

  // --- P3-C01 - P3-C03: Distributed Tracing in-memory methods ---
  async ingestSpans(spansInput: IngestSpanInput[]): Promise<SpanRecord[]> {
    const created: SpanRecord[] = [];
    for (const s of spansInput) {
      // Deduplicate by (projectId, traceId, spanId)
      const existing = this.spans.find(
        (sp) => sp.projectId === s.projectId && sp.traceId === s.traceId && sp.spanId === s.spanId
      );
      if (existing) {
        created.push(existing);
        continue;
      }

      const durationMs = s.durationMs !== undefined
        ? s.durationMs
        : Math.max(0, s.endTime.getTime() - s.startTime.getTime());

      const span: SpanRecord = {
        id: `span_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        traceId: s.traceId,
        spanId: s.spanId,
        parentSpanId: s.parentSpanId || null,
        projectId: s.projectId,
        serviceName: s.serviceName,
        name: s.name,
        startTime: s.startTime,
        endTime: s.endTime,
        durationMs,
        statusCode: s.statusCode || "ok",
        statusMessage: s.statusMessage || null,
        attributes: s.attributes || {},
        events: s.events || [],
        createdAt: new Date()
      };
      this.spans.push(span);
      created.push(span);
    }
    return created;
  }

  async listTraces(filters: {
    projectId: string;
    serviceName?: string;
    status?: string;
    minDurationMs?: number;
    limit?: number;
  }): Promise<TraceSummary[]> {
    const projectSpans = this.spans.filter((s) => s.projectId === filters.projectId);
    const traceMap = new Map<string, SpanRecord[]>();
    for (const span of projectSpans) {
      if (!traceMap.has(span.traceId)) {
        traceMap.set(span.traceId, []);
      }
      traceMap.get(span.traceId)!.push(span);
    }

    const summaries: TraceSummary[] = [];
    for (const [traceId, spans] of traceMap.entries()) {
      spans.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
      const rootSpan = spans.find((s) => !s.parentSpanId) || spans[0];
      const services = new Set(spans.map((s) => s.serviceName));
      const hasError = spans.some((s) => s.statusCode === "error");
      const startTime = spans[0].startTime;
      const latestEndTime = new Date(Math.max(...spans.map((s) => s.endTime.getTime())));
      const durationMs = Math.max(0, latestEndTime.getTime() - startTime.getTime());

      if (filters.serviceName && !services.has(filters.serviceName)) continue;
      if (filters.status === "error" && !hasError) continue;
      if (filters.status === "ok" && hasError) continue;
      if (filters.minDurationMs && durationMs < filters.minDurationMs) continue;

      summaries.push({
        traceId,
        projectId: filters.projectId,
        rootSpanName: rootSpan.name,
        serviceName: rootSpan.serviceName,
        serviceCount: services.size,
        spanCount: spans.length,
        durationMs,
        hasError,
        startTime
      });
    }

    summaries.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
    return summaries.slice(0, filters.limit ?? 50);
  }

  async findTraceSpans(projectId: string, traceId: string): Promise<SpanRecord[]> {
    return this.spans
      .filter((s) => s.projectId === projectId && s.traceId === traceId)
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  }

  // --- Website Bug Scanner in-memory methods ---
  async createWebsite(data: { projectId: string; domain: string; normalizedBaseUrl: string; createdBy?: string }): Promise<WebsiteRecord> {
    const website: WebsiteRecord = {
      id: `web_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      projectId: data.projectId,
      domain: data.domain,
      normalizedBaseUrl: data.normalizedBaseUrl,
      verificationToken: `tp_verify_${crypto.randomBytes(16).toString("hex")}`,
      verificationStatus: process.env.PAUSE_AUTH === "true" ? "verified" : "pending",
      verificationMethod: "http_token",
      verifiedAt: process.env.PAUSE_AUTH === "true" ? new Date() : null,
      createdBy: data.createdBy || null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.websites.push(website);
    return website;
  }

  async findWebsiteById(id: string): Promise<WebsiteRecord | null> {
    return this.websites.find((w) => w.id === id) || null;
  }

  async findWebsiteByDomain(projectId: string, domain: string): Promise<WebsiteRecord | null> {
    return this.websites.find((w) => w.projectId === projectId && w.domain === domain) || null;
  }

  async listWebsitesByProject(projectId: string): Promise<WebsiteRecord[]> {
    return this.websites.filter((w) => w.projectId === projectId).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async updateWebsiteVerification(id: string, status: string, verifiedAt?: Date): Promise<WebsiteRecord> {
    const website = this.websites.find((w) => w.id === id);
    if (!website) throw new Error(`Website not found: ${id}`);
    website.verificationStatus = status;
    website.verifiedAt = verifiedAt || (status === "verified" ? new Date() : null);
    website.updatedAt = new Date();
    return website;
  }

  async createWebsiteScan(data: {
    websiteId: string;
    projectId: string;
    initiatedBy?: string;
    scanType?: string;
    configurationJson: any;
  }): Promise<WebsiteScanRecord> {
    const scan: WebsiteScanRecord = {
      id: `scan_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      websiteId: data.websiteId,
      projectId: data.projectId,
      initiatedBy: data.initiatedBy || null,
      scanType: data.scanType || "quick",
      status: "pending",
      configurationJson: data.configurationJson,
      pagesDiscovered: 0,
      pagesScanned: 0,
      healthScore: null,
      coverageJson: null,
      errorSummary: null,
      startedAt: null,
      completedAt: null,
      createdAt: new Date()
    };
    this.scans.push(scan);
    return scan;
  }

  async findScanById(id: string): Promise<WebsiteScanRecord | null> {
    return this.scans.find((s) => s.id === id) || null;
  }

  async listScansByWebsite(websiteId: string): Promise<WebsiteScanRecord[]> {
    return this.scans.filter((s) => s.websiteId === websiteId).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async listScansByProject(projectId: string): Promise<WebsiteScanRecord[]> {
    return this.scans.filter((s) => s.projectId === projectId).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async updateScanProgress(id: string, progress: {
    status?: string;
    pagesDiscovered?: number;
    pagesScanned?: number;
    healthScore?: number;
    coverageJson?: any;
    errorSummary?: string;
    startedAt?: Date;
    completedAt?: Date;
  }): Promise<WebsiteScanRecord> {
    const scan = this.scans.find((s) => s.id === id);
    if (!scan) throw new Error(`Scan not found: ${id}`);
    if (progress.status !== undefined) scan.status = progress.status;
    if (progress.pagesDiscovered !== undefined) scan.pagesDiscovered = progress.pagesDiscovered;
    if (progress.pagesScanned !== undefined) scan.pagesScanned = progress.pagesScanned;
    if (progress.healthScore !== undefined) scan.healthScore = progress.healthScore;
    if (progress.coverageJson !== undefined) scan.coverageJson = progress.coverageJson;
    if (progress.errorSummary !== undefined) scan.errorSummary = progress.errorSummary;
    if (progress.startedAt !== undefined) scan.startedAt = progress.startedAt;
    if (progress.completedAt !== undefined) scan.completedAt = progress.completedAt;
    return scan;
  }

  async createScannedPage(data: {
    scanId: string;
    normalizedUrl: string;
    httpStatus?: number;
    pageTitle?: string;
    loadMetricsJson?: any;
    screenshotRef?: string;
    scanStatus?: string;
    errorMessage?: string;
  }): Promise<ScannedPageRecord> {
    const page: ScannedPageRecord = {
      id: `page_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      scanId: data.scanId,
      normalizedUrl: data.normalizedUrl,
      httpStatus: data.httpStatus ?? 200,
      pageTitle: data.pageTitle || null,
      loadMetricsJson: data.loadMetricsJson || null,
      screenshotRef: data.screenshotRef || null,
      scanStatus: data.scanStatus || "completed",
      errorMessage: data.errorMessage || null,
      scannedAt: new Date()
    };
    this.pages.push(page);
    return page;
  }

  async listScannedPages(scanId: string): Promise<ScannedPageRecord[]> {
    return this.pages.filter((p) => p.scanId === scanId).sort((a, b) => a.scannedAt.getTime() - b.scannedAt.getTime());
  }

  async createScanFinding(data: {
    scanId: string;
    websiteId: string;
    pageId?: string;
    issueFingerprint: string;
    title: string;
    description: string;
    category: string;
    severity: string;
    confidence?: string;
    verificationStatus?: string;
    expectedBehavior?: string;
    actualBehavior?: string;
    reproductionSteps?: any;
    evidenceJson?: any;
    suggestedFix?: string;
    aiAnalysisJson?: any;
  }): Promise<ScanFindingRecord> {
    const finding: ScanFindingRecord = {
      id: `fnd_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      scanId: data.scanId,
      websiteId: data.websiteId,
      pageId: data.pageId || null,
      issueFingerprint: data.issueFingerprint,
      title: data.title,
      description: data.description,
      category: data.category,
      severity: data.severity,
      confidence: data.confidence || "high",
      verificationStatus: data.verificationStatus || "verified",
      expectedBehavior: data.expectedBehavior || null,
      actualBehavior: data.actualBehavior || null,
      reproductionSteps: data.reproductionSteps || null,
      evidenceJson: data.evidenceJson || null,
      suggestedFix: data.suggestedFix || null,
      aiAnalysisJson: data.aiAnalysisJson || null,
      incidentId: null,
      firstSeenAt: new Date(),
      lastSeenAt: new Date(),
      createdAt: new Date()
    };
    this.findings.push(finding);
    return finding;
  }

  async findScanFindingById(id: string): Promise<ScanFindingRecord | null> {
    return this.findings.find((f) => f.id === id) || null;
  }

  async listScanFindings(scanId: string, filters?: { category?: string; severity?: string; verificationStatus?: string }): Promise<ScanFindingRecord[]> {
    let results = this.findings.filter((f) => f.scanId === scanId);
    if (filters?.category) results = results.filter((f) => f.category === filters.category);
    if (filters?.severity) results = results.filter((f) => f.severity === filters.severity);
    if (filters?.verificationStatus) results = results.filter((f) => f.verificationStatus === filters.verificationStatus);
    results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return results;
  }

  async updateScanFindingIncident(findingId: string, incidentId: string): Promise<ScanFindingRecord> {
    const finding = this.findings.find((f) => f.id === findingId);
    if (!finding) throw new Error(`Finding not found: ${findingId}`);
    finding.incidentId = incidentId;
    return finding;
  }

  async createScanReport(data: {
    scanId: string;
    summaryJson: any;
    scoreBreakdownJson: any;
    coverageJson: any;
    exportStorageKey?: string;
  }): Promise<ScanReportRecord> {
    const report: ScanReportRecord = {
      id: `rep_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      scanId: data.scanId,
      summaryJson: data.summaryJson,
      scoreBreakdownJson: data.scoreBreakdownJson,
      coverageJson: data.coverageJson,
      exportStorageKey: data.exportStorageKey || null,
      generatedAt: new Date()
    };
    this.reports.push(report);
    return report;
  }

  async findScanReportByScanId(scanId: string): Promise<ScanReportRecord | null> {
    return this.reports.find((r) => r.scanId === scanId) || null;
  }

  // Code Evidence implementation
  async upsertCodeEvidence(chunks: CodeEvidenceRecord[]): Promise<number> {
    let count = 0;
    for (const chunk of chunks) {
      const idx = this.codeEvidence.findIndex(c => c.id === chunk.id);
      if (idx >= 0) {
        this.codeEvidence[idx] = chunk;
      } else {
        this.codeEvidence.push(chunk);
      }
      count++;
    }
    return count;
  }

  async findCodeEvidenceById(id: string): Promise<CodeEvidenceRecord | null> {
    return this.codeEvidence.find(c => c.id === id) || null;
  }

  async findCodeEvidenceByRevision(projectId: string, commitSha: string): Promise<CodeEvidenceRecord[]> {
    return this.codeEvidence.filter(c => c.projectId === projectId && c.commitSha === commitSha);
  }

  async findCodeEvidenceByFile(projectId: string, filePath: string, commitSha?: string): Promise<CodeEvidenceRecord[]> {
    return this.codeEvidence.filter(c => {
      if (c.projectId !== projectId) return false;
      if (c.filePath !== filePath) return false;
      if (commitSha && c.commitSha !== commitSha) return false;
      return true;
    });
  }

  async listCodeEvidence(projectId: string): Promise<CodeEvidenceRecord[]> {
    return this.codeEvidence.filter(c => c.projectId === projectId);
  }

  async pruneStaleEvidence(projectId: string, commitSha: string, activeFilePaths: string[]): Promise<number> {
    const initialCount = this.codeEvidence.length;
    const activeSet = new Set(activeFilePaths);
    this.codeEvidence = this.codeEvidence.filter(c => {
      if (c.projectId === projectId && c.commitSha === commitSha) {
        return activeSet.has(c.filePath);
      }
      return true;
    });
    return initialCount - this.codeEvidence.length;
  }

  // Ingestion Jobs implementation
  async createIngestionJob(data: Omit<IngestionJobRecord, "id" | "createdAt">): Promise<IngestionJobRecord> {
    const job: IngestionJobRecord = {
      ...data,
      id: `ingest_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date()
    };
    this.ingestionJobs.push(job);
    return job;
  }

  async updateIngestionJob(id: string, updates: Partial<IngestionJobRecord>): Promise<IngestionJobRecord | null> {
    const job = this.ingestionJobs.find(j => j.id === id);
    if (!job) return null;
    Object.assign(job, updates);
    return job;
  }

  async findIngestionJobById(id: string): Promise<IngestionJobRecord | null> {
    return this.ingestionJobs.find(j => j.id === id) || null;
  }

  async listIngestionJobs(projectId: string): Promise<IngestionJobRecord[]> {
    return this.ingestionJobs.filter(j => j.projectId === projectId);
  }

  // Analysis Jobs & Feedback implementation
  async createAnalysisJob(data: Omit<AnalysisJobRecord, "id" | "createdAt">): Promise<AnalysisJobRecord> {
    const job: AnalysisJobRecord = {
      ...data,
      id: `analysis_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date()
    };
    this.analysisJobs.push(job);
    return job;
  }

  async updateAnalysisJob(id: string, updates: Partial<AnalysisJobRecord>): Promise<AnalysisJobRecord | null> {
    const job = this.analysisJobs.find(j => j.id === id);
    if (!job) return null;
    Object.assign(job, updates);
    return job;
  }

  async findAnalysisJobById(id: string): Promise<AnalysisJobRecord | null> {
    return this.analysisJobs.find(j => j.id === id) || null;
  }

  async listAnalysisJobsByIncident(incidentId: string): Promise<AnalysisJobRecord[]> {
    return this.analysisJobs
      .filter(j => j.incidentId === incidentId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async saveAnalysisFeedback(jobId: string, feedback: { helpful: boolean; score?: number; comment?: string }): Promise<AnalysisJobRecord | null> {
    const job = this.analysisJobs.find(j => j.id === jobId);
    if (!job) return null;
    job.feedback = {
      ...feedback,
      submittedAt: new Date()
    };
    return job;
  }
}

// Active repository instance. Uses InMemory when auth/database is paused, else Prisma.
let currentRepository: ITracePilotRepository =
  process.env.PAUSE_AUTH === "true"
    ? new InMemoryTracePilotRepository()
    : new PrismaTracePilotRepository();

export function getRepository(): ITracePilotRepository {
  return currentRepository;
}

export function setRepository(repo: ITracePilotRepository): void {
  currentRepository = repo;
}
