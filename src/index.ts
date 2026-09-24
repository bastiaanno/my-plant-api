import type {
  Activity,
  ActivitySignup,
  ApiError,
  ApiStatus,
  PostWudjeRequest,
  RemoveRegistration,
  Wud,
} from "./types";

type LoginResponse = {
  success: boolean;
  token: string;
  user: {
    id: string;
    email: string;
    username: string;
    name: string;
    isAdmin: boolean;
    registrationDate: Date;
  };
};

export type { ApiError, ApiStatus };

// React Native compatibility: use global fetch if available, otherwise require node-fetch
const getFetch = () => {
  if (typeof globalThis.fetch === "function") {
    return globalThis.fetch.bind(globalThis);
  }
  // For Node.js environments
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require("node-fetch");
};

const fetchFn: typeof fetch = getFetch();

export default class MyPlantClient {
  baseUrl: string;
  token: string | null;
  constructor(baseUrl = "https://semper-florens.nl/api") {
    this.baseUrl = baseUrl;
    this.token = null;
  }

  async login(username: string, password: string): Promise<LoginResponse> {
    const res = await fetchFn(`${this.baseUrl}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: username, password: password }),
    });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    this.token = data.token;
    return data;
  }

  async getActivities(): Promise<Activity[]> {
    return (await this._request("GET", "/activities")).data;
  }

  async getActivity({ activityId }: { activityId: string }): Promise<Activity> {
    return (await this._request("GET", `/activities/${activityId}`)).activity;
  }

  async joinActivity(id: string, info: ActivitySignup) {
    return this._request("POST", `/activities/${id}`, info);
  }

  async removeActivity(info: RemoveRegistration) {
    return this._request("DELETE", `/activities/${info.activityId}`, {
      type: "signup",
    });
  }

  async getWudjes(): Promise<Wud[]> {
    return (await this._request("GET", "/wudjes")).items;
  }

  async postWudje(info: PostWudjeRequest) {
    return this._request("POST", "/wudjes", info);
  }

  async _request(method: "GET" | "POST" | "DELETE", path: string, body?: any) {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.token) headers["Authorization"] = `Bearer ${this.token}`;
    const res = await fetchFn(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const error: ApiError = {
        message: `Request failed: ${res.status} ${res.statusText}`,
        status: res.status,
        isAuthError: res.status === 401 || res.status === 403,
        isNetworkError: false,
      };
      throw error;
    }
    return await res.json();
  }

  getApiStatus(): ApiStatus {
    return {
      isAvailable: true,
      error: null,
      isLoading: false,
    };
  }

  createApiError(status: number, message: string, isNetworkError = false): ApiError {
    return {
      message,
      status,
      isAuthError: status === 401 || status === 403,
      isNetworkError,
    };
  }
}
