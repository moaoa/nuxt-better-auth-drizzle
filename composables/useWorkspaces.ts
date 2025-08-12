import { ref } from "vue";
import { useNuxtApp } from "#app";

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
  const workspaces = ref<Workspace[]>([]);
  const loading = ref(false);
  const error = ref<Error | null>(null);
  const { $api } = useNuxtApp();

  const fetchWorkspaces = async () => {
    loading.value = true;
    error.value = null;

    try {
      const data = await $fetch("/api/workspaces", {
        method: "GET",
      });

      console.log("data: ", data);

      workspaces.value = (data.workspaces || []).map((w) => ({
        id: String(w.workspace.id),
        notion_workspace_id: w.workspace.notion_workspace_id,
        name: w.workspace.workspace_name,
        icon: w.workspace.workspace_icon,
        created_at: w.workspace.createdAt,
      }));

      console.log(
        "====================================================================================="
      );
      console.log(workspaces.value);
    } catch (err) {
      console.error("Failed to fetch workspaces:", err);
      error.value = err as Error;
    } finally {
      loading.value = false;
    }
  };

  return {
    workspaces,
    loading,
    error,
    fetchWorkspaces,
  };
};
