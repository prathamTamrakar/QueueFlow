import crypto from 'crypto';
import { PdfJobPayload, JobExecutionResult } from '../../types';
import { logger } from '../../logger';

export async function processPdfJob(
  jobId: string,
  payload: PdfJobPayload
): Promise<JobExecutionResult> {
  const startTime = Date.now();
  logger.info({ jobId, reportId: payload.reportId, title: payload.title }, 'Processing PDF generation');

  const pages = payload.pages || 5;
  // Simulate CPU rendering time proportional to page count (e.g. 30ms per page)
  const renderTime = Math.min(pages * 30 + 100, 1500);
  await new Promise((resolve) => setTimeout(resolve, renderTime));

  const pdfHash = crypto.createHash('sha256').update(`${jobId}-${payload.reportId}-${pages}`).digest('hex');
  const estimatedByteSize = pages * 128400 + Math.floor(Math.random() * 5000);

  const durationMs = Date.now() - startTime;

  return {
    success: true,
    data: {
      action: 'PDF_RENDERED',
      reportId: payload.reportId,
      title: payload.title,
      renderedPages: pages,
      estimatedByteSize,
      checksumSha256: pdfHash,
      pdfUrl: `https://storage.queueflow.internal/artifacts/${payload.reportId}.pdf`,
    },
    durationMs,
  };
}
