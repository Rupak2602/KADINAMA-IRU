
"use strict";

document.addEventListener("DOMContentLoaded", async () => {
  const client = window.supabaseClient;

  const profileForm = document.getElementById("profileForm");
  const goalsForm = document.getElementById("goalsForm");
  const message = document.getElementById("profileMessage");

  const profileButton = document.getElementById("saveProfileButton");
  const goalsButton = document.getElementById("saveGoalsButton");

  let user = null;

  function showMessage(text, type = "error") {
    message.textContent = text;
    message.className = `message ${type}`;
    message.hidden = false;
  }

  function setValue(id, value) {
    document.getElementById(id).value =
      value === null || value === undefined ? "" : String(value);
  }

  function getNumber(id) {
    const value = document.getElementById(id).value;
    return value === "" ? null : Number(value);
  }

  function updateProfileHeader(name) {
    const displayName =
      name || user?.email?.split("@")[0] || "Your profile";

    document.getElementById("profileHeading").textContent = displayName;
    document.getElementById("profileAvatar").textContent =
      displayName.trim().charAt(0).toUpperCase() || "K";
  }

  if (!client) {
    showMessage("Supabase is not connected. Check your configuration.");
    return;
  }

  if (!profileForm || !goalsForm || !message) {
    console.error("Profile page HTML elements are missing.");
    return;
  }

  try {
    const { data, error } = await client.auth.getUser();

    if (error || !data.user) {
      window.location.replace("../login.html");
      return;
    }

    user = data.user;

    document.getElementById("profileEmail").textContent =
      user.email || "";

    await loadProfile();
    await loadGoals();
  } catch (error) {
    console.error("Profile initialization failed:", error);
    showMessage(error.message || "Could not load your account.");
  }

  async function loadProfile() {
    const { data, error } = await client
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      console.error("Profile load failed:", error);
      showMessage(
        "Could not load profile details. Please check your profiles table columns."
      );
      return;
    }

    const metadata = user.user_metadata || {};
    const name = data?.full_name || metadata.full_name || "";

    setValue("fullName", name);
    setValue("age", data?.age);
    setValue("height", data?.height_cm);
    setValue("weight", data?.weight_kg);

    updateProfileHeader(name);
  }

  async function loadGoals() {
    const { data, error } = await client
      .from("user_goals")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      console.error("Goals load failed:", error);
      showMessage(
        "Could not load nutrition goals. Please check your user_goals table columns."
      );
      return;
    }

    if (!data) return;

    setValue("dailyCalories", data.daily_calories ?? 2000);
    setValue("dailyWater", data.water_goal_ml ?? 2000);
    setValue("dailyProtein", data.protein_goal_g ?? 50);
    setValue("dailyCarbs", data.carbs_goal_g ?? 250);
    setValue("dailyFat", data.fat_goal_g ?? 65);
  }

  profileForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    message.hidden = true;

    if (!profileForm.reportValidity()) return;

    profileButton.disabled = true;
    profileButton.textContent = "Saving...";

    try {
      const fullName = document
        .getElementById("fullName")
        .value.trim();

      if (!fullName) {
        throw new Error("Please enter your full name.");
      }

      // Use only profile columns supported by the current code.
      const profile = {
        id: user.id,
        full_name: fullName,
        age: getNumber("age"),
        height_cm: getNumber("height"),
        weight_kg: getNumber("weight")
      };

      const { error } = await client
        .from("profiles")
        .upsert(profile, { onConflict: "id" });

      if (error) throw error;

      const { error: authError } = await client.auth.updateUser({
        data: { full_name: fullName }
      });

      if (authError) {
        console.warn("Account display name update failed:", authError.message);
      }

      updateProfileHeader(fullName);
      showMessage("Profile saved successfully!", "success");
    } catch (error) {
      console.error("Profile save failed:", error);
      showMessage(
        error.message || "Could not save profile details."
      );
    } finally {
      profileButton.disabled = false;
      profileButton.textContent = "Save profile";
    }
  });

  goalsForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    message.hidden = true;

    if (!goalsForm.reportValidity()) return;

    goalsButton.disabled = true;
    goalsButton.textContent = "Saving...";

    try {
      const goals = {
        user_id: user.id,
        daily_calories: Number(
          document.getElementById("dailyCalories").value
        ),
        protein_goal_g: Number(
          document.getElementById("dailyProtein").value
        ),
        carbs_goal_g: Number(
          document.getElementById("dailyCarbs").value
        ),
        fat_goal_g: Number(
          document.getElementById("dailyFat").value
        ),
        water_goal_ml: Number(
          document.getElementById("dailyWater").value
        )
      };

      const { error } = await client
        .from("user_goals")
        .upsert(goals, { onConflict: "user_id" });

      if (error) throw error;

      showMessage("Nutrition goals saved successfully!", "success");
    } catch (error) {
      console.error("Nutrition goals save failed:", error);
      showMessage(
        error.message || "Could not save nutrition goals."
      );
    } finally {
      goalsButton.disabled = false;
      goalsButton.textContent = "Save goals";
    }
  });
});
