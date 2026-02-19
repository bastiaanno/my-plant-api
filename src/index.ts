import type {
  Activity,
  ActivitySignup,
  PostWudjeRequest,
  RemoveRegistration,
  Wud,
} from "./types";

type LoginResponse = {
  data: {
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
  header: string | null;
};

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

// MMKV integration for React Native
let mmkv: any = null;
let isMMKVAvailable = false;
try {
  // Dynamically require createMMKV if available (for React Native)
  const { createMMKV } = require("react-native-mmkv");
  mmkv = createMMKV(); // Use default instance
  isMMKVAvailable = !!mmkv;
} catch (e) {
  // Not in React Native or MMKV not installed
  isMMKVAvailable = false;
}

// Storage abstraction for pb_auth cookie
const PB_AUTH_KEY = "pb_auth_cookie";
const storage = {
  set: (value: string) => {
    if (isMMKVAvailable && mmkv) {
      mmkv.set(PB_AUTH_KEY, value);
    } else {
      storage._memory = value;
    }
  },
  get: (): string | null => {
    if (isMMKVAvailable && mmkv) {
      return mmkv.getString(PB_AUTH_KEY) || null;
    } else {
      return storage._memory || null;
    }
  },
  _memory: null as string | null,
};

export default class MyPlantClient {
  baseUrl: string;
  constructor(baseUrl = "https://semper-florens.nl/api") {
    this.baseUrl = baseUrl;
  }

  async login(username: string, password: string): Promise<LoginResponse> {
    const res = await fetchFn(`${this.baseUrl}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: username, password: password }),
    });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    // Try to get pb_auth cookie from Set-Cookie header
    const setCookie =
      res.headers.get("set-cookie") || res.headers.get("Set-Cookie");
    let pbAuthCookie = null;
    if (setCookie) {
      // Find pb_auth cookie value
      const match = setCookie.match(/pb_auth=([^;]+);/);
      if (match) {
        pbAuthCookie = match[1];
      }
    }
    if (pbAuthCookie) {
      storage.set(pbAuthCookie);
    }
    return { data, header: setCookie };
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
    return this._request("DELETE", `/activities/${info.id}`, info);
  }

  async getWudjes(): Promise<Wud[]> {
    return (await this._request("GET", "/wudjes")).items;
  }

  async postWudje(info: PostWudjeRequest) {
    return this._request("POST", "/wudjes", info);
  }

  async _request(method: "GET" | "POST" | "DELETE", path: string, body?: any) {
    const pbAuthCookie = storage.get();
    if (!pbAuthCookie && path !== "/login") {
      throw new Error("Not authenticated. Please login first.");
    }
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    const fetchOptions: any = {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    };
    if (pbAuthCookie) {
      headers["Cookie"] = `pb_auth=${pbAuthCookie}`;
    }
    const res = await fetchFn(`${this.baseUrl}${path}`, fetchOptions);
    if (!res.ok)
      throw new Error(`Request failed: ${res.status}, ${await res.text()}`);
    return await res.json();
  }
}
