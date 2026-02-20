export type User = {
    id: string;
    name: string;
    email: string;
    username: string;
    isAdmin: boolean;
    registrationDate: Date;
    expirationDate?: Date;
};
export type Activity = {
    id: string;
    title: string;
    description: string;
    datetime: Date;
    expirationDate?: Date;
    committee: string;
    poster?: string;
    totalSignUps: number;
    userStatus: {
        signedUp: boolean;
        signupId?: string;
        onWaitlist: boolean;
        waitlistId?: string;
    };
};
export type ActivitySignup = {
    type: "signup" | "waitlist";
    answers: {
        [questionId: string]: string;
    };
};
export type RemoveRegistration = {
    type: "signout";
    id: string;
};
export type Wud = {
    id: string;
    message: string;
    created: Date;
    author: {
        id: string;
        name: string;
        username: string;
    };
};
export type PostWudjeRequest = {
    message: string;
};
