// MMKV integration for React Native
import { createMMKV } from "react-native-mmkv";
const mmkv = createMMKV(); // Use default instance
const isMMKVAvailable = !!mmkv;
// Session type removed; cookie is stored directly
// React Native compatibility: use global fetch
const fetchFn = globalThis.fetch.bind(globalThis);
// Storage abstraction for pb_auth cookie (full cookie string)
const PB_AUTH_KEY = "pb_auth_cookie";
const USER_DATA_KEY = "pb_user_data";
const storage = {
    setCookie: async (cookie) => {
        if (isMMKVAvailable && mmkv) {
            mmkv.set(PB_AUTH_KEY, cookie);
        }
        else {
            storage._cookie = cookie;
        }
    },
    getCookie: async () => {
        if (isMMKVAvailable && mmkv) {
            return mmkv.getString(PB_AUTH_KEY) || null;
        }
        else {
            return storage._cookie || null;
        }
    },
    setUser: async (userData) => {
        if (isMMKVAvailable && mmkv) {
            mmkv.set(USER_DATA_KEY, JSON.stringify(userData));
        }
        else {
            storage._user = userData;
        }
    },
    getUser: async () => {
        if (isMMKVAvailable && mmkv) {
            const str = mmkv.getString(USER_DATA_KEY);
            return str ? JSON.parse(str) : null;
        }
        else {
            return storage._user || null;
        }
    },
    _cookie: null,
    _user: null,
};
const clearStorage = () => {
    if (isMMKVAvailable && mmkv) {
        mmkv.remove(USER_DATA_KEY);
        mmkv.remove(PB_AUTH_KEY);
    }
    else {
        storage._cookie = null;
        storage._user = null;
    }
};
export default class MyPlantClient {
    constructor(baseUrl = "https://semper-florens.nl/api") {
        this.baseUrl = baseUrl;
    }
    async login(username, password) {
        const res = await fetchFn(`${this.baseUrl}/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: username, password: password }),
            credentials: "include", // Ensure cookies are handled automatically
        });
        if (!res.ok)
            throw new Error(await res.text());
        const data = await res.json();
        // Store full cookie string if present
        const setCookie = res.headers.get("set-cookie") || res.headers.get("Set-Cookie");
        if (setCookie) {
            await storage.setCookie(setCookie);
        }
        if (data?.user)
            await storage.setUser(data.user);
        return { data, header: setCookie };
    }
    async logout() {
        clearStorage();
    }
    async getUser() {
        return await storage.getUser();
    }
    async getActivities() {
        return (await this._request("GET", "/activities")).data;
    }
    async getActivity({ activityId }) {
        return (await this._request("GET", `/activities/${activityId}`)).activity;
    }
    async joinActivity(id, info) {
        return this._request("POST", `/activities/${id}`, info);
    }
    async removeActivity(info) {
        return this._request("DELETE", `/activities/${info.id}`, info);
    }
    async getWudjes() {
        return (await this._request("GET", "/wudjes")).items;
    }
    async postWudje(info) {
        return this._request("POST", "/wudjes", info);
    }
    async _request(method, path, body) {
        // No manual session token check; rely on cookie
        const cookie = await storage.getCookie();
        const headers = {
            "Content-Type": "application/json",
        };
        const fetchOptions = {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined,
            credentials: "include", // Ensure cookies are handled automatically
        };
        // Optionally attach cookie header if needed (for environments where fetch doesn't handle cookies)
        if (cookie) {
            headers["Cookie"] = cookie;
        }
        const res = await fetchFn(`${this.baseUrl}${path}`, fetchOptions);
        // Update stored cookie if present in response
        const setCookie = res.headers.get("set-cookie") || res.headers.get("Set-Cookie");
        if (setCookie) {
            await storage.setCookie(setCookie);
        }
        if (!res.ok) {
            throw new Error(`Request failed: ${res.status}, ${await res.text()}`);
        }
        return await res.json();
    }
}
