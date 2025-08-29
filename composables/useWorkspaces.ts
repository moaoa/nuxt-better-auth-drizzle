import { useQuery } from "@tanstack/vue-query";

interface ApiWorkspace {
  id: number;
  uuid: string;
  bot_id: string | null;
  notion_workspace_id: string;
  workspace_name: string;
  workspace_icon: string | null;
  duplicated_template_id: string | null;
  request_id: string | null;
  owner: unknown;
  createdAt: Date;
  updatedAt: Date;
}

interface ApiResponse {
  workspaces: Array<{
    workspace: ApiWorkspace;
  }>;
}

export interface Workspace {
  id: string;
  notion_workspace_id: string;
  name: string;
  icon: string | null;
  created_at: string;
}

export const useWorkspaces = () => {
  const { data: workspaces, isLoading: loading, error } = useQuery({
    queryKey: ['workspaces'],
    queryFn: async () => {
      const data = await $fetch("/api/workspaces", {
        method: "GET",
      });

      return (data.workspaces || []).map((w) => ({
        id: String(w.workspace.id),
        notion_workspace_id: w.workspace.notion_workspace_id,
        name: w.workspace.workspace_name,
        icon: w.workspace.workspace_icon,
        created_at: w.workspace.createdAt,
      }));
    }
  });

  return {
    workspaces,
    loading,
    error,
  };
};
