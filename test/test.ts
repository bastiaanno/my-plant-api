import "dotenv/config";
import MyPlantClient from "../src/index.ts";
import { promises as fs } from "fs";
import "dotenv/config";

// Global token variable
let token: string | null = null;

const client = new MyPlantClient(process.env.MYPLANT_API_URL);

async function loadToken() {
  if (token) return token;
  try {
    token = (await fs.readFile(".token", "utf-8")).trim();
    client.token = token;
    return token;
  } catch {
    return null;
  }
}

async function saveToken(newToken: string) {
  token = newToken;
  client.token = newToken;
  await fs.writeFile(".token", newToken, "utf-8");
}

async function ensureToken() {
  if (client.token) return;
  if (!(await loadToken())) {
    const { token: newToken } = await client.login(
      process.env.MYPLANT_USERNAME!,
      process.env.MYPLANT_PASSWORD!,
    );
    await saveToken(newToken);
  }
}

async function getActivities() {
  await ensureToken();
  try {
    const activities = await client.getActivities();
    console.log("Activities:", activities);
  } catch (err) {
    console.error("Error fetching activities:", err);
  }
}

async function getAcivity(activityId: string) {
  await ensureToken();
  try {
    const activity = await client.getActivity({ activityId });
    console.log("Activity:", activity);
  } catch (err) {
    console.error("Error fetching activity:", err);
  }
}

async function signUpForActivity(activityId: string) {
  await ensureToken();
  try {
    await client.joinActivity(activityId, {
      type: "signup",
      answers: {},
    });
    console.log(`Successfully signed up for activity ${activityId}`);
  } catch (err) {
    console.error("Error signing up for activity:", err);
  }
}

async function unregisterFromActivity(activityId: string) {
  await ensureToken();
  try {
    await client.removeActivity({
      type: "signout",
      id: activityId,
    });
    console.log(`Successfully unregistered from activity ${activityId}`);
  } catch (err) {
    console.error("Error unregistering from activity:", err);
  }
}

async function listWudjes() {
  await ensureToken();
  try {
    const wudjes = await client.getWudjes();
    console.log(
      "Wudjes:",
      wudjes.map((w) => `${w.author.name}: ${w.message}`).join("\n"),
    );
  } catch (err) {
    console.error("Error fetching wudjes:", err);
  }
}

async function postWudje(message: string) {
  await ensureToken();
  try {
    await client.postWudje({ message });
    console.log("Successfully posted wudje");
  } catch (err) {
    console.error("Error posting wudje:", err);
  }
}

getActivities();
