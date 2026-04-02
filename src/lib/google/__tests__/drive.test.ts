/**
 * Tests for Google Drive service.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listFolder, searchFiles, getFileContent } from '../drive';
import type { GoogleWorkspaceContext, DriveFile } from '../types';

// Mock the auth module
vi.mock('../auth', () => ({
  getContextToken: vi.fn().mockResolvedValue('ya29.mock-token'),
  GOOGLE_SCOPES: {
    DRIVE_READONLY: 'https://www.googleapis.com/auth/drive.readonly',
  },
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const mockCtx: GoogleWorkspaceContext = {
  tenantId: 'tenant-1',
  providerId: 'provider-1',
  credentials: {
    type: 'service_account',
    client_email: 'test@test.iam.gserviceaccount.com',
    private_key: 'fake-key',
  },
  config: {
    domain: 'test.org',
    adminEmail: 'admin@test.org',
    driveFolderIds: ['folder-1'],
  },
};

describe('Google Drive — listFolder', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('lists files in a folder', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        files: [
          { id: 'f1', name: 'Document.gdoc', mimeType: 'application/vnd.google-apps.document', modifiedTime: '2025-01-01T00:00:00Z' },
          { id: 'f2', name: 'data.csv', mimeType: 'text/csv', size: '1024' },
        ],
        nextPageToken: undefined,
      }),
    });

    const result = await listFolder(mockCtx, 'folder-1');
    expect(result.files).toHaveLength(2);
    expect(result.files[0]!.id).toBe('f1');
    expect(result.files[0]!.name).toBe('Document.gdoc');
    expect(result.files[1]!.size).toBe(1024);
  });

  it('handles empty folders', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ files: [] }),
    });

    const result = await listFolder(mockCtx, 'empty-folder');
    expect(result.files).toHaveLength(0);
  });

  it('throws on API error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      text: async () => 'Not Found',
    });

    await expect(listFolder(mockCtx, 'bad-folder')).rejects.toThrow('Drive API');
  });
});

describe('Google Drive — searchFiles', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('searches with query and folder filter', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        files: [
          { id: 's1', name: 'Handbook.gdoc', mimeType: 'application/vnd.google-apps.document' },
        ],
      }),
    });

    const result = await searchFiles(mockCtx, {
      query: 'handbook',
      folderIds: ['folder-1'],
      maxResults: 5,
    });

    expect(result.files).toHaveLength(1);
    expect(result.files[0]!.name).toBe('Handbook.gdoc');

    // Verify query was constructed with folder filter
    const callUrl = mockFetch.mock.calls[0]![0] as string;
    expect(callUrl).toContain('folder-1');
    expect(callUrl).toContain('handbook');
  });
});

describe('Google Drive — getFileContent', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('exports Google Docs as text', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => 'This is the document content.',
    });

    const file: DriveFile = {
      id: 'doc1',
      name: 'Policy.gdoc',
      mimeType: 'application/vnd.google-apps.document',
    };

    const result = await getFileContent(mockCtx, file);
    expect(result.text).toBe('This is the document content.');
    expect(result.extractionMethod).toBe('export');
  });

  it('downloads text files directly', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => '# README\nHello world',
    });

    const file: DriveFile = {
      id: 'md1',
      name: 'README.md',
      mimeType: 'text/markdown',
    };

    const result = await getFileContent(mockCtx, file);
    expect(result.text).toBe('# README\nHello world');
    expect(result.extractionMethod).toBe('download');
  });

  it('returns description for binary files', async () => {
    const file: DriveFile = {
      id: 'img1',
      name: 'photo.png',
      mimeType: 'image/png',
    };

    const result = await getFileContent(mockCtx, file);
    expect(result.text).toContain('Binary file');
    expect(result.extractionMethod).toBe('description_only');
  });
});
