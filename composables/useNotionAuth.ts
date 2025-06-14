import { notionConfig } from "../config/notion.config";

export const useNotionAuth = () => {
  const initiateAuth = () => {
    const params = new URLSearchParams({
      client_id: notionConfig.clientId!,
      redirect_uri: notionConfig.redirectUri,
      response_type: "code",
      owner: "user",
    });

    let combinedScopes = "";

    notionConfig.scopes.forEach((scope) => {
      combinedScopes += `${scope} `;
    });

    params.append("scope", combinedScopes);

    // alert(JSON.stringify(notionConfig));
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
