
"use strict";

document.addEventListener("DOMContentLoaded", async () => {
  const client = window.supabaseClient;
  const form = document.getElementById("reportForm");
  const dateInput = document.getElementById("reportDate");
  const button = document.getElementById("loadReportButton");
  const message = document.getElementById("reportMessage");
  const entriesBody = document.getElementById("reportEntries");

  const localDateString = (date = new Date()) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  function showMessage(text, type = "error") {
    message.textContent = text;
    message.className = `message ${type}`;
    message.hidden = false;
  }

  function setText(id, value) {
    document.getElementById(id).textContent = String(value);
  }

  function showEmpty(text) {
    entriesBody.replaceChildren();
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 6;
    cell.className = "empty";
    cell.textContent = text;
    row.appendChild(cell);
    entriesBody.appendChild(row);
  }

  function addCell(row, value) {
    const cell = document.createElement("td");
    cell.textContent = String(value ?? 0);
    row.appendChild(cell);
  }

  function sum(entries, column) {
    return entries.reduce(
      (total, entry) => total + Number(entry[column] || 0),
      0
    );
  }

  if (!client) {
    showMessage("Supabase is not connected. Check your configuration.");
    showEmpty("Supabase connection unavailable.");
    return;
  }

  const { data: authData, error: authError } =
    await client.auth.getUser();

  if (authError || !authData.user) {
    window.location.replace("../login.html");
    return;
  }

  dateInput.value = localDateString();

  async function loadReport(event) {
    if (event) event.preventDefault();

    message.hidden = true;
    button.disabled = true;
    button.textContent = "Loading...";
    showEmpty("Loading report...");

    try {
      const { data: currentData, error: currentError } =
        await client.auth.getUser();

      if (currentError || !currentData.user) {
        window.location.replace("../login.html");
        return;
      }

      const user = currentData.user;
      const selectedDate = dateInput.value;

      if (!selectedDate) {
        throw new Error("Please select a date.");
      }

      // consumed_at is a timestamp, so use a date range.
      const start = new Date(`${selectedDate}T00:00:00`);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);

      const { data: entries, error: foodError } = await client
        .from("food_entries")
        .select("*")
        .eq("user_id", user.id)
        .gte("consumed_at", start.toISOString())
        .lt("consumed_at", end.toISOString())
        .order("consumed_at", { ascending: true });

      if (foodError) throw foodError;

      const foods = entries || [];
      const calories = sum(foods, "calories");
      const protein = sum(foods, "protein_g");
      const carbs = sum(foods, "carbs_g");
      const fat = sum(foods, "fat_g");

      setText("reportCalories", calories);
      setText("reportProtein", protein);
      setText("reportCarbs", carbs);
      setText("reportFat", fat);

      const { data: goals, error: goalsError } = await client
        .from("user_goals")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (goalsError) throw goalsError;

      const calorieGoal = Number(goals?.daily_calories ?? 2000);
      const waterGoal = Number(
        goals?.water_goal_ml ?? goals?.daily_water_ml ?? 2000
      );

      const percentage = calorieGoal > 0
        ? Math.min(100, Math.round((calories / calorieGoal) * 100))
        : 0;

      setText("calorieProgressText", `${percentage}%`);
      setText(
        "calorieGoalText",
        `${calories} of ${calorieGoal} kcal consumed`
      );

      document.getElementById("calorieProgressBar").style.width =
        `${percentage}%`;

      const { data: waterRows, error: waterError } = await client
        .from("water_logs")
        .select("amount_ml, logged_at")
        .eq("user_id", user.id)
        .gte("logged_at", start.toISOString())
        .lt("logged_at", end.toISOString());

      if (waterError) throw waterError;

      const waterTotal = (waterRows || []).reduce(
        (total, item) => total + Number(item.amount_ml || 0),
        0
      );

      setText("reportWater", waterTotal);
      setText("reportWaterGoal", waterGoal);

      entriesBody.replaceChildren();

      if (foods.length === 0) {
        showEmpty("No food entries found for this date.");
      } else {
        foods.forEach((food) => {
          const row = document.createElement("tr");
          addCell(row, food.food_name || "Food");
          addCell(row, food.meal_type || "—");
          addCell(row, food.calories);
          addCell(row, food.protein_g);
          addCell(row, food.carbs_g);
          addCell(row, food.fat_g);
          entriesBody.appendChild(row);
        });
      }

      showMessage("Report loaded successfully!", "success");
    } catch (error) {
      console.error("Report error:", error);
      showEmpty("Unable to load report data.");
      showMessage(
        error.message || "Could not load the report. Check your database columns."
      );
    } finally {
      button.disabled = false;
      button.textContent = "Load report";
    }
  }

  form.addEventListener("submit", loadReport);
  await loadReport();
});
