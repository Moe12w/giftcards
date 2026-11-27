import { runIntegration } from '@/lib/integrations/gateway';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Credential and platform health. Returns no money and no card data.
 */
export async function GET(request: Request) {
  return runIntegration(request, {
    operation: 'health',
    idempotent: false,
    parseBody: false,
    requireSignature: false,
    handler: async (context) => ({
      data: {
        operation: 'health',
        platform: {
          code: context.platformCode,
          name: context.platformName,
          status: context.platformStatus,
        },
        environment: context.environment,
        capabilities: context.capabilities,
        server_time: new Date().toISOString(),
      },
    }),
  });
}
