import { describe, expect, it } from 'vitest';
import { renderNotificationTemplate } from '../../../supabase/functions/_shared/notifications/NotificationRenderer.ts';

describe('renderNotificationTemplate', () => {
  it('renders known placeholders as plain text', () => {
    expect(renderNotificationTemplate('Seu agendamento com {{professional_name}} foi aceito.', {
      professional_name: 'Dra. Maria',
    })).toBe('Seu agendamento com Dra. Maria foi aceito.');
  });

  it('replaces missing and null placeholders with an empty string', () => {
    expect(renderNotificationTemplate('{{missing}}/{{value}}', { value: null })).toBe('/');
  });

  it('normalizes primitive values without executing markup', () => {
    expect(renderNotificationTemplate('Valor: {{amount}} {{content}}', {
      amount: 42.5,
      content: '<script>alert(1)</script>',
    })).toBe('Valor: 42.5 <script>alert(1)</script>');
  });
});
