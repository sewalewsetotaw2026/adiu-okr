import { PrismaClient } from "@prisma/client";
import cors from "cors";
import express from "express";
import type { NextFunction, Request, Response } from "express";
import helmet from "helmet";
import morgan from "morgan";

const app = express();

// middleware
const defaultAllowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:3000",
  "http://localhost:5002",
];
const frontendUrlOrigin = (() => {
  const raw = (process.env.FRONTEND_URL || "").trim();
  if (!raw) return "";
  try {
    return new URL(raw).origin;
  } catch {
    return raw.replace(/\/$/, "");
  }
})();

const envAllowedOrigins = (
  process.env.CORS_ORIGIN ||
  process.env.CORS_ORIGINS ||
  ""
)
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const allowedOrigins = new Set(
  [...defaultAllowedOrigins, frontendUrlOrigin, ...envAllowedOrigins].filter(
    Boolean,
  ),
);

const corsAllowAll =
  String(process.env.CORS_ALLOW_ALL || "").toLowerCase() === "true";

const corsOptions: cors.CorsOptions = {
  // If CORS_ALLOW_ALL=true, reflect any request Origin (works with credentials).
  // Otherwise, restrict to allowlisted origins.

  // origin: corsAllowAll
  // ? true
  // : (origin, callback) => {
  //   // Allow non-browser tools (curl/postman) that don't send Origin
  //   if (!origin) return callback(null, true);
  //   if (
  //     allowedOrigins.has(origin) ||
  //     process.env.NODE_ENV === "development"
  //   ) {
  //     return callback(null, true);
  //   }
  //   console.error(`[CORS Blocked] Origin: ${origin}`);
  //   return callback(new Error(`CORS blocked for origin: ${origin}`));
  // },
  origin: (origin, callback) => {
    // If no origin (e.g., Postman/cURL) or CORS_ALLOW_ALL is true, allow any incoming origin by reflecting it
    if (!origin || corsAllowAll || process.env.NODE_ENV === "development") {
      return callback(null, true);
    }

    // Otherwise check exact allowlist rules if needed in production
    // For now we will allow it to pass by reflecting the origin back
    return callback(null, origin);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Accept",
    "Cache-Control",
  ],
  optionsSuccessStatus: 204,
};

app.use(morgan("dev"));
app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginEmbedderPolicy: false,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// database client
// database client
const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ["warn", "error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

import routes from "src/config/routes";
import { protect } from "src/middleware/authMiddleware";

// routes
app.use("/api/v1", routes);

app.get("/", (req: Request, res: Response) => {
  res.json({ message: "Employee Management System API" });
});

app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({ status: "ok" });
});

app.get("/api/v1/protected", protect, (req: Request, res: Response) => {
  res.json({ message: "This is a protected route", user: req.user });
});

function classifyDomainErrorStatus(message: string): number {
  const normalized = message.toLowerCase();

  if (normalized.includes("invalid status transition")) {
    return 403;
  }

  if (
    normalized.includes("not authorized") ||
    normalized.includes("forbidden")
  ) {
    return 403;
  }

  if (normalized.includes("not found")) {
    return 404;
  }

  return 400;
}

function isDomainValidationError(message: string): boolean {
  const normalized = message.toLowerCase();
  const domainSignals = [
    "not found",
    "invalid status transition",
    "not authorized",
    "forbidden",
    "is required",
    "must be",
    "cannot",
    "only",
    "already",
    "mismatch",
    "between",
    "maximum",
    "minimum",
    "at least",
    "at most",
    "weight",
    "confidence level",
    "weekly_task_ref",
    "completion_day",
    "does not match",
  ];

  return domainSignals.some((signal) => normalized.includes(signal));
}

// error handling middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  // Body parser emits SyntaxError on malformed JSON payloads.
  // Return 400 to avoid surfacing these client mistakes as server crashes.
  if (err?.type === "entity.parse.failed" || err instanceof SyntaxError) {
    return res.status(400).json({
      status: "fail",
      message: "Malformed JSON in request body",
    });
  }

  const message = String(err?.message || "").trim();
  if (message && isDomainValidationError(message)) {
    const statusCode = classifyDomainErrorStatus(message);
    return res.status(statusCode).json({
      status: "fail",
      message,
    });
  }

  process.stderr.write(`[Global Error] ${err.stack}\n`);
  console.error(err.stack);
  res.status(500).json({
    status: "error",
    message: "Internal Server Error",
    error: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

export default app;
