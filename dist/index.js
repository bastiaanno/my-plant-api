// MMKV integration for React Native
import { createMMKV } from "react-native-mmkv";
const mmkv = createMMKV(); // Use default instance
const isMMKVAvailable = !!mmkv;
// React Native compatibility: use global fetch
const fetchFn = globalThis.fetch.bind(globalThis);
// Storage abstraction for pb_auth cookie
const PB_AUTH_KEY = "pb_auth_cookie";
const USER_DATA_KEY = "pb_user_data";
const SESSION_KEY = "pb_session";
const storage = {
    setSession: async (session) => {
        // Always decode and parse pb_auth cookie as JSON
        let parsedSession;
        try {
            parsedSession = JSON.parse(decodeURIComponent(session.token));
        }
        catch (e) {
            // If parsing fails, do not store session
            return;
        }
        // Only store session if token and record are valid
        if (!parsedSession.token || !parsedSession.record) {
            if (isMMKVAvailable && mmkv) {
                mmkv.remove(SESSION_KEY);
            }
            else {
                storage._session = null;
            }
            return;
        }
        const sessionToStore = {
            token: parsedSession.token,
            record: parsedSession.record,
            expirationDate: session.expirationDate,
        };
        if (isMMKVAvailable && mmkv) {
            mmkv.set(SESSION_KEY, JSON.stringify(sessionToStore));
        }
        else {
            storage._session = sessionToStore;
        }
    },
    getSession: async () => {
        if (isMMKVAvailable && mmkv) {
            const str = mmkv.getString(SESSION_KEY);
            if (!str)
                return null;
            const obj = JSON.parse(str);
            if (obj && obj.expirationDate) {
                obj.expirationDate = new Date(obj.expirationDate);
            }
            return obj;
        }
        else {
            const obj = storage._session || null;
            if (obj && obj.expirationDate && typeof obj.expirationDate === "string") {
                obj.expirationDate = new Date(obj.expirationDate);
            }
            return obj;
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
    _session: null,
    _user: null,
};
const clearStorage = () => {
    if (isMMKVAvailable && mmkv) {
        mmkv.remove(USER_DATA_KEY);
        mmkv.remove(SESSION_KEY);
    }
    else {
        storage._session = null;
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
        });
        if (!res.ok)
            throw new Error(await res.text());
        const data = await res.json();
        // Try to get pb_auth cookie from Set-Cookie header
        const setCookie = res.headers.get("set-cookie") || res.headers.get("Set-Cookie");
        console.log(setCookie);
        let pbAuthCookie = null;
        let expirationDate = undefined;
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
            if (data?.user)
                await storage.setUser(data.user);
            console.log("Login successful, session and user data stored.");
        }
        return { data, header: setCookie };
    }
    async logout() {
        clearStorage();
    }
    async getSession() {
        return await storage.getSession();
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
        const session = await storage.getSession();
        if ((!session || !session.token) && path !== "/login") {
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
        if (session && session.token) {
            headers["Cookie"] = `pb_auth=${session.token}`;
        }
        const res = await fetchFn(`${this.baseUrl}${path}`, fetchOptions);
        // Extract and update session cookie if present in response
        const setCookie = res.headers.get("set-cookie") || res.headers.get("Set-Cookie");
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
