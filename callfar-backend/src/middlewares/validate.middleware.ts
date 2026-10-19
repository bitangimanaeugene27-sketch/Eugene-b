import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

export function validateBody(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const fieldErrors = error.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        }));

        // Build a human-readable message from the first (or all) field errors
        const humanMessage = fieldErrors
          .map((fe) => {
            const label = fe.field
              ? fe.field.charAt(0).toUpperCase() + fe.field.slice(1).replace(/([A-Z])/g, ' $1')
              : 'Input';
            return `${label}: ${fe.message}`;
          })
          .join('\n');

        res.status(400).json({
          success: false,
          message: humanMessage || 'Validation error',
          errors: fieldErrors,
        });
        return;
      }
      next(error);
    }
  };
}
