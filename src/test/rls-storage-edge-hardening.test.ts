import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { normalizeUploadPath } from '../../supabase/functions/_shared/uploadPaths';

function read(relativePath: string) {
  return readFileSync(relativePath, 'utf8');
}

describe('RLS, Storage and Edge Function hardening', () => {
  it('locks priority tables behind service-role Edge Functions', () => {
    const migration = read('supabase/migrations/20260712150000_harden_rls_storage_and_rpc.sql');

    expect(migration).toContain('FORCE ROW LEVEL SECURITY');
    expect(migration).toContain('REVOKE ALL ON TABLE public.%I FROM anon, authenticated');
    expect(migration).toContain('GRANT ALL ON TABLE public.%I TO service_role');
    expect(migration).toContain("public = false");
    expect(migration).toContain('REVOKE ALL ON TABLE storage.objects FROM anon, authenticated');
  });

  it('restricts the privileged medical completion RPC to service_role', () => {
    const migration = read('supabase/migrations/20260712150000_harden_rls_storage_and_rpc.sql');

    expect(migration).toContain('SET search_path TO pg_catalog, public');
    expect(migration).toContain('FROM PUBLIC, anon, authenticated');
    expect(migration).toContain('TO service_role');
  });

  it('accepts only uploaded paths owned by the authenticated application user', () => {
    const options = {
      allowedPrefixes: ['laudos/exames/'],
      fieldName: 'arquivos',
      ownerSegment: 'patient-a',
    };

    expect(normalizeUploadPath('laudos/exames/patient-a/exame.pdf', options))
      .toBe('laudos/exames/patient-a/exame.pdf');
    expect(() => normalizeUploadPath('laudos/exames/patient-b/exame.pdf', options))
      .toThrowError(expect.objectContaining({ code: 'UPLOAD_PATH_INVALID' }));
    expect(() => normalizeUploadPath('laudos/exames/patient-a/../patient-b/exame.pdf', options))
      .toThrowError(expect.objectContaining({ code: 'UPLOAD_PATH_INVALID' }));
  });

  it('requires a linked user, validates MIME and creates short-lived signed URLs', () => {
    const upload = read('supabase/functions/upload-file/index.ts');
    const adminApproval = read('supabase/functions/get-admin-approval-queue/repository.ts');
    const professionalDashboard = read('supabase/functions/get-professional-dashboard/repository.ts');

    expect(upload).toContain('APP_USER_NOT_AUTHORIZED');
    expect(upload).toContain('UPLOAD_MIME_EXTENSION_MISMATCH');
    expect(upload).toContain('createSignedUrl(filePath, 5 * 60)');
    expect(upload).not.toContain('createSignedUrl(filePath, 60 * 60)');
    expect(adminApproval).toContain('createSignedUrl(path, 5 * 60)');
    expect(professionalDashboard).toContain('createSignedUrl(path, 5 * 60)');
  });

  it('does not select private patient columns in public review and question reads', () => {
    const readModels = read('supabase/functions/read-models/index.ts');
    const publicReview = readModels.split('const PUBLIC_REVIEW_SELECT')[1].split('`;')[0];
    const publicQuestion = readModels.split('const PUBLIC_QUESTION_SELECT')[1].split('`;')[0];

    expect(publicReview).not.toContain('patient_id');
    expect(publicReview).not.toContain('patient_name');
    expect(publicReview).not.toContain('appointment_id');
    expect(publicQuestion).not.toContain('paciente_id');
    expect(publicQuestion).not.toContain('paciente_nome');
  });

  it('verifies the Zoom signature before answering endpoint validation', () => {
    const zoomWebhook = read('supabase/functions/zoom-webhook/index.ts');
    const handler = zoomWebhook.slice(zoomWebhook.indexOf('Deno.serve'));

    expect(handler.indexOf('await verifyZoomSignature')).toBeGreaterThan(-1);
    expect(handler.indexOf('await verifyZoomSignature')).toBeLessThan(
      handler.indexOf("eventType === 'endpoint.url_validation'"),
    );
  });
});
