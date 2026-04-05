/**
 * POST /api/tools/register
 *
 * Register external API tools for a tenant by providing an OpenAPI 3.x spec.
 * Sandra parses the spec, creates an ExternalApiConnection, and generates
 * DynamicTool rows for each endpoint — immediately available to the tenant.
 *
 * Body:
 *   tenantId: string       — The tenant to register tools for
 *   connectionName: string — Human-friendly name ("Acme CRM")
 *   baseUrl: string        — Base URL for API calls
 *   openApiSpec: object    — OpenAPI 3.x spec as JSON
 *   authType?: string      — "api_key" | "bearer" | "basic" | "oauth2" | "none"
 *   credentials?: object   — Auth credentials
 *   authConfig?: object    — Auth configuration (header names, etc.)
 *   defaultHeaders?: object— Default headers for all requests
 *   rateLimitRpm?: number  — Rate limit (default: 60)
 *   namePrefix?: string    — Optional prefix for tool names
 */

import { NextRequest, NextResponse } from 'next/server';
import { registerApiTools } from '@/lib/tools/tenant-tool-loader';
import { db } from '@/lib/db';
import { createLogger } from '@/lib/utils';

const log = createLogger('api:tools:register');

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      tenantId,
      connectionName,
      baseUrl,
      openApiSpec,
      authType,
      credentials,
      authConfig,
      defaultHeaders,
      rateLimitRpm,
      namePrefix,
    } = body as Record<string, unknown>;

    // Validate required fields
    if (!tenantId || typeof tenantId !== 'string') {
      return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    }
    if (!connectionName || typeof connectionName !== 'string') {
      return NextResponse.json({ error: 'connectionName is required' }, { status: 400 });
    }
    if (!baseUrl || typeof baseUrl !== 'string') {
      return NextResponse.json({ error: 'baseUrl is required' }, { status: 400 });
    }
    if (!openApiSpec || typeof openApiSpec !== 'object') {
      return NextResponse.json({ error: 'openApiSpec must be a JSON object' }, { status: 400 });
    }

    // Verify tenant exists
    const tenant = await db.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    // Register the tools
    const result = await registerApiTools({
      tenantId,
      connectionName: connectionName as string,
      baseUrl: baseUrl as string,
      openApiSpec: openApiSpec as Record<string, unknown>,
      authType: authType as string | undefined,
      credentials: credentials as Record<string, unknown> | undefined,
      authConfig: authConfig as Record<string, unknown> | undefined,
      defaultHeaders: defaultHeaders as Record<string, string> | undefined,
      rateLimitRpm: typeof rateLimitRpm === 'number' ? rateLimitRpm : undefined,
      namePrefix: namePrefix as string | undefined,
    });

    if (!result.success) {
      return NextResponse.json({
        error: 'Failed to parse OpenAPI spec',
        details: result.errors,
      }, { status: 422 });
    }

    log.info(`Registered ${result.toolsCreated} tools for tenant ${tenantId}`, {
      connectionId: result.connectionId,
    });

    return NextResponse.json({
      connectionId: result.connectionId,
      toolsCreated: result.toolsCreated,
      toolNames: result.toolNames,
      warnings: result.errors.length > 0 ? result.errors : undefined,
    }, { status: 201 });
  } catch (error) {
    log.error('Tool registration failed', {
      error: error instanceof Error ? error.message : 'unknown',
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
