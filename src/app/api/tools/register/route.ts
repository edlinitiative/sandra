/**
 * POST /api/tools/register
 *
 * Register external API tools for a tenant by providing an OpenAPI 3.x spec.
 * Sandra parses the spec, creates an ExternalApiConnection, and generates
 * DynamicTool rows for each endpoint — immediately available to the tenant.
 *
 * Accepts TWO content types:
 *
 *   application/json (original) — Body is JSON with openApiSpec as an object:
 *     { tenantId, connectionName, baseUrl, openApiSpec: {...}, authType, ... }
 *
 *   text/plain or text/yaml (new) — Body is raw YAML/JSON spec text.
 *     Connection metadata (tenantId, connectionName, baseUrl, authType, …)
 *     must be passed as query parameters.
 *
 * Body (JSON):
 *   tenantId: string       — The tenant to register tools for
 *   connectionName: string — Human-friendly name ("Acme CRM")
 *   baseUrl: string        — Base URL for API calls
 *   openApiSpec: object    — OpenAPI 3.x spec as JSON object
 *   openApiSpecText?: string — OpenAPI 3.x spec as raw YAML or JSON string
 *                              (used instead of openApiSpec when provided)
 *   authType?: string      — "api_key" | "bearer" | "basic" | "oauth2" | "none"
 *   credentials?: object   — Auth credentials
 *   authConfig?: object    — Auth configuration (header names, etc.)
 *   defaultHeaders?: object— Default headers for all requests
 *   rateLimitRpm?: number  — Rate limit (default: 60)
 *   namePrefix?: string    — Optional prefix for tool names
 */

import { NextRequest, NextResponse } from 'next/server';
import { registerApiTools } from '@/lib/tools/tenant-tool-loader';
import { parseOpenApiSpecFromText } from '@/lib/tools/openapi-parser';
import { db } from '@/lib/db';
import { createLogger } from '@/lib/utils';

const log = createLogger('api:tools:register');

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') ?? '';

    let tenantId: string | undefined;
    let connectionName: string | undefined;
    let baseUrl: string | undefined;
    let openApiSpec: Record<string, unknown> | undefined;
    let openApiSpecText: string | undefined;
    let authType: string | undefined;
    let credentials: Record<string, unknown> | undefined;
    let authConfig: Record<string, unknown> | undefined;
    let defaultHeaders: Record<string, string> | undefined;
    let rateLimitRpm: number | undefined;
    let namePrefix: string | undefined;

    if (contentType.includes('application/json')) {
      // Original JSON path
      const body = await request.json() as Record<string, unknown>;
      tenantId = typeof body.tenantId === 'string' ? body.tenantId : undefined;
      connectionName = typeof body.connectionName === 'string' ? body.connectionName : undefined;
      baseUrl = typeof body.baseUrl === 'string' ? body.baseUrl : undefined;
      openApiSpec = (body.openApiSpec && typeof body.openApiSpec === 'object')
        ? body.openApiSpec as Record<string, unknown>
        : undefined;
      openApiSpecText = typeof body.openApiSpecText === 'string' ? body.openApiSpecText : undefined;
      authType = typeof body.authType === 'string' ? body.authType : undefined;
      credentials = (body.credentials && typeof body.credentials === 'object')
        ? body.credentials as Record<string, unknown>
        : undefined;
      authConfig = (body.authConfig && typeof body.authConfig === 'object')
        ? body.authConfig as Record<string, unknown>
        : undefined;
      defaultHeaders = (body.defaultHeaders && typeof body.defaultHeaders === 'object')
        ? body.defaultHeaders as Record<string, string>
        : undefined;
      rateLimitRpm = typeof body.rateLimitRpm === 'number' ? body.rateLimitRpm : undefined;
      namePrefix = typeof body.namePrefix === 'string' ? body.namePrefix : undefined;
    } else {
      // Raw YAML/JSON text — metadata comes from query params
      openApiSpecText = await request.text();
      const q = request.nextUrl.searchParams;
      tenantId = q.get('tenantId') ?? undefined;
      connectionName = q.get('connectionName') ?? undefined;
      baseUrl = q.get('baseUrl') ?? undefined;
      authType = q.get('authType') ?? undefined;
      namePrefix = q.get('namePrefix') ?? undefined;
      const rpm = q.get('rateLimitRpm');
      if (rpm) rateLimitRpm = parseInt(rpm, 10);
    }

    // Validate required fields
    if (!tenantId) return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    if (!connectionName) return NextResponse.json({ error: 'connectionName is required' }, { status: 400 });
    if (!baseUrl) return NextResponse.json({ error: 'baseUrl is required' }, { status: 400 });
    if (!openApiSpec && !openApiSpecText) {
      return NextResponse.json({ error: 'openApiSpec (object) or openApiSpecText (string) is required' }, { status: 400 });
    }

    // If raw text provided, parse it now (supports both JSON and YAML)
    if (openApiSpecText && !openApiSpec) {
      const parsed = parseOpenApiSpecFromText(openApiSpecText);
      if (!parsed.success) {
        return NextResponse.json({
          error: 'Failed to parse OpenAPI spec',
          details: parsed.errors,
        }, { status: 422 });
      }
      // Re-parse to a plain object so registerApiTools can use it
      // (we pass the already-parsed tools via spec re-serialisation)
      try {
        openApiSpec = JSON.parse(JSON.stringify(
          openApiSpecText.trim().startsWith('{') || openApiSpecText.trim().startsWith('[')
            ? JSON.parse(openApiSpecText)
            : (await import('js-yaml')).load(openApiSpecText)
        )) as Record<string, unknown>;
      } catch {
        return NextResponse.json({ error: 'Failed to normalise spec to JSON object' }, { status: 422 });
      }
    }

    // Verify tenant exists
    const tenant = await db.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    // Register the tools
    const result = await registerApiTools({
      tenantId,
      connectionName,
      baseUrl,
      openApiSpec: openApiSpec!,
      authType,
      credentials,
      authConfig,
      defaultHeaders,
      rateLimitRpm,
      namePrefix,
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

