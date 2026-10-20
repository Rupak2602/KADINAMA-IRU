
"use strict";

document.addEventListener("DOMContentLoaded", async () => {
  const client = window.supabaseClient;

  if (!client) {
    console.error("Supabase client is not initialized.");
    return;
  }

  const { data, error } = await client.auth.getUser();

  if (error || !data.user) {
    window.location.replace("login.html");
    return;
  }

  const user = data.user;
  await loadWaterTotal(client, user.id);
  await loadFoodTotals(client, user.id);

  document.getElementById("addWaterButton")?.addEventListener("click", async () => {
    await addWater(client, user.id, 250);
  });

  document.getElementById("removeWaterButton")?.addEventListener("click", async () => {
    await removeLatestWater(client, user.id);
  });
});

function getTodayRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

  return { start: start.toISOString(), end: end.toISOString() };
}

async function loadWaterTotal(client, userId) {
  const { start, end } = getTodayRange();

  const { data, error } = await client
    .from("water_logs")
    .select("amount_ml")
    .eq("user_id", userId)
    .gte("logged_at", start)
    .lt("logged_at", end);

  if (error) {
    console.error("Water loading failed:", error.message);
    return;
  }

  const total = (data || []).reduce(
    (sum, entry) => sum + Number(entry.amount_ml || 0),
    0
  );

  document.getElementById("waterConsumed").textContent = total.toLocaleString();
  document.getElementById("waterConsumed").dataset.total = String(total);

  const percentage = Math.min(100, total / 2000 * 100);
  document.getElementById("waterProgressFill").style.width = `${percentage}%`;
  document.getElementById("waterProgress").setAttribute("aria-valuenow", total);
}

async function addWater(client, userId, amount) {
  const { error } = await client.from("water_logs").insert({
    user_id: userId,
    amount_ml: amount,
    logged_at: new Date().toISOString()
  });

  if (error) {
    console.error("Water save failed:", error.message);
    alert("Could not save water. Please try again.");
    return;
  }

  await loadWaterTotal(client, userId);
}

async function removeLatestWater(client, userId) {
  const { start, end } = getTodayRange();

  const { data, error } = await client
    .from("water_logs")
    .select("id")
    .eq("user_id", userId)
    .gte("logged_at", start)
    .lt("logged_at", end)
    .order("logged_at", { ascending: false })
    .limit(1);

  if (error || !data?.length) {
    if (error) console.error("Water lookup failed:", error.message);
    return;
  }

  const { error: deleteError } = await client
    .from("water_logs")
    .delete()
    .eq("id", data[0].id)
    .eq("user_id", userId);

  if (deleteError) {
    console.error("Water removal failed:", deleteError.message);
    alert("Could not remove the latest water entry.");
    return;
  }

  await loadWaterTotal(client, userId);
}

async function loadFoodTotals(client, userId) {
  const { start, end } = getTodayRange();

  const { data, error } = await client
    .from("food_entries")
    .select("food_name, meal_type, calories, protein_g, carbs_g, fat_g, created_at")
    .eq("user_id", userId)
    .gte("created_at", start)
    .lt("created_at", end)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Food loading failed:", error.message);
    return;
  }

  const entries = data || [];

  const totals = entries.reduce((sum, item) => {
    sum.calories += Number(item.calories || 0);
    sum.protein += Number(item.protein_g || 0);
    sum.carbs += Number(item.carbs_g || 0);
    sum.fat += Number(item.fat_g || 0);
    return sum;
  }, { calories: 0, protein: 0, carbs: 0, fat: 0 });

  const goal = 2000;
  document.getElementById("caloriesConsumed").textContent = Math.round(totals.calories).toLocaleString();
  document.getElementById("calorieGoal").textContent = `${goal.toLocaleString()} kcal`;
  document.getElementById("caloriesRemaining").textContent = `${Math.max(0, goal - totals.calories).toLocaleString()} kcal`;
  document.getElementById("proteinValue").textContent = `${totals.protein.toFixed(1).replace(/\.0$/, "")} g`;
  document.getElementById("carbsValue").textContent = `${totals.carbs.toFixed(1).replace(/\.0$/, "")} g`;
  document.getElementById("fatValue").textContent = `${totals.fat.toFixed(1).replace(/\.0$/, "")} g`;

  const ring = document.getElementById("calorieRing");
  ring.style.background = `conic-gradient(#ff7048 0deg ${Math.min(360, totals.calories / goal * 360)}deg, #f5e9dc ${Math.min(360, totals.calories / goal * 360)}deg 360deg)`;

  document.getElementById("foodCount").textContent =
    `${entries.length} ${entries.length === 1 ? "entry" : "entries"}`;

  const list = document.getElementById("foodList");
  list.replaceChildren();

  if (entries.length === 0) {
    const empty = document.createElement("div");
    empty.className = "dashboard-food-empty";
    empty.textContent = "No food entries yet. Start by adding your first meal.";
    list.appendChild(empty);
    return;
  }

  entries.forEach((entry) => {
    const item = document.createElement("div");
    item.className = "dashboard-food-item";

    const details = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = entry.food_name || "Food entry";

    const meal = document.createElement("span");
    meal.textContent = entry.meal_type || "Meal";

    details.append(name, meal);

    const calories = document.createElement("div");
    calories.className = "dashboard-food-calories";
    calories.textContent = `${Math.round(Number(entry.calories || 0))} kcal`;

    item.append(details, calories);
    list.appendChild(item);
  });
}
