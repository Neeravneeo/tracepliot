// ponytail: lightweight local git and deployment metadata extractor
import { execSync } from "child_process";

export interface GitMetadataResult {
  commitSha: string | null;
  commitTime: Date | null;
  author: string | null;
  changedFiles: string[];
  deploymentTime: Date | null;
  environment: string | null;
  service: string | null;
  signalsAvailable: {
    gitCommit: boolean;
    gitDiff: boolean;
    deployment: boolean;
  };
  unavailableReasons: Record<string, string>;
}

export class GitMetadataService {
  extractMetadata(options: {
    repoPath?: string;
    commitSha?: string;
    environment?: string;
    service?: string;
    deploymentTime?: Date;
  }): GitMetadataResult {
    const { repoPath, environment = "production", service = "core", deploymentTime } = options;

    let commitSha: string | null = options.commitSha || null;
    let commitTime: Date | null = null;
    let author: string | null = null;
    const changedFiles: string[] = [];
    const unavailableReasons: Record<string, string> = {};

    if (repoPath) {
      try {
        if (!commitSha) {
          commitSha = execSync("git rev-parse HEAD", { cwd: repoPath, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
        }
        const logOutput = execSync(`git log -1 --format="%an|%aI" ${commitSha}`, {
          cwd: repoPath,
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"]
        }).trim();

        if (logOutput) {
          const [parsedAuthor, parsedDate] = logOutput.split("|");
          author = parsedAuthor || null;
          if (parsedDate) commitTime = new Date(parsedDate);
        }

        const diffOutput = execSync(`git diff-tree --no-commit-id --name-only -r ${commitSha}`, {
          cwd: repoPath,
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"]
        }).trim();

        if (diffOutput) {
          diffOutput.split("\n").map(f => f.trim()).filter(Boolean).forEach(f => changedFiles.push(f));
        }
      } catch (err: any) {
        unavailableReasons.git = "Local Git not available or not a Git repository";
      }
    } else {
      unavailableReasons.git = "No repoPath provided for Git inspection";
    }

    const gitCommitAvailable = Boolean(commitSha && commitTime);
    const gitDiffAvailable = changedFiles.length > 0;
    const deploymentAvailable = Boolean(deploymentTime);

    if (!deploymentAvailable) {
      unavailableReasons.deployment = "Deployment timestamp not recorded in environment";
    }

    return {
      commitSha,
      commitTime,
      author,
      changedFiles,
      deploymentTime: deploymentTime || null,
      environment,
      service,
      signalsAvailable: {
        gitCommit: gitCommitAvailable,
        gitDiff: gitDiffAvailable,
        deployment: deploymentAvailable
      },
      unavailableReasons
    };
  }
}

export const gitMetadataService = new GitMetadataService();
