import * as fs from "fs";
import * as path from "path";
import * as XLSX from "xlsx";

/**
 * Script to randomize market size data in a CSV template.
 * Usage: npx ts-node scripts/randomizeMarketSize.ts <inputPath> <outputPath> <minMarketSize> <maxMarketSize>
 */

const args = process.argv.slice(2);

if (args.length < 4) {
  console.log(
    "Usage: npx ts-node scripts/randomizeMarketSize.ts <inputPath> <outputPath> <minMarketSize> <maxMarketSize>"
  );
  process.exit(1);
}

const [inputPath, outputPath, minSizeStr, maxSizeStr] = args;

const minSize = parseFloat(minSizeStr);
const maxSize = parseFloat(maxSizeStr);

if (isNaN(minSize) || isNaN(maxSize)) {
  console.error("minMarketSize and maxMarketSize must be numbers");
  process.exit(1);
}

const absoluteInputPath = path.resolve(inputPath);
const absoluteOutputPath = path.resolve(outputPath);

if (!fs.existsSync(absoluteInputPath)) {
  console.error(`Input file not found: ${absoluteInputPath}`);
  process.exit(1);
}

async function run() {
  try {
    const workbook = XLSX.readFile(absoluteInputPath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data: any[] = XLSX.utils.sheet_to_json(worksheet);

    console.log(`Processing ${data.length} rows...`);

    // Group rows by Product ID and Subproduct Key to apply trend
    const groups: { [key: string]: any[] } = {};
    data.forEach((row) => {
      const key = `${row["Product ID"]}_${row["Subproduct Key"] || ""}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(row);
    });

    // Apply randomization with upward trend
    Object.values(groups).forEach((group) => {
      // Sort by year to apply trend correctly
      group.sort((a, b) => parseInt(a["Year"]) - parseInt(b["Year"]));

      // Starting point: random value between minSize and minSize + (maxSize - minSize) * 0.3
      let currentValue = minSize + (maxSize - minSize) * 0.3 * Math.random();

      group.forEach((row) => {
        // Apply some randomness and growth
        // Growth factor between -2% and +8% (averaging +3% growth)
        const growthFactor = 0.01 + Math.random() * 0.05;

        row["Market Size"] = Math.round(currentValue);

        // Update for next year in group
        currentValue = currentValue * (1 + growthFactor);

        // Clamp to max
        if (currentValue > maxSize) {
          currentValue = maxSize * (0.9 + Math.random() * 0.1); // Keep it near max deciduous with jitter
        }
      });
    });

    // Convert back to CSV
    const headers = [
      "Segment Name",
      "Product Name",
      "Product ID",
      "Subproduct Key",
      "Year",
      "Market Size",
    ];
    const newWorksheet = XLSX.utils.json_to_sheet(data, { header: headers });
    const newWorkbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(newWorkbook, newWorksheet, "Market Data");

    XLSX.writeFile(newWorkbook, absoluteOutputPath, { bookType: "csv" });

    console.log(
      `Success! Randomized market data saved to: ${absoluteOutputPath}`
    );
  } catch (err) {
    console.error("Error processing CSV:", err);
    process.exit(1);
  }
}

run();
