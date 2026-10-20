
"use strict";

document.addEventListener("DOMContentLoaded", () => {
  const imageInput = document.getElementById("foodImage");
  const chooseButton = document.getElementById("chooseImageButton");
  const previewContainer = document.getElementById("imagePreviewContainer");
  const imagePreview = document.getElementById("foodImagePreview");
  const removeButton = document.getElementById("removeImageButton");
  const scanButton = document.getElementById("scanFoodButton");
  const saveButton = document.getElementById("saveFoodButton");
  const message = document.getElementById("scannerMessage");
  const resultsSection = document.getElementById("nutritionResults");

  const MAX_FILE_SIZE = 5 * 1024 * 1024;
  const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

  let selectedImage = null;
  let currentNutrition = null;
  let isAnalyzing = false;
  let previewUrl = null;

  if (
    !imageInput ||
    !chooseButton ||
    !previewContainer ||
    !imagePreview ||
    !removeButton ||
    !scanButton ||
    !saveButton ||
    !message ||
    !resultsSection
  ) {
    console.error("Food Scanner: Required HTML elements are missing.");
    return;
  }

  function showMessage(text, state = "info") {
    message.textContent = text;
    message.dataset.state = state;
  }

  function clearPreviewUrl() {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      previewUrl = null;
    }
  }

  function clearResults() {
    currentNutrition = null;
    resultsSection.hidden = true;
    saveButton.disabled = true;
  }

  function resetScanner() {
    selectedImage = null;
    imageInput.value = "";

    clearPreviewUrl();
    clearResults();

    imagePreview.removeAttribute("src");
    previewContainer.hidden = true;
    scanButton.disabled = true;

    showMessage("Choose a food image to get started.");
  }

  function validateImage(file) {
    if (!file) {
      return "Please choose a food image.";
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return "Please select a JPG, PNG, or WebP image.";
    }

    if (file.size > MAX_FILE_SIZE) {
      return "Image is too large. Please choose an image under 5 MB.";
    }

    if (file.size === 0) {
      return "This image is empty. Please select another image.";
    }

    return null;
  }

  chooseButton.addEventListener("click", () => {
    if (!isAnalyzing) {
      imageInput.click();
    }
  });

  imageInput.addEventListener("change", () => {
    const file = imageInput.files && imageInput.files[0];

    if (!file) {
      return;
    }

    const error = validateImage(file);

    if (error) {
      resetScanner();
      showMessage(error, "error");
      return;
    }

    selectedImage = file;
    clearResults();
    clearPreviewUrl();

    previewUrl = URL.createObjectURL(file);
    imagePreview.src = previewUrl;
    previewContainer.hidden = false;
    scanButton.disabled = false;

    showMessage(
      `${file.name} selected. Ready to analyze.`,
      "success"
    );
  });

  removeButton.addEventListener("click", () => {
    if (isAnalyzing) {
      return;
    }

    resetScanner();
  });

  function setAnalyzingState(active) {
    isAnalyzing = active;
    chooseButton.disabled = active;
    removeButton.disabled = active;
    scanButton.disabled = active || !selectedImage;

    scanButton.textContent = active
      ? "Analyzing Food..."
      : "Analyze Food";
  }

  function displayNutrition(data) {
    const fields = {
      resultFoodName: data.foodName,
      resultServingSize: data.servingSize,
      resultCalories: data.calories,
      resultProtein: data.protein_g,
      resultCarbs: data.carbs_g,
      resultFat: data.fat_g,
      resultFiber: data.fiber_g,
      resultNotes: data.notes
    };

    for (const [id, value] of Object.entries(fields)) {
      const element = document.getElementById(id);

      if (!element) {
        console.error(`Food Scanner: Missing result element: ${id}`);
        continue;
      }

      element.textContent = value ?? "";
    }

    resultsSection.hidden = false;
    saveButton.disabled = false;

    resultsSection.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  scanButton.addEventListener("click", async () => {
    if (!selectedImage || isAnalyzing) {
      return;
    }

    setAnalyzingState(true);
    clearResults();
    showMessage("Analyzing your food image. Please wait...", "loading");

    try {
      const base64Image = await new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => {
          const result = reader.result;

          if (typeof result !== "string" || !result.includes(",")) {
            reject(new Error("Could not read the selected image."));
            return;
          }

          resolve(result);
        };

        reader.onerror = () => {
          reject(new Error("Unable to read the image. Please try again."));
        };

        reader.readAsDataURL(selectedImage);
      });

      const response = await fetch("/api/analyze-food", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          image: base64Image
        })
      });

      let result;

      try {
        result = await response.json();
      } catch {
        throw new Error(
          "The server returned an invalid response. Please try again."
        );
      }

      if (!response.ok) {
        throw new Error(
          result.error || "Food analysis failed. Please try again."
        );
      }

      const data = result.data || result;

      const numericFields = [
        "calories",
        "protein_g",
        "carbs_g",
        "fat_g",
        "fiber_g"
      ];

      if (
        typeof data.foodName !== "string" ||
        !data.foodName.trim() ||
        numericFields.some(
          (field) =>
            typeof data[field] !== "number" ||
            !Number.isFinite(data[field]) ||
            data[field] < 0
        )
      ) {
        throw new Error("The AI returned incomplete nutrition data. Please scan again.");
      }

      currentNutrition = data;
      displayNutrition(data);

      showMessage(
        "Food analyzed! Review the estimated nutrition values below.",
        "success"
      );
    } catch (error) {
      console.error("Food Scanner error:", error);

      showMessage(
        error.message ||
          "Unable to analyze this image. Please try again.",
        "error"
      );
    } finally {
      setAnalyzingState(false);
    }
  });

  saveButton.addEventListener("click", async () => {
    if (!currentNutrition) {
      return;
    }

    // Supabase save integration will be added after AI analysis works.
    showMessage(
      "Nutrition detected. Food Diary save integration is the next step.",
      "info"
    );
  });

  window.addEventListener("beforeunload", clearPreviewUrl);

  console.log("KADINAMA IRU Food Scanner initialized.");
});
