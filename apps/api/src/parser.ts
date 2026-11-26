export interface ParsedTrace {
  exceptionType: string;
  message: string;
  stackTrace: string;
  language: string;
}

/**
 * Parses raw text, logs, or stack traces from various runtimes (Node.js/JS/TS, Python, Java, Go, etc.)
 * into normalized incident components.
 */
export function parseRawTraceOrLog(raw: string): ParsedTrace {
  const trimmed = raw.trim();
  if (!trimmed) {
    return {
      exceptionType: "UnknownError",
      message: "Empty trace provided",
      stackTrace: "",
      language: "javascript"
    };
  }

  const lines = trimmed.split(/\r?\n/).map(l => l.trimEnd());

  // 1. Check for Python Traceback
  const pythonIndex = lines.findIndex(l => l.includes("Traceback (most recent call last):"));
  if (pythonIndex !== -1) {
    // Find the last line with Exception: message (e.g. ValueError: invalid literal)
    const errLine = lines.slice(pythonIndex).reverse().find(l => /^[A-Za-z0-9_.]+(?:Error|Exception):/.test(l.trim()));
    if (errLine) {
      const match = errLine.trim().match(/^([A-Za-z0-9_.]+(?:Error|Exception)):\s*(.*)$/);
      if (match) {
        return {
          exceptionType: match[1],
          message: match[2] || match[1],
          stackTrace: trimmed,
          language: "python"
        };
      }
    }
    return {
      exceptionType: "PythonException",
      message: lines[lines.length - 1] || "Python traceback error",
      stackTrace: trimmed,
      language: "python"
    };
  }

  // 2. Check for Standard JS/Node stack trace (e.g. "TypeError: Cannot read properties...")
  // Often on first or second non-empty line
  for (let i = 0; i < Math.min(lines.length, 5); i++) {
    const line = lines[i].trim();
    // Match pattern: "NameError: message" or "Error: message" or "[ERROR] NameError: message"
    const jsMatch = line.match(/(?:^|\[[A-Z]+\]\s+)?([A-Za-z0-9_.$]+(?:Error|Exception)):\s*(.*)$/);
    if (jsMatch) {
      return {
        exceptionType: jsMatch[1],
        message: jsMatch[2] || jsMatch[1],
        stackTrace: trimmed,
        language: "javascript"
      };
    }
  }

  // 3. Check for Java / Generic Exception line
  for (let i = 0; i < Math.min(lines.length, 5); i++) {
    const line = lines[i].trim();
    const javaMatch = line.match(/(?:java\.[a-z.]+\.)?([A-Za-z0-9_]+Exception|Error):\s*(.*)$/);
    if (javaMatch) {
      return {
        exceptionType: javaMatch[1],
        message: javaMatch[2] || javaMatch[1],
        stackTrace: trimmed,
        language: "java"
      };
    }
  }

  // 4. Fallback: Check if first line has a colon
  const firstLine = lines[0].trim();
  const colonIndex = firstLine.indexOf(":");
  if (colonIndex > 0 && colonIndex < 40) {
    const potentialType = firstLine.substring(0, colonIndex).trim();
    const potentialMsg = firstLine.substring(colonIndex + 1).trim();
    if (/^[A-Za-z0-9_.-]+$/.test(potentialType)) {
      return {
        exceptionType: potentialType,
        message: potentialMsg || potentialType,
        stackTrace: trimmed,
        language: "javascript"
      };
    }
  }

  // 5. Ultimate Fallback: Default error type
  return {
    exceptionType: "ManualIncidentError",
    message: firstLine.slice(0, 200),
    stackTrace: trimmed,
    language: "javascript"
  };
}
