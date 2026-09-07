import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();

const I18N_DIR = path.join(ROOT, "src", "i18n");

const EN_FILE = path.join(I18N_DIR, "en.js");
const HI_FILE = path.join(I18N_DIR, "hi.js");
const TE_FILE = path.join(I18N_DIR, "te.js");

const MODEL =
  process.env.OPENAI_TRANSLATION_MODEL ||
  "gpt-5.6-luna";

const BATCH_SIZE = 20;

const LANGUAGE_CONFIG = {
  hi: {
    name: "Hindi",
    file: HI_FILE,
  },
  te: {
    name: "Telugu",
    file: TE_FILE,
  },
};

function fail(message) {
  console.error(`\n✗ ${message}\n`);
  process.exitCode = 1;
}

async function loadDictionary(filePath) {
  const source = await fs.readFile(filePath, "utf8");

  /*
   * Import the dictionary as an isolated ESM data URL.
   *
   * This allows the script to work with the existing:
   *
   * const en = { ... };
   * export default en;
   *
   * format without requiring Babel or changing the
   * frontend's module configuration.
   */
  const dataUrl =
    "data:text/javascript;base64," +
    Buffer.from(source, "utf8").toString("base64");

  const module = await import(dataUrl);

  if (
    !module.default ||
    typeof module.default !== "object" ||
    Array.isArray(module.default)
  ) {
    throw new Error(
      `${path.basename(filePath)} does not export a dictionary object.`
    );
  }

  return module.default;
}

function extractObjectBody(source) {
  const exportMatch = source.match(
    /export\s+default\s+[A-Za-z_$][\w$]*\s*;?\s*$/
  );

  if (!exportMatch) {
    throw new Error(
      "Could not find `export default <dictionary>;` in the dictionary file."
    );
  }

  const exportStart = exportMatch.index;

  const beforeExport = source.slice(0, exportStart);

  const objectStart = beforeExport.indexOf("{");

  if (objectStart === -1) {
    throw new Error(
      "Could not find the dictionary object."
    );
  }

  /*
   * We intentionally use the final `};` before the export.
   * The current dictionaries are object literals and end
   * with this structure.
   */
  const objectEnd = beforeExport.lastIndexOf("};");

  if (objectEnd === -1 || objectEnd <= objectStart) {
    throw new Error(
      "Could not find the end of the dictionary object."
    );
  }

  return {
    prefix: source.slice(0, objectEnd),
    suffix: source.slice(objectEnd),
  };
}

function escapeJsString(value) {
  return String(value)
    .replaceAll("\\", "\\\\")
    .replaceAll('"', '\\"')
    .replaceAll("\r\n", "\\n")
    .replaceAll("\n", "\\n")
    .replaceAll("\r", "\\n");
}

function createDictionaryEntries(translations) {
  return Object.entries(translations)
    .map(
      ([key, value]) =>
        `  "${escapeJsString(key)}": "${escapeJsString(value)}",`
    )
    .join("\n");
}

async function appendTranslations(
  filePath,
  translations
) {
  if (!Object.keys(translations).length) {
    return;
  }

  const source = await fs.readFile(
    filePath,
    "utf8"
  );

  const { prefix, suffix } =
    extractObjectBody(source);

  /*
   * Make sure the existing final entry can accept
   * another property.
   */
  let updatedPrefix = prefix.trimEnd();

  if (!updatedPrefix.endsWith(",")) {
    updatedPrefix += ",";
  }

  const entries =
    createDictionaryEntries(translations);

  const updated =
    `${updatedPrefix}\n\n` +
    `  // ==========================================================\n` +
    `  // AUTO-GENERATED TRANSLATIONS\n` +
    `  // ==========================================================\n\n` +
    `${entries}\n` +
    `${suffix}`;

  await fs.writeFile(
    filePath,
    updated,
    "utf8"
  );
}

async function translateBatch(
  englishEntries,
  targetLanguage
) {
  const apiKey =
    process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is not set. Set the API key in your terminal before running i18n:generate."
    );
  }

  const payload = {
    model: MODEL,

    instructions: `
You are a professional UI localization translator.

Translate the provided English UI strings into ${targetLanguage}.

Rules:
1. Return ONLY the JSON object requested.
2. Preserve every input key exactly.
3. Do not translate product names, programming languages,
   protocols, technologies, acronyms, file extensions,
   repository names, URLs, email addresses, IDs, or code-like
   values when they should remain unchanged.
4. Keep placeholders, punctuation, capitalization where
   appropriate, and ellipses intact.
5. Translate naturally for a professional enterprise
   application UI.
6. Do not add explanations.
7. Do not omit any key.
8. Do not add extra keys.
`.trim(),

    input: JSON.stringify(
      {
        target_language: targetLanguage,
        strings: englishEntries,
      },
      null,
      2
    ),

    text: {
      format: {
        type: "json_schema",
        name: "translations",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: {
            type: "string",
          },
        },
      },
    },
  };

  const response = await fetch(
    "https://api.openai.com/v1/responses",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    }
  );

  const responseText =
    await response.text();

  if (!response.ok) {
    let detail = responseText;

    try {
      const parsed =
        JSON.parse(responseText);

      detail =
        parsed?.error?.message ||
        responseText;
    } catch {
      // Keep raw response text.
    }

    throw new Error(
      `OpenAI API request failed (${response.status}): ${detail}`
    );
  }

  let result;

  try {
    result = JSON.parse(responseText);
  } catch {
    throw new Error(
      "OpenAI returned an invalid JSON response."
    );
  }

  const outputText =
    result?.output_text;

  if (!outputText) {
    throw new Error(
      "OpenAI response did not contain output_text."
    );
  }

  let translations;

  try {
    translations =
      JSON.parse(outputText);
  } catch {
    throw new Error(
      "OpenAI returned translation output that was not valid JSON."
    );
  }

  if (
    !translations ||
    typeof translations !== "object" ||
    Array.isArray(translations)
  ) {
    throw new Error(
      "OpenAI translation result is not a JSON object."
    );
  }

  return translations;
}

function getMissingKeys(
  english,
  translated
) {
  return Object.keys(english).filter(
    (key) =>
      !Object.prototype.hasOwnProperty.call(
        translated,
        key
      )
  );
}

function chunk(array, size) {
  const result = [];

  for (
    let index = 0;
    index < array.length;
    index += size
  ) {
    result.push(
      array.slice(
        index,
        index + size
      )
    );
  }

  return result;
}

async function generateLanguage(
  english,
  languageCode,
  config
) {
  console.log(
    `\nChecking ${config.name}...`
  );

  const translated =
    await loadDictionary(
      config.file
    );

  const missingKeys =
    getMissingKeys(
      english,
      translated
    );

  if (!missingKeys.length) {
    console.log(
      `✓ ${config.name}: no missing translations.`
    );
    return;
  }

  console.log(
    `→ ${config.name}: ${missingKeys.length} missing translation(s).`
  );

  const generated = {};

  const batches = chunk(
    missingKeys,
    BATCH_SIZE
  );

  for (
    let index = 0;
    index < batches.length;
    index += 1
  ) {
    const batch = batches[index];

    console.log(
      `  Translating batch ${index + 1}/${batches.length}...`
    );

    const englishBatch = {};

    for (const key of batch) {
      englishBatch[key] =
        english[key];
    }

    const translations =
      await translateBatch(
        englishBatch,
        config.name
      );

    for (const key of batch) {
      const value =
        translations[key];

      if (
        typeof value !== "string" ||
        !value.trim()
      ) {
        throw new Error(
          `${config.name}: OpenAI did not return a valid translation for "${key}".`
        );
      }

      generated[key] = value;
    }
  }

  /*
   * Safety check:
   *
   * Never overwrite an existing translation.
   */
  const current =
    await loadDictionary(
      config.file
    );

  const safeGenerated = {};

  for (const [key, value] of Object.entries(
    generated
  )) {
    if (
      !Object.prototype.hasOwnProperty.call(
        current,
        key
      )
    ) {
      safeGenerated[key] = value;
    }
  }

  if (!Object.keys(safeGenerated).length) {
    console.log(
      `✓ ${config.name}: nothing new to write.`
    );
    return;
  }

  await appendTranslations(
    config.file,
    safeGenerated
  );

  console.log(
    `✓ ${config.name}: added ${Object.keys(safeGenerated).length} translation(s).`
  );
}

async function main() {
  console.log(
    "\n========================================"
  );
  console.log(
    "        i18n Translation Generator"
  );
  console.log(
    "========================================"
  );

  console.log(
    `Model: ${MODEL}`
  );

  try {
    const english =
      await loadDictionary(
        EN_FILE
      );

    console.log(
      `English keys: ${Object.keys(english).length}`
    );

    for (const [
      languageCode,
      config,
    ] of Object.entries(
      LANGUAGE_CONFIG
    )) {
      await generateLanguage(
        english,
        languageCode,
        config
      );
    }

    console.log(
      "\n✓ i18n generation completed."
    );
    console.log(
      "Run `npm run i18n:validate` to verify the dictionaries."
    );
    console.log();
  } catch (error) {
    fail(
      error?.message ||
        String(error)
    );
  }
}

main();