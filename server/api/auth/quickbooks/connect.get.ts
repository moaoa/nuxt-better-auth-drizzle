export default defineEventHandler((event) => {
  const config = useRuntimeConfig();
  const clientId = config.public.QUICKBOOKS_OAUTH_CLIENT_ID;
  const redirectUri = config.public.QUICKBOOKS_OAUTH_REDIRECT_URI;
  const quickbooksAuthUrl = `https://appcenter.intuit.com/connect/oauth2?client_id=${clientId}&response_type=code&scope=com.intuit.quickbooks.accounting&redirect_uri=${redirectUri}`;

  // Redirect the user to QuickBooks' OAuth authorization page
  return sendRedirect(event, quickbooksAuthUrl);
});