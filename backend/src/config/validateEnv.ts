/**
 * Validates required environment variables on startup
 * Fails fast with clear error messages if critical config is missing
 */
export function validateRequiredEnv(): void {
  const required = [
    'DATABASE_URL',
    'JWT_SECRET',
    'CORS_ORIGIN',
  ];

  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    console.error('❌ FATAL: Missing required environment variables:');
    missing.forEach(key => console.error(`   - ${key}`));
    console.error('\nServer cannot start safely. Exiting.');
    process.exit(1);
  }

  // Validate JWT_SECRET strength
  const jwtSecret = process.env.JWT_SECRET!;
  if (jwtSecret.length < 32) {
    console.error('❌ FATAL: JWT_SECRET must be at least 32 characters');
    console.error(`   Current length: ${jwtSecret.length}`);
    process.exit(1);
  }

  // Warn about insecure default (in case someone set it explicitly)
  if (jwtSecret.includes('change-in-production')) {
    console.error('❌ FATAL: JWT_SECRET contains default/example value');
    console.error('   Generate a secure secret: openssl rand -base64 32');
    process.exit(1);
  }

  console.log('✓ Environment validation passed');
  console.log(`  - DATABASE_URL: ${process.env.DATABASE_URL?.substring(0, 20)}...`);
  console.log(`  - JWT_SECRET: ${jwtSecret.length} characters`);
  console.log(`  - CORS_ORIGIN: ${process.env.CORS_ORIGIN}`);
}
