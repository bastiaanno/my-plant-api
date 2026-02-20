import type {
  Activity,
  ActivitySignup,
  PostWudjeRequest,
  RemoveRegistration,
  User,
  Wud,
} from "./types";

// MMKV integration for React Native
import { createMMKV } from "react-native-mmkv";
const mmkv = createMMKV(); // Use default instance
const isMMKVAvailable = !!mmkv;

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

type Session = string; // This will be the pb_auth cookie value

// React Native compatibility: use global fetch
const fetchFn: typeof fetch = globalThis.fetch.bind(globalThis);

// Storage abstraction for pb_auth cookie
const PB_AUTH_KEY = "pb_auth_cookie";
const USER_DATA_KEY = "pb_user_data";
const storage = {
  set: async (value: string, userData?: any) => {
    if (isMMKVAvailable && mmkv) {
      mmkv.set(PB_AUTH_KEY, value);
      if (userData) mmkv.set(USER_DATA_KEY, JSON.stringify(userData));
    } else {
      storage._memory = value;
      if (userData) storage._user = userData;
    }
  },
  get: async (): Promise<string | null> => {
    if (isMMKVAvailable && mmkv) {
      return mmkv.getString(PB_AUTH_KEY) || null;
    } else {
      return storage._memory || null;
    }
  },
  setUser: async (userData: any) => {
    if (isMMKVAvailable && mmkv) {
      mmkv.set(USER_DATA_KEY, JSON.stringify(userData));
    } else {
      storage._user = userData;
    }
  },
  getUser: async (): Promise<any> => {
    if (isMMKVAvailable && mmkv) {
      const str = mmkv.getString(USER_DATA_KEY);
      return str ? JSON.parse(str) : null;
    } else {
      return storage._user || null;
    }
  },
  _memory: null as string | null,
  _user: null as any,
};

const clearStorage = () => {
  if (isMMKVAvailable && mmkv) {
    mmkv.remove(USER_DATA_KEY);
    mmkv.remove(PB_AUTH_KEY);
  } else {
    storage._memory = null;
    storage._user = null;
  }
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
      await storage.set(pbAuthCookie, data?.user);
      console.log("Login successful, pb_auth cookie and user data stored.");
    }
    return { data, header: setCookie };
  }

  async logout(): Promise<void> {
    clearStorage();
  }
  async getSession(): Promise<Session | null> {
    const pbAuth = await storage.get();
    if (pbAuth) {
      return pbAuth;
    }
    return null;
  }
  async getUser(): Promise<User | null> {
    return await storage.getUser();
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
    const pbAuthCookie = await storage.get();
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
