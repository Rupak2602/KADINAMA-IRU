
"use strict";

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({
      error: "Only POST requests are supported."
    });
  }

  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: "AI service is not configured yet. Add GROQ_API_KEY in Vercel settings."
    });
  }

  try {
    const { image } = req.body || {};

    if (typeof image !== "string") {
      return res.status(400).json({
        error: "Please upload a food image."
      });
    }

    const match = image.match(
      /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/
    );

    if (!match) {
      return res.status(400).json({
        error: "Unsupported image. Please use JPG, PNG, or WebP."
      });
    }

    const mimeType = match[1];
    const base64 = match[2];

    if (base64.length > 7_000_000) {
      return res.status(413).json({
        error: "Image is too large. Please choose a smaller image."
      });
    }

    const prompt = `
You are a food recognition and nutrition estimation assistant.

Analyze the supplied food photograph and estimate nutrition for the visible food.

Rules:
- Identify the most likely food. Do not claim certainty if the image is ambiguous.
- Estimate the edible serving size in grams.
- Estimate calories, protein, carbohydrates, fat, and fiber for that serving.
- Use realistic nutrition estimates. Consider visible ingredients and typical cooking methods.
- Do not invent exact ingredients that cannot be seen.
- If multiple foods are visible, estimate the total serving shown and mention uncertainty.
- Nutrition values must be non-negative numbers.
- Return JSON only, with exactly these fields:
{
  "foodName": "string",
  "servingSize": "string",
  "calories": 0,
  "protein_g": 0,
  "carbs_g": 0,
  "fat_g": 0,
  "fiber_g": 0,
  "notes": "string"
}
- calories should be kcal; macros and fiber should be grams.
- Include a short uncertainty note in notes.
`;

    const aiResponse = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "qwen/qwen3.8-27b",
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                {
                  type: "image_url",
                  image_url: { url: image }
                }
              ]
            }
          ],
          response_format: { type: "json_object" },
          temperature: 0.2,
          max_tokens: 500
        })
      }
    );

    const aiResult = await aiResponse.json().catch(() => ({}));

    if (!aiResponse.ok) {
      console.error("Groq API error:", aiResponse.status, aiResult.error?.message);

      if (aiResponse.status === 429) {
        return res.status(429).json({
          error: "AI request limit reached. Please wait a little and try again."
        });
      }

      return res.status(502).json({
        error: "The AI service could not analyze this image. Please try again."
      });
    }

    const content = aiResult.choices?.[0]?.message?.content;

    if (typeof content !== "string") {
      return res.status(502).json({
        error: "The AI returned no nutrition results. Please try again."
      });
    }

    let nutrition;

    try {
      nutrition = JSON.parse(content);
    } catch {
      return res.status(502).json({
        error: "The AI returned unreadable results. Please scan again."
      });
    }

    const numericFields = [
      "calories",
      "protein_g",
      "carbs_g",
      "fat_g",
      "fiber_g"
    ];

    if (
      typeof nutrition.foodName !== "string" ||
      !nutrition.foodName.trim() ||
      numericFields.some(
        (field) =>
          typeof nutrition[field] !== "number" ||
          !Number.isFinite(nutrition[field]) ||
          nutrition[field] < 0
      )
    ) {
      return res.status(502).json({
        error: "The AI returned incomplete nutrition data. Please try again."
      });
    }

    return res.status(200).json({
      data: {
        foodName: nutrition.foodName.slice(0, 120),
        servingSize:
          typeof nutrition.servingSize === "string"
            ? nutrition.servingSize.slice(0, 100)
            : "Estimated serving",
        calories: Math.round(nutrition.calories),
        protein_g: Math.round(nutrition.protein_g * 10) / 10,
        carbs_g: Math.round(nutrition.carbs_g * 10) / 10,
        fat_g: Math.round(nutrition.fat_g * 10) / 10,
        fiber_g: Math.round(nutrition.fiber_g * 10) / 10,
        notes:
          typeof nutrition.notes === "string"
            ? nutrition.notes.slice(0, 500)
            : "Nutrition values are estimates."
      }
    });
  } catch (error) {
    console.error("Food analysis error:", error.message);

    return res.status(500).json({
      error: "Something went wrong while analyzing the image."
    });
  }
};
