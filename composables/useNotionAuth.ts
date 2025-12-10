export const useNotionAuth = () => {
  const config = useRuntimeConfig();

  const notionConfig = {
    clientId: config.public.NOTION_OAUTH_CLIENT_ID,
    redirectUri: config.public.NOTION_OAUTH_REDIRECT_URI,
    scopes: [
      "read_user",
      "write_user",
      "read_blocks",
      "write_blocks",
      "read_pages",
      "write_pages",
      "read_databases",
      "write_databases",
    ],
    authUrl: config.public.NOTION_AUTH_URL,
    notionTokenUrl: config.public.NOTION_TOKEN_URL,
  };

  const initiateAuth = (connectPage?: string) => {
    const params = new URLSearchParams({
      client_id: notionConfig.clientId,
      redirect_uri: notionConfig.redirectUri,
      response_type: "code",
      owner: "user",
    });
    
    // Only add state if provided and not undefined
    if (connectPage) {
      params.append("state", connectPage);
    }

    const combinedScopes = notionConfig.scopes.join(" ");

    params.append("scope", combinedScopes);

    window.location.href = `${notionConfig.authUrl}?${params.toString()}`;
  };

  type CallbackParams = {
    code: string;
  };

  const handleCallback = async ({ code }: CallbackParams) => {
    try {
      const response = await $fetch("/api/auth/notion/callback", {
        method: "POST",
        body: { code, redirect_uri: notionConfig.redirectUri },
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
