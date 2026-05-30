import fs from 'fs';
import path from 'path';
import { test, expect } from '../support/fixtures';

test.describe('configuração de cobrança', () => {
  test('ensure-payment-charge está registrada no config.toml', async () => {
    const configPath = path.join(process.cwd(), 'supabase', 'config.toml');
    const config = fs.readFileSync(configPath, 'utf8');

    expect(config).toContain('[functions.ensure-payment-charge]');
    expect(config).toMatch(/\[functions\.ensure-payment-charge\]\s+verify_jwt\s*=\s*false/);
  });

  test('create-plan-checkout esta registrada no config.toml', async () => {
    const configPath = path.join(process.cwd(), 'supabase', 'config.toml');
    const config = fs.readFileSync(configPath, 'utf8');

    expect(config).toContain('[functions.create-plan-checkout]');
    expect(config).toMatch(/\[functions\.create-plan-checkout\]\s+verify_jwt\s*=\s*false/);
  });
});
