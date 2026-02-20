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
const USER_DATA_KEY = "pb_user_data";
const isNode = typeof process !== "undefined" && process.versions && process.versions.node;
const isReactNative = typeof navigator !== "undefined" && navigator.product === "ReactNative";
let fs = null;
let path = null;
let COOKIE_FILE = "./pb_auth_cookie";
function isReactNativeEnv() {
    // React Native sets navigator.product to 'ReactNative'
    return typeof navigator !== "undefined" && navigator.product === "ReactNative";
}
const storage = {
    set: async (value, userData) => {
        if (isMMKVAvailable && mmkv) {
            console.log("[storage] Using MMKV for pb_auth");
            mmkv.set(PB_AUTH_KEY, value);
            if (userData)
                mmkv.set(USER_DATA_KEY, JSON.stringify(userData));
        }
        else if (isNode && !isReactNativeEnv()) {
            if (!fs || !path) {
                fs = await import("fs");
                path = await import("path");
                COOKIE_FILE = path.join(process.cwd(), ".pb_auth_cookie");
            }
            try {
                console.log(`[storage] Writing pb_auth to file: ${COOKIE_FILE}`);
                fs.writeFileSync(COOKIE_FILE, value, { encoding: "utf8" });
                if (userData) {
                    const userFile = COOKIE_FILE + ".user";
                    fs.writeFileSync(userFile, JSON.stringify(userData), {
                        encoding: "utf8",
                    });
                }
            }
            catch (e) {
                console.log(`[storage] File write failed, falling back to memory: ${e}`);
                storage._memory = value;
                if (userData)
                    storage._user = userData;
            }
        }
        else {
            console.log("[storage] Using in-memory storage for pb_auth");
            storage._memory = value;
            if (userData)
                storage._user = userData;
        }
    },
    get: async () => {
        if (isMMKVAvailable && mmkv) {
            console.log("[storage] Reading pb_auth from MMKV");
            return mmkv.getString(PB_AUTH_KEY) || null;
        }
        else if (isNode && !isReactNativeEnv()) {
            if (!fs || !path) {
                fs = await import("fs");
                path = await import("path");
                COOKIE_FILE = path.join(process.cwd(), ".pb_auth_cookie");
            }
            try {
                if (fs.existsSync(COOKIE_FILE)) {
                    console.log(`[storage] Reading pb_auth from file: ${COOKIE_FILE}`);
                    return fs.readFileSync(COOKIE_FILE, { encoding: "utf8" }) || null;
                }
                else {
                    console.log(`[storage] Cookie file not found: ${COOKIE_FILE}`);
                }
            }
            catch (e) {
                console.log(`[storage] File read failed, falling back to memory: ${e}`);
                return storage._memory || null;
            }
            return storage._memory || null;
        }
        else {
            console.log("[storage] Reading pb_auth from memory");
            return storage._memory || null;
        }
    },
    setUser: async (userData) => {
        if (isMMKVAvailable && mmkv) {
            mmkv.set(USER_DATA_KEY, JSON.stringify(userData));
        }
        else if (isNode && !isReactNativeEnv()) {
            if (!fs || !path) {
                fs = await import("fs");
                path = await import("path");
                COOKIE_FILE = path.join(process.cwd(), ".pb_auth_cookie");
            }
            try {
                const userFile = COOKIE_FILE + ".user";
                fs.writeFileSync(userFile, JSON.stringify(userData), {
                    encoding: "utf8",
                });
            }
            catch (e) {
                storage._user = userData;
            }
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
        else if (isNode && !isReactNativeEnv()) {
            if (!fs || !path) {
                fs = await import("fs");
                path = await import("path");
                COOKIE_FILE = path.join(process.cwd(), ".pb_auth_cookie");
            }
            try {
                const userFile = COOKIE_FILE + ".user";
                if (fs.existsSync(userFile)) {
                    return JSON.parse(fs.readFileSync(userFile, { encoding: "utf8" }));
                }
            }
            catch (e) {
                return storage._user || null;
            }
            return storage._user || null;
        }
        else {
            return storage._user || null;
        }
    },
    _memory: null,
    _user: null,
};
const clearStorage = () => {
    if (isMMKVAvailable && mmkv) {
        mmkv.delete(PB_AUTH_KEY);
    }
    else if (fs && COOKIE_FILE) {
        try {
            if (fs.existsSync(COOKIE_FILE)) {
                fs.unlinkSync(COOKIE_FILE);
            }
        }
        catch (e) {
            storage._memory = null;
        }
        storage._memory = null;
    }
    else {
        storage._memory = null;
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
            await storage.set(pbAuthCookie, data?.user);
            console.log("Login successful, pb_auth cookie and user data stored.");
        }
        return { data, header: setCookie };
    }
    async logout() {
        clearStorage();
    }
    async getSession() {
        const pbAuth = await storage.get();
        if (pbAuth) {
            return pbAuth;
        }
        return null;
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
        const pbAuthCookie = await storage.get();
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
