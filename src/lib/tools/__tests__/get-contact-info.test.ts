import { describe, it, expect } from 'vitest';
import { getContactInfo } from '../get-contact-info';
import type { ToolContext } from '../types';

const ctx: ToolContext = {
  sessionId: 'sess_contact_test',
  scopes: ['knowledge:read'],
};

type PlatformInfo = {
  name: string;
  platform: string;
  role: string;
  website: string;
  github: string;
  applicationLink: string | null;
  contact: string | null;
  social: Record<string, string>;
};

type ContactData = {
  platforms: PlatformInfo[];
  total: number;
  primaryContact: string;
  applicationHub: string;
  note: string;
};

describe('getContactInfo tool — metadata', () => {
  it('has the correct name', () => {
    expect(getContactInfo.name).toBe('getContactInfo');
  });

  it('requires knowledge:read scope', () => {
    expect(getContactInfo.requiredScopes).toContain('knowledge:read');
  });

  it('description mentions website and contact', () => {
    expect(getContactInfo.description.toLowerCase()).toContain('website');
    expect(getContactInfo.description.toLowerCase()).toContain('contact');
  });
});

describe('getContactInfo tool — all platforms', () => {
  it('returns all 4 platforms when platform=all', async () => {
    const result = await getContactInfo.handler({}, ctx);
    expect(result.success).toBe(true);
    const data = result.data as ContactData;
    expect(data.total).toBe(4);
    const names = data.platforms.map((p) => p.platform);
    expect(names).toContain('academy');
    expect(names).toContain('code');
    expect(names).toContain('news');
    expect(names).toContain('initiative');
  });

  it('provides a primaryContact email', async () => {
    const result = await getContactInfo.handler({}, ctx);
    const data = result.data as ContactData;
    expect(data.primaryContact).toContain('@');
  });

  it('provides an applicationHub URL', async () => {
    const result = await getContactInfo.handler({}, ctx);
    const data = result.data as ContactData;
    expect(data.applicationHub).toMatch(/^https?:\/\//);
  });

  it('all platform entries have a website and github URL', async () => {
    const result = await getContactInfo.handler({}, ctx);
    const data = result.data as ContactData;
    for (const p of data.platforms) {
      expect(p.website).toMatch(/^https?:\/\//);
      expect(p.github).toMatch(/^https?:\/\//);
    }
  });

  it('all platform entries have a role description', async () => {
    const result = await getContactInfo.handler({}, ctx);
    const data = result.data as ContactData;
    for (const p of data.platforms) {
      expect(p.role).toBeTruthy();
    }
  });
});

describe('getContactInfo tool — single platform filter', () => {
  it('returns only the initiative when platform=initiative', async () => {
    const result = await getContactInfo.handler({ platform: 'initiative' }, ctx);
    const data = result.data as ContactData;
    expect(data.total).toBe(1);
    expect(data.platforms[0]!.platform).toBe('initiative');
  });

  it('initiative has a contact email and applicationLink', async () => {
    const result = await getContactInfo.handler({ platform: 'initiative' }, ctx);
    const data = result.data as ContactData;
    const initiative = data.platforms[0]!;
    expect(initiative.contact).toContain('@');
    expect(initiative.applicationLink).toMatch(/^https?:\/\//);
  });

  it('returns only code platform when platform=code', async () => {
    const result = await getContactInfo.handler({ platform: 'code' }, ctx);
    const data = result.data as ContactData;
    expect(data.total).toBe(1);
    expect(data.platforms[0]!.platform).toBe('code');
  });

  it('returns only academy platform when platform=academy', async () => {
    const result = await getContactInfo.handler({ platform: 'academy' }, ctx);
    const data = result.data as ContactData;
    expect(data.total).toBe(1);
    expect(data.platforms[0]!.platform).toBe('academy');
  });

  it('returns only news platform when platform=news', async () => {
    const result = await getContactInfo.handler({ platform: 'news' }, ctx);
    const data = result.data as ContactData;
    expect(data.total).toBe(1);
    expect(data.platforms[0]!.platform).toBe('news');
  });
});
