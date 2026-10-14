import { PrismaClient, JobStatus, JobType, AttemptStatus, AuditAction, ActorType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding for QueueFlow...');

  // Clean existing data
  await prisma.jobAuditLog.deleteMany();
  await prisma.sideEffectLog.deleteMany();
  await prisma.deadLetterRecord.deleteMany();
  await prisma.jobResult.deleteMany();
  await prisma.jobAttempt.deleteMany();
  await prisma.idempotencyRecord.deleteMany();
  await prisma.job.deleteMany();

  // 1. Completed Email Simulation Job
  const emailJob = await prisma.job.create({
    data: {
      type: JobType.EMAIL_SIMULATION,
      queueName: 'default-jobs',
      payload: {
        recipient: 'alice@example.com',
        subject: 'Welcome to QueueFlow Cloud',
        template: 'welcome-email-v1',
        context: { name: 'Alice Smith', plan: 'Enterprise' }
      },
      priority: 2,
      status: JobStatus.COMPLETED,
      maxAttempts: 3,
      attemptCount: 1,
      createdAt: new Date(Date.now() - 3600000 * 2),
      startedAt: new Date(Date.now() - 3600000 * 2 + 500),
      completedAt: new Date(Date.now() - 3600000 * 2 + 1200),
      attempts: {
        create: [
          {
            attemptNumber: 1,
            status: AttemptStatus.SUCCESS,
            workerId: 'worker-node-alpha',
            durationMs: 700,
            startedAt: new Date(Date.now() - 3600000 * 2 + 500),
            finishedAt: new Date(Date.now() - 3600000 * 2 + 1200)
          }
        ]
      },
      result: {
        create: {
          data: {
            messageId: 'msg_9941a8bc71',
            status: 'DELIVERED',
            providerResponse: '250 2.0.0 OK: queued as 9941a8bc71',
            deliveredAt: new Date(Date.now() - 3600000 * 2 + 1200).toISOString()
          },
          executionDurationMs: 700
        }
      },
      auditLogs: {
        create: [
          {
            action: AuditAction.ENQUEUED,
            actor: ActorType.API_USER,
            actorId: 'api-key-test',
            timestamp: new Date(Date.now() - 3600000 * 2)
          },
          {
            action: AuditAction.ATTEMPT_STARTED,
            actor: ActorType.WORKER,
            actorId: 'worker-node-alpha',
            timestamp: new Date(Date.now() - 3600000 * 2 + 500)
          },
          {
            action: AuditAction.ATTEMPT_SUCCEEDED,
            actor: ActorType.WORKER,
            actorId: 'worker-node-alpha',
            timestamp: new Date(Date.now() - 3600000 * 2 + 1200)
          }
        ]
      }
    }
  });

  // Track side effect
  await prisma.sideEffectLog.create({
    data: {
      dedupKey: `email:${emailJob.id}:alice@example.com`,
      jobId: emailJob.id,
      effectType: 'EMAIL_DISPATCH',
      recipient: 'alice@example.com',
      status: 'COMPLETED'
    }
  });

  // 2. Completed PDF Generation Job (with 1 retry)
  await prisma.job.create({
    data: {
      type: JobType.PDF_GENERATION,
      queueName: 'default-jobs',
      payload: {
        reportId: 'rep_monthly_q3',
        title: 'Q3 Distributed Infrastructure Report',
        pages: 14,
        includeCharts: true
      },
      priority: 1,
      status: JobStatus.COMPLETED,
      maxAttempts: 3,
      attemptCount: 2,
      createdAt: new Date(Date.now() - 3600000),
      startedAt: new Date(Date.now() - 3600000 + 400),
      completedAt: new Date(Date.now() - 3600000 + 3500),
      attempts: {
        create: [
          {
            attemptNumber: 1,
            status: AttemptStatus.FAILED,
            workerId: 'worker-node-alpha',
            errorName: 'NetworkTimeoutError',
            errorMessage: 'Renderer gateway timed out during asset fetch',
            isRetryable: true,
            durationMs: 1200,
            startedAt: new Date(Date.now() - 3600000 + 400),
            finishedAt: new Date(Date.now() - 3600000 + 1600)
          },
          {
            attemptNumber: 2,
            status: AttemptStatus.SUCCESS,
            workerId: 'worker-node-beta',
            durationMs: 1400,
            startedAt: new Date(Date.now() - 3600000 + 2100),
            finishedAt: new Date(Date.now() - 3600000 + 3500)
          }
        ]
      },
      result: {
        create: {
          data: {
            pdfUrl: 'https://storage.queueflow.internal/reports/rep_monthly_q3.pdf',
            byteSize: 1845120,
            renderedPages: 14,
            checksumSha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
          },
          executionDurationMs: 1400
        }
      },
      auditLogs: {
        create: [
          {
            action: AuditAction.ENQUEUED,
            actor: ActorType.API_USER,
            timestamp: new Date(Date.now() - 3600000)
          },
          {
            action: AuditAction.ATTEMPT_FAILED,
            actor: ActorType.WORKER,
            actorId: 'worker-node-alpha',
            timestamp: new Date(Date.now() - 3600000 + 1600)
          },
          {
            action: AuditAction.RETRIED,
            actor: ActorType.SYSTEM,
            timestamp: new Date(Date.now() - 3600000 + 2100)
          },
          {
            action: AuditAction.ATTEMPT_SUCCEEDED,
            actor: ActorType.WORKER,
            actorId: 'worker-node-beta',
            timestamp: new Date(Date.now() - 3600000 + 3500)
          }
        ]
      }
    }
  });

  // 3. Failed Job in Dead-Letter Queue (exhausted max 3 attempts)
  const failedJob = await prisma.job.create({
    data: {
      type: JobType.FAILURE_SIMULATION,
      queueName: 'default-jobs',
      payload: {
        scenario: 'persistent_service_outage',
        failCountBeforeSuccess: 5,
        failType: 'RETRYABLE',
        customErrorMessage: 'Upstream payment gateway HTTP 503 Service Unavailable'
      },
      priority: 0,
      status: JobStatus.FAILED,
      maxAttempts: 3,
      attemptCount: 3,
      createdAt: new Date(Date.now() - 1800000),
      startedAt: new Date(Date.now() - 1800000 + 200),
      failedAt: new Date(Date.now() - 1800000 + 7200),
      attempts: {
        create: [
          {
            attemptNumber: 1,
            status: AttemptStatus.FAILED,
            workerId: 'worker-node-alpha',
            errorName: 'RetryableError',
            errorMessage: 'Upstream payment gateway HTTP 503 Service Unavailable (Attempt 1/3)',
            isRetryable: true,
            durationMs: 350,
            startedAt: new Date(Date.now() - 1800000 + 200),
            finishedAt: new Date(Date.now() - 1800000 + 550)
          },
          {
            attemptNumber: 2,
            status: AttemptStatus.FAILED,
            workerId: 'worker-node-alpha',
            errorName: 'RetryableError',
            errorMessage: 'Upstream payment gateway HTTP 503 Service Unavailable (Attempt 2/3)',
            isRetryable: true,
            durationMs: 400,
            startedAt: new Date(Date.now() - 1800000 + 2550),
            finishedAt: new Date(Date.now() - 1800000 + 2950)
          },
          {
            attemptNumber: 3,
            status: AttemptStatus.FAILED,
            workerId: 'worker-node-beta',
            errorName: 'RetryableError',
            errorMessage: 'Upstream payment gateway HTTP 503 Service Unavailable (Attempt 3/3)',
            isRetryable: true,
            durationMs: 420,
            startedAt: new Date(Date.now() - 1800000 + 6780),
            finishedAt: new Date(Date.now() - 1800000 + 7200)
          }
        ]
      },
      deadLetterRecord: {
        create: {
          originalPayload: {
            scenario: 'persistent_service_outage',
            failCountBeforeSuccess: 5,
            failType: 'RETRYABLE',
            customErrorMessage: 'Upstream payment gateway HTTP 503 Service Unavailable'
          },
          errorReason: 'Job exceeded max attempts (3/3): Upstream payment gateway HTTP 503 Service Unavailable',
          errorDetails: {
            attemptsExhausted: 3,
            lastError: 'RetryableError',
            exitCode: 'DLQ_MAX_RETRIES_EXCEEDED'
          },
          failureCount: 3,
          firstFailedAt: new Date(Date.now() - 1800000 + 550),
          lastFailedAt: new Date(Date.now() - 1800000 + 7200),
          isResolved: false
        }
      },
      auditLogs: {
        create: [
          {
            action: AuditAction.ENQUEUED,
            actor: ActorType.API_USER,
            timestamp: new Date(Date.now() - 1800000)
          },
          {
            action: AuditAction.ATTEMPT_FAILED,
            actor: ActorType.WORKER,
            details: { attempt: 1 },
            timestamp: new Date(Date.now() - 1800000 + 550)
          },
          {
            action: AuditAction.ATTEMPT_FAILED,
            actor: ActorType.WORKER,
            details: { attempt: 2 },
            timestamp: new Date(Date.now() - 1800000 + 2950)
          },
          {
            action: AuditAction.ATTEMPT_FAILED,
            actor: ActorType.WORKER,
            details: { attempt: 3 },
            timestamp: new Date(Date.now() - 1800000 + 7200)
          },
          {
            action: AuditAction.MOVED_TO_DLQ,
            actor: ActorType.SYSTEM,
            details: { reason: 'Exhausted max retries (3)' },
            timestamp: new Date(Date.now() - 1800000 + 7210)
          }
        ]
      }
    }
  });

  // 4. Permanent Non-Retryable Error Job
  await prisma.job.create({
    data: {
      type: JobType.FAILURE_SIMULATION,
      queueName: 'default-jobs',
      payload: {
        scenario: 'invalid_recipient_address',
        failType: 'PERMANENT',
        customErrorMessage: 'Mailbox does not exist (SMTP 550 5.1.1 User unknown)'
      },
      priority: 0,
      status: JobStatus.FAILED,
      maxAttempts: 3,
      attemptCount: 1,
      createdAt: new Date(Date.now() - 900000),
      startedAt: new Date(Date.now() - 900000 + 100),
      failedAt: new Date(Date.now() - 900000 + 350),
      attempts: {
        create: [
          {
            attemptNumber: 1,
            status: AttemptStatus.FAILED,
            workerId: 'worker-node-alpha',
            errorName: 'NonRetryableError',
            errorMessage: 'Mailbox does not exist (SMTP 550 5.1.1 User unknown)',
            isRetryable: false,
            durationMs: 250,
            startedAt: new Date(Date.now() - 900000 + 100),
            finishedAt: new Date(Date.now() - 900000 + 350)
          }
        ]
      },
      deadLetterRecord: {
        create: {
          originalPayload: {
            scenario: 'invalid_recipient_address',
            failType: 'PERMANENT',
            customErrorMessage: 'Mailbox does not exist (SMTP 550 5.1.1 User unknown)'
          },
          errorReason: 'Non-retryable error encountered: Mailbox does not exist (SMTP 550 5.1.1 User unknown)',
          errorDetails: {
            errorType: 'NonRetryableError',
            smtpCode: 550
          },
          failureCount: 1,
          firstFailedAt: new Date(Date.now() - 900000 + 350),
          lastFailedAt: new Date(Date.now() - 900000 + 350),
          isResolved: false
        }
      },
      auditLogs: {
        create: [
          {
            action: AuditAction.ENQUEUED,
            actor: ActorType.API_USER,
            timestamp: new Date(Date.now() - 900000)
          },
          {
            action: AuditAction.ATTEMPT_FAILED,
            actor: ActorType.WORKER,
            details: { reason: 'Permanent error' },
            timestamp: new Date(Date.now() - 900000 + 350)
          },
          {
            action: AuditAction.MOVED_TO_DLQ,
            actor: ActorType.SYSTEM,
            details: { isRetryable: false },
            timestamp: new Date(Date.now() - 900000 + 360)
          }
        ]
      }
    }
  });

  // 5. Active and Pending Jobs
  await prisma.job.create({
    data: {
      type: JobType.CPU_LIGHT_PROCESSING,
      queueName: 'default-jobs',
      payload: {
        taskName: 'data_partition_hashing',
        recordsCount: 50000,
        algorithm: 'sha256'
      },
      priority: 3,
      status: JobStatus.ACTIVE,
      maxAttempts: 3,
      attemptCount: 1,
      createdAt: new Date(Date.now() - 10000),
      startedAt: new Date(Date.now() - 2000),
      attempts: {
        create: [
          {
            attemptNumber: 1,
            status: AttemptStatus.RUNNING,
            workerId: 'worker-node-alpha',
            startedAt: new Date(Date.now() - 2000)
          }
        ]
      },
      auditLogs: {
        create: [
          {
            action: AuditAction.ENQUEUED,
            actor: ActorType.API_USER,
            timestamp: new Date(Date.now() - 10000)
          },
          {
            action: AuditAction.ATTEMPT_STARTED,
            actor: ActorType.WORKER,
            actorId: 'worker-node-alpha',
            timestamp: new Date(Date.now() - 2000)
          }
        ]
      }
    }
  });

  await prisma.job.create({
    data: {
      type: JobType.EMAIL_SIMULATION,
      queueName: 'default-jobs',
      payload: {
        recipient: 'bob@enterprise.org',
        subject: 'Weekly Digest',
        template: 'weekly-digest'
      },
      priority: 0,
      status: JobStatus.PENDING,
      maxAttempts: 3,
      attemptCount: 0,
      createdAt: new Date(Date.now() - 5000),
      auditLogs: {
        create: [
          {
            action: AuditAction.ENQUEUED,
            actor: ActorType.API_USER,
            timestamp: new Date(Date.now() - 5000)
          }
        ]
      }
    }
  });

  console.log('✅ Seed completed successfully: 5 jobs with attempts, results, DLQ, and audit logs created.');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
