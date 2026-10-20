
"use strict";

document.addEventListener("DOMContentLoaded", () => {
  const client = window.supabaseClient;

  const form = document.getElementById("foodForm");
  const message = document.getElementById("formMessage");
  const saveButton = document.getElementById("saveFoodButton");
  const entriesContainer = document.getElementById("foodEntries");
  const summaryContainer = document.getElementById("dailySummary");
  const dateInput = document.getElementById("foodDate");

  if (!form || !entriesContainer || !summaryContainer) {
    console.error("Food diary HTML elements are missing.");
    return;
  }

  function localDateString(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  dateInput.value = localDateString();

  function showMessage(text, type = "error") {
    message.textContent = text;
    message.className = `message ${type}`;
    message.hidden = false;
  }

  function hideMessage() {
    message.hidden = true;
    message.textContent = "";
  }

  function getSelectedDateRange(dateString) {
    const [year, month, day] = dateString.split("-").map(Number);
    const start = new Date(year, month - 1, day);
    const end = new Date(year, month - 1, day + 1);

    return {
      start: start.toISOString(),
      end: end.toISOString()
    };
  }

  async function getCurrentUser() {
    if (!client) {
      throw new Error("Supabase is not connected. Check your configuration.");
    }

    const { data, error } = await client.auth.getUser();

    if (error || !data.user) {
      window.location.replace("../login.html");
      return null;
    }

    return data.user;
  }

  async function loadEntries() {
    entriesContainer.replaceChildren();
    summaryContainer.textContent = "Loading your food entries...";

    try {
      const user = await getCurrentUser();
      if (!user) return;

      const selectedDate = dateInput.value || localDateString();
      const { start, end } = getSelectedDateRange(selectedDate);

      const { data, error } = await client
        .from("food_entries")
        .select("*")
        .eq("user_id", user.id)
        .gte("created_at", start)
        .lt("created_at", end)
        .order("created_at", { ascending: false });

      if (error) throw error;

      renderEntries(data || []);
    } catch (error) {
      console.error("Could not load food entries:", error);
      summaryContainer.textContent =
        "Could not load food entries. Check the food_entries table and its RLS policies.";
      showMessage(error.message || "Unable to load food entries.");
    }
  }

  function renderEntries(entries) {
    entriesContainer.replaceChildren();

    const totals = entries.reduce((result, entry) => {
      result.calories += Number(entry.calories || 0);
      result.protein += Number(entry.protein_g || 0);
      result.carbs += Number(entry.carbs_g || 0);
      result.fat += Number(entry.fat_g || 0);
      return result;
    }, { calories: 0, protein: 0, carbs: 0, fat: 0 });

    summaryContainer.textContent =
      `${entries.length} entries · ${Math.round(totals.calories)} kcal · ` +
      `Protein ${totals.protein.toFixed(1)} g · ` +
      `Carbs ${totals.carbs.toFixed(1)} g · ` +
      `Fat ${totals.fat.toFixed(1)} g`;

    if (entries.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent = "No food entries for this date. Add your first meal above.";
      entriesContainer.appendChild(empty);
      return;
    }

    entries.forEach((entry) => {
      const item = document.createElement("article");
      item.className = "food-item";

      const details = document.createElement("div");
      const name = document.createElement("strong");
      const meta = document.createElement("small");

      name.textContent = entry.food_name || "Food entry";
      meta.textContent =
        `${entry.meal_type || "Meal"} · ` +
        `Protein ${Number(entry.protein_g || 0)} g · ` +
        `Carbs ${Number(entry.carbs_g || 0)} g · ` +
        `Fat ${Number(entry.fat_g || 0)} g`;

      details.append(name, meta);

      const calories = document.createElement("span");
      calories.className = "calories";
      calories.textContent = `${Math.round(Number(entry.calories || 0))} kcal`;

      item.append(details, calories);
      entriesContainer.appendChild(item);
    });
  }

  async function saveEntry(event) {
    event.preventDefault();
    hideMessage();

    if (!form.reportValidity()) return;

    saveButton.disabled = true;
    saveButton.textContent = "Saving...";

    try {
      const user = await getCurrentUser();
      if (!user) return;

      const formData = new FormData(form);

      const foodName = String(formData.get("foodName") || "").trim();
      const mealType = String(formData.get("mealType") || "").toLowerCase();
      const calories = Number(formData.get("calories"));
      const protein = Number(formData.get("protein"));
      const carbs = Number(formData.get("carbs"));
      const fat = Number(formData.get("fat"));

      if (!foodName) {
        throw new Error("Please enter a food name.");
      }

      for (const value of [calories, protein, carbs, fat]) {
        if (!Number.isFinite(value) || value < 0) {
          throw new Error("Nutrition values must be valid non-negative numbers.");
        }
      }

      const selectedDate = String(formData.get("foodDate") || localDateString());
      const [year, month, day] = selectedDate.split("-").map(Number);
      const loggedAt = new Date(year, month - 1, day, 12, 0, 0);

      const entry = {
        user_id: user.id,
        food_name: foodName,
        meal_type: mealType,
        calories,
        protein_g: protein,
        carbs_g: carbs,
        fat_g: fat,
        created_at: loggedAt.toISOString()
      };

      const { error } = await client
        .from("food_entries")
        .insert(entry);

      if (error) throw error;

      form.reset();
      dateInput.value = selectedDate;
      document.getElementById("protein").value = "0";
      document.getElementById("carbs").value = "0";
      document.getElementById("fat").value = "0";

      showMessage("Food entry saved successfully!", "success");
      await loadEntries();
    } catch (error) {
      console.error("Could not save food entry:", error);
      showMessage(
        error.message || "Could not save the food entry. Please try again."
      );
    } finally {
      saveButton.disabled = false;
      saveButton.textContent = "Save food entry";
    }
  }

  form.addEventListener("submit", saveEntry);
  dateInput.addEventListener("change", () => {
    hideMessage();
    loadEntries();
  });

  loadEntries();
});
