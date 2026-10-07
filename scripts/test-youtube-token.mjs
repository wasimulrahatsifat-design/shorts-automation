import { google } from 'googleapis';

const clientId = process.argv[2] || process.env.YOUTUBE_CLIENT_ID;
const clientSecret = process.argv[3] || process.env.YOUTUBE_CLIENT_SECRET;
const refreshToken = process.argv[4] || process.env.YOUTUBE_REFRESH_TOKEN;

if (!clientId || !clientSecret || !refreshToken) {
  console.log('Usage: node scripts/test-youtube-token.mjs <CLIENT_ID> <CLIENT_SECRET> <REFRESH_TOKEN>');
  console.log('Or set YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REFRESH_TOKEN in your environment.');
  process.exit(1);
}

console.log('Testing YouTube OAuth credentials...');
const oauth2Client = new google.auth.OAuth2(
  clientId.trim(),
  clientSecret.trim(),
  'https://developers.google.com/oauthplayground'
);

oauth2Client.setCredentials({ refresh_token: refreshToken.trim() });

oauth2Client.getAccessToken()
  .then(async ({ token }) => {
    console.log('✅ Authentication SUCCESSFUL!');
    console.log('✅ Access token successfully generated from refresh token.');
    const info = await oauth2Client.getTokenInfo(token);
    console.log('✅ Authorized Scopes:', info.scopes);
    if (info.scopes.includes('https://www.googleapis.com/auth/youtube.upload')) {
      console.log('🎯 YouTube Upload Scope (youtube.upload) is ACTIVE and READY!');
    }
  })
  .catch(err => {
    console.error('❌ Authentication FAILED:', err.message || err);
  });
