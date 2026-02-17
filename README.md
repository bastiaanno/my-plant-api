npm install my-plant-api-client

# MyPlant API JavaScript/TypeScript Client

JavaScript/TypeScript client for the Semper Florens (my-plant) API. Works in Node.js, React Native, and Expo environments.

## Features

- User authentication
- Manage activities (view, join, unjoin)
- Handle WUD messages (view, post)
- Written in TypeScript with full type support
- Compatible with Node.js, React Native, and Expo (uses global `fetch`)

## Installation

```
npm install my-plant-api-client
```

## Usage

### Node.js / TypeScript

```ts
import MyPlantClient from "my-plant-api-client";

const client = new MyPlantClient();
await client.login("username", "password");
const activities = await client.getActivities();
```

### React Native / Expo

No extra setup is required. The client will automatically use Expo’s or React Native’s global `fetch`:

```js
import MyPlantClient from "my-plant-api-client";

const client = new MyPlantClient();
await client.login("username", "password");
const activities = await client.getActivities();
```

## API Reference

### Constructor

`new MyPlantClient(baseUrl?: string)`

### Methods

- `login(username: string, password: string): Promise<LoginResponse>`
- `getActivities(): Promise<Activity[]>`
- `getActivity({ activityId }: { activityId: string }): Promise<Activity>`
- `joinActivity(id: string, info: ActivitySignup): Promise<any>`
- `removeActivity(info: RemoveRegistration): Promise<any>`
- `getWudjes(): Promise<Wud[]>`
- `postWudje(info: PostWudjeRequest): Promise<any>`

### Types

#### LoginResponse

```
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
```

#### Activity

```
type Activity = {
	id: string;
	title: string;
	description: string;
	venue: string;
	startTime: Date;
	endTime: Date;
	signupDeadline: Date;
	committee: string;
	poster?: string;
};
```

#### ActivitySignup

```
type ActivitySignup = {
	type: "signup" | "waitlist";
	answers: { [questionId: string]: string };
};
```

#### RemoveRegistration

```
type RemoveRegistration = {
	type: "signout";
	id: string;
};
```

#### Wud

```
type Wud = {
	id: string;
	message: string;
	created: Date;
	author: {
		id: string;
		name: string;
		username: string;
	};
};
```

## Environment Compatibility

- **Node.js**: Uses `node-fetch` if global `fetch` is not available.
- **React Native/Expo**: Uses the global `fetch` implementation automatically.

## License

AGPL-3.0
See LICENSE file or https://www.gnu.org/licenses/agpl-3.0.html
