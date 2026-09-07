import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();

const I18N_DIR = path.join(
  ROOT,
  "src",
  "i18n"
);

const FILES = {
  en: path.join(I18N_DIR, "en.js"),
  hi: path.join(I18N_DIR, "hi.js"),
  te: path.join(I18N_DIR, "te.js"),
};

function extractObjectSource(source) {
  const exportMatch = source.match(
    /export\s+default\s+[A-Za-z_$][\w$]*\s*;?\s*$/
  );

  if (!exportMatch) {
    throw new Error(
      "Missing `export default <dictionary>;`."
    );
  }

  const exportStart =
    exportMatch.index;

  const beforeExport =
    source.slice(0, exportStart);

  const objectStart =
    beforeExport.indexOf("{");

  const objectEnd =
    beforeExport.lastIndexOf("};");

  if (
    objectStart === -1 ||
    objectEnd === -1 ||
    objectEnd <= objectStart
  ) {
    throw new Error(
      "Unable to locate dictionary object."
    );
  }

  return beforeExport.slice(
    objectStart + 1,
    objectEnd
  );
}

function findDuplicateKeys(source) {
  const body =
    extractObjectSource(source);

  /*
   * Current dictionaries use quoted string keys.
   *
   * This intentionally checks source-level keys rather
   * than evaluating the object because JavaScript itself
   * silently overwrites duplicate object properties.
   */
  const keyPattern =
    /(?:^|[,\n])\s*"((?:\\.|[^"\\])*)"\s*:/g;

  const keys = [];
  const duplicates = [];

  let match;

  while (
    (match = keyPattern.exec(body)) !==
    null
  ) {
    const key = match[1];

    if (keys.includes(key)) {
      if (!duplicates.includes(key)) {
        duplicates.push(key);
      }
    } else {
      keys.push(key);
    }
  }

  return duplicates;
}

async function loadDictionary(
  filePath
) {
  const source =
    await fs.readFile(
      filePath,
      "utf8"
    );

  const dataUrl =
    "data:text/javascript;base64," +
    Buffer.from(source, "utf8").toString(
      "base64"
    );

  const module =
    await import(dataUrl);

  if (
    !module.default ||
    typeof module.default !==
      "object" ||
    Array.isArray(module.default)
  ) {
    throw new Error(
      "Dictionary does not export an object."
    );
  }

  return {
    source,
    dictionary: module.default,
  };
}

function missingKeys(
  sourceDictionary,
  targetDictionary
) {
  return Object.keys(
    sourceDictionary
  ).filter(
    (key) =>
      !Object.prototype.hasOwnProperty.call(
        targetDictionary,
        key
      )
  );
}

function extraKeys(
  sourceDictionary,
  targetDictionary
) {
  return Object.keys(
    targetDictionary
  ).filter(
    (key) =>
      !Object.prototype.hasOwnProperty.call(
        sourceDictionary,
        key
      )
  );
}

function emptyTranslations(
  dictionary
) {
  return Object.entries(
    dictionary
  )
    .filter(
      ([, value]) =>
        typeof value !== "string" ||
        !value.trim()
    )
    .map(([key]) => key);
}

function printKeyList(
  title,
  keys
) {
  if (!keys.length) {
    return;
  }

  console.log(`\n${title}`);

  for (const key of keys) {
    console.log(`  - ${key}`);
  }
}

async function main() {
  console.log(
    "\n========================================"
  );
  console.log(
    "           i18n Dictionary Validator"
  );
  console.log(
    "========================================\n"
  );

  let failed = false;

  const loaded = {};

  /*
   * Step 1:
   * Load and syntax-check every dictionary.
   */
  for (const [
    language,
    filePath,
  ] of Object.entries(FILES)) {
    try {
      loaded[language] =
        await loadDictionary(
          filePath
        );

      console.log(
        `✓ ${language}.js loaded`
      );
    } catch (error) {
      failed = true;

      console.error(
        `✗ ${language}.js failed: ${error.message}`
      );
    }
  }

  if (failed) {
    console.error(
      "\n✗ i18n validation failed."
    );
    process.exitCode = 1;
    return;
  }

  /*
   * Step 2:
   * Detect duplicate keys.
   */
  for (const [
    language,
    data,
  ] of Object.entries(loaded)) {
    const duplicates =
      findDuplicateKeys(
        data.source
      );

    if (duplicates.length) {
      failed = true;

      printKeyList(
        `✗ Duplicate keys in ${language}.js:`,
        duplicates
      );
    }
  }

  /*
   * Step 3:
   * English is the source of truth.
   */
  const english =
    loaded.en.dictionary;

  const englishKeys =
    Object.keys(english);

  console.log(
    `\nEnglish source keys: ${englishKeys.length}`
  );

  /*
   * Step 4:
   * Check Hindi and Telugu against English.
   */
  for (const language of [
    "hi",
    "te",
  ]) {
    const dictionary =
      loaded[language].dictionary;

    const missing =
      missingKeys(
        english,
        dictionary
      );

    const extras =
      extraKeys(
        english,
        dictionary
      );

    const empty =
      emptyTranslations(
        dictionary
      );

    console.log(
      `\n${language}.js`
    );

    console.log(
      `  Keys: ${Object.keys(dictionary).length}`
    );

    console.log(
      `  Missing: ${missing.length}`
    );

    console.log(
      `  Extra: ${extras.length}`
    );

    console.log(
      `  Empty/invalid: ${empty.length}`
    );

    if (missing.length) {
      failed = true;

      printKeyList(
        `✗ Missing ${language} translations:`,
        missing
      );
    }

    if (extras.length) {
      /*
       * Extra keys are not necessarily fatal.
       *
       * They can happen during gradual migration,
       * but we report them so they can be cleaned up.
       */
      printKeyList(
        `⚠ Extra keys in ${language}.js:`,
        extras
      );
    }

    if (empty.length) {
      failed = true;

      printKeyList(
        `✗ Empty/invalid translations in ${language}.js:`,
        empty
      );
    }
  }

  /*
   * Step 5:
   * Final result.
   */
  if (failed) {
    console.error(
      "\n✗ i18n validation FAILED."
    );
    console.error(
      "Fix the reported issues before building."
    );

    process.exitCode = 1;
    return;
  }

  console.log(
    "\n✓ i18n validation PASSED."
  );

  console.log(
    "✓ English, Hindi and Telugu dictionaries are valid."
  );

  console.log();
}

main();