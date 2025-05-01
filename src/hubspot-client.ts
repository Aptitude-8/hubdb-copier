import axios, { AxiosInstance } from "axios";
import FormData from "form-data";
import {
  TableListResponse,
  TableCreateRequest,
  HubDBTable,
  ImportConfig,
  HubDBColumn,
} from "./types";

export class HubSpotClient {
  private client: AxiosInstance;
  private baseUrl = "https://api.hubapi.com";

  constructor(private apiKey: string) {
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
    });
  }

  async listTables(after?: string): Promise<TableListResponse> {
    try {
      const params = after ? { after } : {};
      const response = await this.client.get("/cms/v3/hubdb/tables", {
        params,
      });

      if (!response.data || typeof response.data !== "object") {
        throw new Error("Invalid API response format");
      }

      if (!Array.isArray(response.data.results)) {
        response.data.results = [];
      }

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        console.error("HubSpot API Error:", {
          status: error.response.status,
          data: error.response.data,
        });
      }
      throw error;
    }
  }

  async createTable(table: TableCreateRequest): Promise<HubDBTable> {
    try {
      const response = await this.client.post("/cms/v3/hubdb/tables", table);

      if (!response.data || !response.data.id) {
        console.error("Invalid create table response:", response.data);
        throw new Error("Invalid response from create table API");
      }

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error("Create table error:", {
          status: error.response?.status,
          data: error.response?.data,
          url: error.config?.url,
          method: error.config?.method,
          headers: error.config?.headers,
        });
      }
      throw error;
    }
  }

  async exportTable(tableId: string): Promise<string> {
    try {
      const response = await this.client.get(
        `/cms/v3/hubdb/tables/${tableId}/draft/export`,
        {
          headers: {
            accept: "application/vnd.ms-excel",
          },
          responseType: "text",
        }
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        // Try exporting the published version if draft doesn't exist
        const response = await this.client.get(
          `/cms/v3/hubdb/tables/${tableId}/export`,
          {
            headers: {
              accept: "application/vnd.ms-excel",
            },
            responseType: "text",
          }
        );
        return response.data;
      }
      throw error;
    }
  }

  async importTable(
    tableId: string,
    csvContent: string,
    config: ImportConfig = {}
  ): Promise<void> {
    const formData = new FormData();
    formData.append("file", Buffer.from(csvContent), {
      filename: "table-data.csv",
      contentType: "text/csv",
    });

    const importConfig = {
      skipRows: 1,
      format: "csv",
      separator: ",",
      encoding: "utf-8",
      columnMappings: config.columnMappings || [],
      resetTable: true,
      ...config,
    };

    formData.append("config", JSON.stringify(importConfig));

    try {
      await this.client.post(
        `/cms/v3/hubdb/tables/${tableId}/draft/import`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
          },
        }
      );
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        console.error("Import error:", {
          status: error.response.status,
          message: error.response.data.message || error.message,
        });
      }
      throw error;
    }
  }

  async publishTable(tableId: string): Promise<HubDBTable> {
    const response = await this.client.post(
      `/cms/v3/hubdb/tables/${tableId}/draft/publish`
    );
    return response.data;
  }

  async getTableByName(name: string): Promise<HubDBTable | null> {
    try {
      console.log("Searching for table by name:", name);
      const response = await this.client.get(`/cms/v3/hubdb/tables/${name}`);

      if (response.data && response.data.id && response.data.name) {
        console.log(`Table found with name ${name} and id ${response.data.id}`);
        return response.data;
      } else {
        console.error("Invalid get table by name response:", response.data);
        throw new Error("Invalid response from get table by name API");
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error("Get table by name error:", {
          status: error.response?.status,
          data: error.response?.data,
        });
      }
      // If the error status is 404, it means the table doesn't exist so return null
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        console.log("No table found with the given name", name);
        return null;
      } else {
        // For other errors, rethrow
        throw error;
      }
    }
  }

  async addColumnsToTable(
    tableId: string,
    columns: HubDBColumn[],
    name: string,
    label: string
  ): Promise<void> {
    try {
      console.log("Adding columns to table", tableId, name, label, columns);
      const response = await this.client.patch(
        `/cms/v3/hubdb/tables/${tableId}/draft`,
        {
          columns: columns,
          name: name,
          label: label,
        }
      );

      if (!response.data || !response.data.id) {
        console.error("Invalid add columns response:", response.data);
        throw new Error("Invalid response from add columns API");
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error("Add columns to table error:", {
          status: error.response?.status,
          data: error.response?.data,
        });
      }
      throw error;
    }
  }
}
