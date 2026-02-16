import type { Activity, ActivitySignup, PostWudjeRequest, RemoveRegistration, Wud } from "./types";
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
export default class MyPlantClient {
    baseUrl: string;
    token: string | null;
    constructor(baseUrl?: string);
    login(username: string, password: string): Promise<LoginResponse>;
    getActivities(): Promise<Activity[]>;
    getActivity({ activityId }: {
        activityId: string;
    }): Promise<Activity>;
    joinActivity(id: string, info: ActivitySignup): Promise<any>;
    removeActivity(info: RemoveRegistration): Promise<any>;
    getWudjes(): Promise<Wud[]>;
    postWudje(info: PostWudjeRequest): Promise<any>;
    _request(method: "GET" | "POST" | "DELETE", path: string, body?: any): Promise<any>;
}
export {};
