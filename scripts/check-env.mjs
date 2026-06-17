const required = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) {
  console.error(`Missing frontend env values: ${missing.join(', ')}`);
  process.exit(1);
}
console.log('Frontend Supabase env values are present.');
