/**
 * Test register with email that Resend sandbox would reject.
 * Usage: node scripts/test-register-email.js
 */
const API = process.env.API_URL || 'http://localhost:3000';

async function main() {
  const email = `test_${Date.now()}@gmail.com`;
  const password = 'Test1234!';

  const res = await fetch(`${API}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password,
      confirmPassword: password,
      acceptTerms: true,
      confirmAge: true,
    }),
  });

  const body = await res.json();
  console.log('status:', res.status);
  console.log('email:', email);
  console.log('token:', body.token ? 'yes' : 'no');
  console.log('devVerifyUrl:', body.devVerifyUrl ? 'yes' : 'no');
  console.log('message:', body.message);

  if (res.status !== 201) {
    console.error('FAIL:', body);
    process.exit(1);
  }
  if (!body.token) {
    console.error('FAIL: no token');
    process.exit(1);
  }
  console.log('\nRegister OK — account created even when email fails.');
  process.exit(0);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
