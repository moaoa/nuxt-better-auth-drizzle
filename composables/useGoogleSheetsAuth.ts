export const useGoogleSheetsAuth = () => {
  const config = useRuntimeConfig();

  const googleSheetsConfig = {
    clientId: config.public.GOOGLE_CLIENT_ID,
    clientSecret: config.GOOGLE_CLIENT_SECRET,
    redirectUri: config.public.GOOGLE_REDIRECT_URI,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
  };

  const initiateAuth = () => {
    const params = new URLSearchParams({
      client_id: googleSheetsConfig.clientId,
      redirect_uri: googleSheetsConfig.redirectUri,
      response_type: "code",
      scope: googleSheetsConfig.scopes.join(" "),
      access_type: "offline",
      prompt: "consent",
      state: "google-sheets",
    });

    window.location.href = `${googleSheetsConfig.authUrl}?${params.toString()}`;
  };

  const handleCallback = async (code: string) => {
    try {
      const response = await $fetch("/api/auth/google-sheets/callback", {
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
