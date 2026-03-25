import { randomUUID } from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { RequestContext } from './request-context';

const REQUEST_ID_HEADER = 'x-request-id';

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestId = (req.header(REQUEST_ID_HEADER) || randomUUID()).trim();
  res.setHeader(REQUEST_ID_HEADER, requestId);
  RequestContext.run({ requestId }, next);
}
