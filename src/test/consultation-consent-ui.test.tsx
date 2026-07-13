import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ConsultationConsentGate from '@/components/teleconsulta/ConsultationConsentGate';

describe('consultation consent gate', () => {
  it('starts with transcription unselected and keeps it separate from telemedicine', () => {
    render(<ConsultationConsentGate consents={null} onRecordDecision={vi.fn()} />);
    expect(screen.getByLabelText(/autorizo a realização desta consulta por telemedicina/i)).not.toBeChecked();
    expect(screen.getByLabelText('Autorizar transcrição')).not.toBeChecked();
    expect(screen.getByLabelText('Continuar sem transcrição')).not.toBeChecked();
    expect(screen.getByRole('button', { name: /confirmar escolhas/i })).toBeDisabled();
  });

  it('allows continuing without transcription and does not record an AI acknowledgement', async () => {
    const record = vi.fn().mockResolvedValue({});
    render(<ConsultationConsentGate consents={null} onRecordDecision={record} />);
    fireEvent.click(screen.getByLabelText(/autorizo a realização desta consulta por telemedicina/i));
    fireEvent.click(screen.getByLabelText('Continuar sem transcrição'));
    fireEvent.click(screen.getByRole('button', { name: /confirmar escolhas/i }));

    await waitFor(() => expect(record).toHaveBeenCalledTimes(2));
    expect(record.mock.calls[0][0]).toMatchObject({
      consentKey: 'consultation_transcription_consent',
      decision: 'declined',
    });
    expect(record.mock.calls[1][0]).toMatchObject({
      consentKey: 'telemedicine_consent',
      decision: 'granted',
    });
  });

  it('requires the separate AI notice before enabling transcription', () => {
    render(<ConsultationConsentGate consents={null} onRecordDecision={vi.fn()} />);
    fireEvent.click(screen.getByLabelText(/autorizo a realização desta consulta por telemedicina/i));
    fireEvent.click(screen.getByLabelText('Autorizar transcrição'));
    expect(screen.getByLabelText(/li o aviso sobre assistência de ia/i)).not.toBeChecked();
    expect(screen.getByRole('button', { name: /confirmar escolhas/i })).toBeDisabled();
  });
});
