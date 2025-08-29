export const useNotionAuth = () => {
  const config = useRuntimeConfig();

  const notionConfig = {
    clientId: config.public.NOTION_OAUTH_CLIENT_ID,
    clientSecret: config.NOTION_OAUTH_CLIENT_SECRET,
    redirectUri: config.public.NOTION_OAUTH_REDIRECT_URI,
    scopes: ["read_user", "write_user", "read_blocks", "write_blocks"],
    authUrl: config.public.NOTION_AUTH_URL,
    notionTokenUrl: config.public.NOTION_TOKEN_URL,
  };

  const initiateAuth = () => {
    const params = new URLSearchParams({
      client_id: notionConfig.clientId,
      redirect_uri: notionConfig.redirectUri,
      response_type: "code",
      owner: "user",
      state: "notion",
    });

    let combinedScopes = "";

    notionConfig.scopes.forEach((scope) => {
      combinedScopes += `${scope} `;
    });

    params.append("scope", combinedScopes);

    window.location.href = `${notionConfig.authUrl}?${params.toString()}`;
  };

  const handleCallback = async (code: string) => {
    try {
      const response = await $fetch("/api/auth/notion/callback", {
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
