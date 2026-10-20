
"use strict";

document.addEventListener("DOMContentLoaded", async () => {
  const client = window.supabaseClient;
  const form = document.getElementById("mealPlanForm");
  const message = document.getElementById("planMessage");
  const saveButton = document.getElementById("savePlanButton");
  const plansContainer = document.getElementById("mealPlans");
  const dateInput = document.getElementById("planDate");

  if (!form || !plansContainer) {
    console.error("Meal planner HTML elements are missing.");
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

  async function getUser() {
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

  async function loadPlans() {
    plansContainer.replaceChildren();

    try {
      const user = await getUser();
      if (!user) return;

      const { data, error } = await client
        .from("meal_plans")
        .select("*")
        .eq("user_id", user.id)
        .order("plan_date", { ascending: true });

      if (error) throw error;

      if (!data || data.length === 0) {
        const empty = document.createElement("div");
        empty.className = "empty";
        empty.textContent = "No meal plans yet. Create your first plan above.";
        plansContainer.appendChild(empty);
        return;
      }

      data.forEach((plan) => {
        const card = document.createElement("article");
        card.className = "plan";

        const top = document.createElement("div");
        top.className = "plan-top";

        const details = document.createElement("div");
        const title = document.createElement("strong");
        title.textContent = plan.title || plan.meal_name || "Planned meal";

        const meta = document.createElement("small");
        const dateText = plan.plan_date || "";
        const mealType = plan.meal_type || "Meal";
        const calories = Number(plan.calories || 0);
        const time = plan.meal_time ? ` · ${plan.meal_time}` : "";

        meta.textContent =
          `${dateText} · ${mealType}${time} · ${calories} kcal`;

        details.append(title, meta);

        if (plan.notes) {
          const notes = document.createElement("small");
          notes.textContent = plan.notes;
          details.appendChild(notes);
        }

        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "delete-button";
        deleteButton.textContent = "Delete";

        deleteButton.addEventListener("click", async () => {
          if (!confirm("Delete this meal plan?")) return;

          deleteButton.disabled = true;

          const { error: deleteError } = await client
            .from("meal_plans")
            .delete()
            .eq("id", plan.id)
            .eq("user_id", user.id);

          if (deleteError) {
            console.error("Meal plan deletion failed:", deleteError);
            showMessage("Could not delete the meal plan. Check the database columns and permissions.");
            deleteButton.disabled = false;
            return;
          }

          showMessage("Meal plan deleted.", "success");
          await loadPlans();
        });

        top.append(details, deleteButton);
        card.appendChild(top);
        plansContainer.appendChild(card);
      });
    } catch (error) {
      console.error("Could not load meal plans:", error);
      plansContainer.textContent = "Unable to load meal plans. Check the database setup.";
      showMessage(error.message || "Could not load meal plans.");
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    message.hidden = true;

    if (!form.reportValidity()) return;

    saveButton.disabled = true;
    saveButton.textContent = "Saving...";

    try {
      const user = await getUser();
      if (!user) return;

      const formData = new FormData(form);

      const title = String(formData.get("planTitle") || "").trim();
      const mealType = String(formData.get("planMealType") || "").toLowerCase();
      const planDate = String(formData.get("planDate") || "");
      const calories = Number(formData.get("planCalories") || 0);
      const mealTime = String(formData.get("planTime") || "");
      const notes = String(formData.get("planNotes") || "").trim();

      if (!title) throw new Error("Please enter a meal title.");
      if (!Number.isFinite(calories) || calories < 0) {
        throw new Error("Calories must be a valid non-negative number.");
      }

      // Match these column names to your Supabase meal_plans table.
        const plan = {
  user_id: user.id,
  plan_date: planDate,
  meal_type: mealType,
  food_name: title,
  calories: calories,
  protein_g: 0,
  carbs_g: 0,
  fat_g: 0
};

      const { error } = await client
        .from("meal_plans")
        .insert(plan);

      if (error) throw error;

      form.reset();
      dateInput.value = localDateString();

      showMessage("Meal plan saved successfully!", "success");
      await loadPlans();
    } catch (error) {
      console.error("Could not save meal plan:", error);
      showMessage(
        error.message ||
        "Could not save the meal plan. Check the database columns and permissions."
      );
    } finally {
      saveButton.disabled = false;
      saveButton.textContent = "Save meal plan";
    }
  });

  await loadPlans();
});
