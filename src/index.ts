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

export type Session = {
  token: string;
  expirationDate?: Date;
};

// React Native compatibility: use global fetch
const fetchFn: typeof fetch = globalThis.fetch.bind(globalThis);

// Storage abstraction for pb_auth cookie
const PB_AUTH_KEY = "pb_auth_cookie";
const USER_DATA_KEY = "pb_user_data";
const SESSION_KEY = "pb_session";
const storage = {
  setSession: async (session: Session) => {
    // Ensure token is not double-encoded
    let token = session.token;
    try {
      // If token is a JSON string, parse and extract token
      const parsed = JSON.parse(decodeURIComponent(token));
      if (parsed && parsed.token) {
        token = parsed.token;
      }
    } catch (e) {
      // Not JSON, keep as is
    }
    const sessionToStore = { ...session, token };
    if (isMMKVAvailable && mmkv) {
      mmkv.set(SESSION_KEY, JSON.stringify(sessionToStore));
    } else {
      storage._session = sessionToStore;
    }
  },
  getSession: async (): Promise<Session | null> => {
    if (isMMKVAvailable && mmkv) {
      const str = mmkv.getString(SESSION_KEY);
      if (!str) return null;
      const obj = JSON.parse(str);
      if (obj && obj.expirationDate) {
        obj.expirationDate = new Date(obj.expirationDate);
      }
      return obj;
    } else {
      const obj = storage._session || null;
      if (obj && obj.expirationDate && typeof obj.expirationDate === "string") {
        obj.expirationDate = new Date(obj.expirationDate);
      }
      return obj;
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
  _session: null as Session | null,
  _user: null as any,
};

const clearStorage = () => {
  if (isMMKVAvailable && mmkv) {
    mmkv.remove(USER_DATA_KEY);
    mmkv.remove(SESSION_KEY);
  } else {
    storage._session = null;
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
    let expirationDate: Date | undefined = undefined;
    if (setCookie) {
      // Find pb_auth cookie value
      const pb_auth_ = setCookie.match(/pb_auth=([^;]+);/);
      const expires_ = setCookie.match(/Expires=([^;]+);/);
      if (pb_auth_) {
        pbAuthCookie = pb_auth_[1];
      }
      if (expires_) {
        expirationDate = new Date(expires_[1]);
      }
    }
    if (pbAuthCookie) {
      await storage.setSession({ token: pbAuthCookie, expirationDate });
      if (data?.user) await storage.setUser(data.user);
      console.log("Login successful, session and user data stored.");
    }
    return { data, header: setCookie };
  }

  async logout(): Promise<void> {
    clearStorage();
  }
  async getSession(): Promise<Session | null> {
    return await storage.getSession();
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
    const session = await storage.getSession();
    if ((!session || !session.token) && path !== "/login") {
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
    if (session && session.token) {
      headers["Cookie"] = `pb_auth=${session.token}`;
    }
    const res = await fetchFn(`${this.baseUrl}${path}`, fetchOptions);
    // Extract and update session cookie if present in response
    const setCookie =
      res.headers.get("set-cookie") || res.headers.get("Set-Cookie");
    if (setCookie) {
      // Find pb_auth cookie value
      const pb_auth_ = setCookie.match(/pb_auth=([^;]+);/);
      const expires_ = setCookie.match(/Expires=([^;]+);/);
      let pbAuthCookie = null;
      let expirationDate = undefined;
      if (pb_auth_) {
        pbAuthCookie = pb_auth_[1];
      }
      if (expires_) {
        expirationDate = new Date(expires_[1]);
      }
      if (pbAuthCookie) {
        await storage.setSession({ token: pbAuthCookie, expirationDate });
      }
    }
    if (!res.ok)
      throw new Error(`Request failed: ${res.status}, ${await res.text()}`);
    return await res.json();
  }
}
