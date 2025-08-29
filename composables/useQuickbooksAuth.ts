export const useQuickbooksAuth = () => {
  const config = useRuntimeConfig();

  const quickbooksConfig = {
    clientId: config.public.QUICKBOOKS_CLIENT_ID,
    clientSecret: config.QUICKBOOKS_CLIENT_SECRET,
    redirectUri: config.public.QUICKBOOKS_REDIRECT_URI,
    scopes: ["com.intuit.quickbooks.accounting"],
    authUrl: "https://appcenter.intuit.com/connect/oauth2",
    tokenUrl: "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer",
  };

  const initiateAuth = () => {
    const params = new URLSearchParams({
      client_id: quickbooksConfig.clientId,
      redirect_uri: quickbooksConfig.redirectUri,
      response_type: "code",
      scope: quickbooksConfig.scopes.join(" "),
      state: "quickbooks",
    });

    window.location.href = `${quickbooksConfig.authUrl}?${params.toString()}`;
  };

  const handleCallback = async (code: string) => {
    try {
      const response = await $fetch("/api/auth/quickbooks/callback", {
        method: "POST",
        body: { code },
      });
      return response;
    } catch (error) {
      console.error("Error handling callback:", error);
      throw error;
    }
  };

  return {
    initiateAuth,
    handleCallback,
  };
};
