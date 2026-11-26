import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError } from "zod";

export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const formattedErrors = (result.error as ZodError).errors.map((err) => ({
        path: err.path.join("."),
        message: err.message
      }));

      res.status(400).json({
        error: "ValidationError",
        message: "Invalid payload provided",
        details: formattedErrors
      });
      return;
    }

    req.body = result.data;
    next();
  };
}
