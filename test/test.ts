import "dotenv/config";
import MyPlantClient from "../src/index.ts";

const client = new MyPlantClient(process.env.MYPLANT_API_URL);

async function login() {
  const username = process.env.MYPLANT_USERNAME;
  const password = process.env.MYPLANT_PASSWORD;
  if (!username || !password) {
    throw new Error(
      "Please set MYPLANT_USERNAME and MYPLANT_PASSWORD in your .env file",
    );
  }
  await client.login(username, password);
}

async function test() {
  console.log("Testing MyPlantClient...");
  const session = await client.getSession(); // Check if already logged in
  if (session) {
    const user = await client.getUser();
    console.log(`Already logged in as `, user);
  }
  if (!session) {
    console.log("Not logged in, logging in...");
    await login();
    console.log("Logged in successfully!");
  }
  const activities = await client.getActivities();
  console.log(`Fetched ${activities.length} activities.`);

  if (activities.length > 0) {
    const activity = await client.getActivity({ activityId: activities[0].id });
    console.log(`Fetched activity: ${activity.title}`);
  }

  const wudjes = await client.getWudjes();
  console.log(`Fetched ${wudjes.length} wudjes.`);
}

test().catch((err) => {
  console.error("Test failed:", err);
});
