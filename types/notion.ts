export interface NotionOAuthResponse {
  access_token: string;
  token_type: string;
  bot_id: string;
  workspace_name: string;
  workspace_icon: string;
  workspace_id: string;
  owner: {
    type: "user";
    user: {
      object: "user";
      id: string;
      name: string;
      avatar_url: string;
      type: "person";
      person: {
        email: string;
      };
    };
  };
  duplicated_template_id: string | null;
  request_id: string;
}
