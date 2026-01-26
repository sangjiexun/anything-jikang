import { API_BASE } from "@/utils/constants";
import { baseHeaders } from "@/utils/request";

const Workflow = {
  // 保存工作流
  save: async (name, config, uuid = null) => {
    try {
      const response = await fetch(`${API_BASE}/agent-flows/save`, {
        method: "POST",
        headers: baseHeaders(),
        body: JSON.stringify({ name, config, uuid }),
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Error saving workflow:", error);
      return { success: false, error: error.message };
    }
  },

  // 获取所有工作流
  list: async () => {
    try {
      const response = await fetch(`${API_BASE}/agent-flows/list`, {
        method: "GET",
        headers: baseHeaders(),
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Error listing workflows:", error);
      return { success: false, flows: [], error: error.message };
    }
  },

  // 获取单个工作流
  get: async (uuid) => {
    try {
      const response = await fetch(`${API_BASE}/agent-flows/${uuid}`, {
        method: "GET",
        headers: baseHeaders(),
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Error getting workflow:", error);
      return { success: false, error: error.message };
    }
  },

  // 删除工作流
  delete: async (uuid) => {
    try {
      const response = await fetch(`${API_BASE}/agent-flows/${uuid}`, {
        method: "DELETE",
        headers: baseHeaders(),
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Error deleting workflow:", error);
      return { success: false, error: error.message };
    }
  },

  // 切换工作流状态
  toggle: async (uuid, active) => {
    try {
      const response = await fetch(`${API_BASE}/agent-flows/${uuid}/toggle`, {
        method: "POST",
        headers: baseHeaders(),
        body: JSON.stringify({ active }),
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Error toggling workflow:", error);
      return { success: false, error: error.message };
    }
  },

  // 执行工作流
  run: async (uuid, variables = {}) => {
    try {
      const response = await fetch(`${API_BASE}/agent-flows/${uuid}/run`, {
        method: "POST",
        headers: baseHeaders(),
        body: JSON.stringify({ variables }),
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Error running workflow:", error);
      return { success: false, error: error.message };
    }
  },
};

export default Workflow;
