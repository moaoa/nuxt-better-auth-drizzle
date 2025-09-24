export const useGoogleSheetsAuth = () => {
  const config = useRuntimeConfig();

  const googleSheetsConfig = {
    clientId: config.public.GOOGLE_SHEETS_CLIENT_ID,
    clientSecret: config.GOOGLE_SHEETS_CLIENT_SECRET,
    redirectUri: config.public.NOTION_TO_GOOGLE_SHEETS_REDIRECT_URI,
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/userinfo.profile",
    ],
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
  };

  const initiateAuth = (state: string = "google-sheets") => {
    const params = new URLSearchParams({
      client_id: googleSheetsConfig.clientId,
      redirect_uri: googleSheetsConfig.redirectUri,
      response_type: "code",
      scope: googleSheetsConfig.scopes.join(" "),
      access_type: "offline",
      prompt: "consent",
      state,
    });

    window.location.href = `${googleSheetsConfig.authUrl}?${params.toString()}`;
  };

  const handleCallback = async (params: {
    code: string;
    redirect_uri: string;
  }) => {
    try {
      console.log("params", params);

      const response = await $fetch("/api/auth/google-sheets/callback", {
        method: "POST",
        body: params,
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
