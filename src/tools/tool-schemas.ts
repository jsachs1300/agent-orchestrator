export interface ToolSchema {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, { type: string; description?: string; items?: any }>;
    required?: string[];
  };
  example?: Record<string, any>;
}

export const TOOL_SCHEMAS: ToolSchema[] = [
  {
    name: "repo.search",
    description:
      "Search for a string within repository text files. Honors optional path prefixes and result limits.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Exact string to search for." },
        paths: {
          type: "array",
          description: "Optional list of path prefixes to limit scanning.",
          items: { type: "string" }
        },
        maxResults: { type: "number", description: "Maximum number of matches to return." },
        owner: { type: "string", description: "Repository owner override." },
        repo: { type: "string", description: "Repository name override." },
        branch: { type: "string", description: "Branch to search, defaults to main." }
      },
      required: ["query"]
    },
    example: {
      query: "getUser",
      paths: ["src/"]
    }
  },
  {
    name: "symbol.find_definition",
    description:
      "Find a probable definition for a JavaScript/TypeScript symbol using simple heuristics and repository indexing.",
    parameters: {
      type: "object",
      properties: {
        symbolName: { type: "string", description: "Symbol to locate." },
        pathHint: {
          type: "string",
          description: "Optional file or directory hint to prioritize when searching."
        },
        owner: { type: "string", description: "Repository owner override." },
        repo: { type: "string", description: "Repository name override." },
        branch: { type: "string", description: "Branch to search, defaults to main." }
      },
      required: ["symbolName"]
    },
    example: {
      symbolName: "getUser",
      pathHint: "src/api/user.ts"
    }
  },
  {
    name: "symbol.find_references",
    description:
      "Search for references to a JavaScript/TypeScript symbol using text-based matching with an approximate flag.",
    parameters: {
      type: "object",
      properties: {
        symbolName: { type: "string", description: "Symbol to search for." },
        definitionPath: {
          type: "string",
          description: "Optional file path of the definition to scope or prioritize search."
        },
        pathHint: {
          type: "string",
          description: "Optional path hint to prioritize scanning."
        },
        maxResults: { type: "number", description: "Maximum references to return." },
        owner: { type: "string", description: "Repository owner override." },
        repo: { type: "string", description: "Repository name override." },
        branch: { type: "string", description: "Branch to search, defaults to main." }
      },
      required: ["symbolName"]
    },
    example: {
      symbolName: "getUser",
      definitionPath: "src/api/user.ts"
    }
  },
  {
    name: "http.request",
    description:
      "Make an HTTP request against the runtime configured for the current session.",
    parameters: {
      type: "object",
      properties: {
        method: { type: "string", description: "HTTP method (GET, POST, etc.)." },
        path: {
          type: "string",
          description: "Path to append to the runtime base URL (e.g., /api/users)."
        },
        queryParams: {
          type: "object",
          description: "Optional query string parameters as key/value pairs."
        },
        headers: {
          type: "object",
          description: "Optional headers to include with the request."
        },
        body: {
          type: "object",
          description: "Optional JSON body to send when the method supports it."
        }
      },
      required: ["method", "path"]
    },
    example: {
      method: "GET",
      path: "/health"
    }
  },
  {
    name: "health.check",
    description: "Perform a simple health probe against the configured runtime.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Optional path to probe (defaults to /health)."
        },
        expectedStatus: {
          type: "number",
          description: "Expected HTTP status code for a healthy response (default 200)."
        }
      }
    },
    example: {
      path: "/ready",
      expectedStatus: 200
    }
  }
];
