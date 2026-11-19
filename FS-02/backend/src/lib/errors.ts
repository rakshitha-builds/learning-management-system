import type { NextFunction, Request, RequestHandler, Response } from "express";
import { ZodError } from "zod";

export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
  }
}

export const badRequest = (m: string, d?: unknown) => new AppError(400, "BAD_REQUEST", m, d);
export const unauthorized = (m = "Authentication required") => new AppError(401, "UNAUTHORIZED", m);
export const forbidden = (m = "You do not have permission to do that") => new AppError(403, "FORBIDDEN", m);
export const notFound = (m = "Not found") => new AppError(404, "NOT_FOUND", m);
export const conflict = (m: string) => new AppError(409, "CONFLICT", m);

export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };

export function errorMiddleware(err: any, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
  }
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: err.issues[0]?.message ?? "Invalid input",
        details: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      },
    });
  }
  if (err?.name === "MulterError") {
    return res.status(400).json({ error: { code: "UPLOAD_ERROR", message: err.message } });
  }
  if (err?.type === "entity.parse.failed") {
    return res.status(400).json({ error: { code: "BAD_JSON", message: "Malformed JSON body" } });
  }
  if (err?.type === "entity.too.large") {
    return res.status(413).json({ error: { code: "TOO_LARGE", message: "Request body too large" } });
  }
  console.error("[error]", err);
  return res.status(500).json({ error: { code: "INTERNAL", message: "Something went wrong on our side" } });
}
