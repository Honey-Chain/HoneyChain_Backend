import api from "@/lib/axios";
import type {
  HistoricalPredictionsResponse,
  LatestPredictionResponse,
  MLPredictionResponse,
  HarvestYieldResponse,
} from "@/types/prediction";

export const mlService = {
  async predict(
    hiveId: string,
    options: { forceAi?: boolean } = { forceAi: true }
  ): Promise<MLPredictionResponse> {
    const response = await api.post<MLPredictionResponse>(
      `/api/ml/predict/${encodeURIComponent(hiveId)}`,
      {},
      {
        params: {
          forceAi: options.forceAi ?? true,
        },
      }
    );

    return response.data;
  },

  async getHistory(
    hiveId: string,
    page = 1,
    limit = 10,
  ): Promise<HistoricalPredictionsResponse> {
    const response = await api.get<HistoricalPredictionsResponse>(
      `/api/ml/predictions/${encodeURIComponent(hiveId)}`,
      {
        params: { page, limit },
      },
    );

    return response.data;
  },

  async getLatest(hiveId: string): Promise<LatestPredictionResponse> {
    const response = await api.get<LatestPredictionResponse>(
      `/api/ml/latest/${encodeURIComponent(hiveId)}`,
    );

    return response.data;
  },

  async health() {
    return api.get("/api/ml/health");
  },

  /* ==========================================================
     Yield & Harvest Window ML Microservice + Gemini Insights
     ========================================================== */
  async predictYield(
    hiveId: string,
    options: { forceAi?: boolean } = { forceAi: true }
  ): Promise<HarvestYieldResponse> {
    const response = await api.post<HarvestYieldResponse>(
      `/api/ml/yield/predict/${encodeURIComponent(hiveId)}`,
      {},
      {
        params: {
          forceAi: options.forceAi ?? true,
        },
      }
    );

    return response.data;
  },

  async getLatestYield(hiveId: string): Promise<HarvestYieldResponse> {
    const response = await api.get<HarvestYieldResponse>(
      `/api/ml/yield/latest/${encodeURIComponent(hiveId)}`
    );

    return response.data;
  },

  async yieldHealth() {
    return api.get("/api/ml/yield/health");
  },
};