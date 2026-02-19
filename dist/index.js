// React Native compatibility: use global fetch if available, otherwise require node-fetch
const getFetch = () => {
    if (typeof globalThis.fetch === "function") {
        return globalThis.fetch.bind(globalThis);
    }
    // For Node.js environments
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require("node-fetch");
};
const fetchFn = getFetch();
// MMKV integration for React Native
let mmkv = null;
let isMMKVAvailable = false;
try {
    // Dynamically require createMMKV if available (for React Native)
    const { createMMKV } = require("react-native-mmkv");
    mmkv = createMMKV(); // Use default instance
    isMMKVAvailable = !!mmkv;
}
catch (e) {
    // Not in React Native or MMKV not installed
    isMMKVAvailable = false;
}
// Storage abstraction for pb_auth cookie
const PB_AUTH_KEY = "pb_auth_cookie";
const storage = {
    set: (value) => {
        if (isMMKVAvailable && mmkv) {
            mmkv.set(PB_AUTH_KEY, value);
        }
        else {
            storage._memory = value;
        }
    },
    get: () => {
        if (isMMKVAvailable && mmkv) {
            return mmkv.getString(PB_AUTH_KEY) || null;
        }
        else {
            return storage._memory || null;
        }
    },
    _memory: null,
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
        });
        if (!res.ok)
            throw new Error(await res.text());
        const data = await res.json();
        // Try to get pb_auth cookie from Set-Cookie header
        const setCookie = res.headers.get("set-cookie") || res.headers.get("Set-Cookie");
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
        const pbAuthCookie = storage.get();
        if (!pbAuthCookie && path !== "/login") {
            throw new Error("Not authenticated. Please login first.");
        }
        const headers = {
            "Content-Type": "application/json",
        };
        const fetchOptions = {
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
