import fs from 'fs';
import path from 'path';
import { test, expect } from '../support/fixtures';

test.describe('configuracao de cobertura de planos', () => {
  test('check-plan-coverage esta registrada no config.toml', async () => {
    const configPath = path.join(process.cwd(), 'supabase', 'config.toml');
    const config = fs.readFileSync(configPath, 'utf8');

    expect(config).toContain('[functions.check-plan-coverage]');
    expect(config).toMatch(/\[functions\.check-plan-coverage\]\s+verify_jwt\s*=\s*false/);
  });
});
