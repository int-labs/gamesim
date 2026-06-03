set -euo pipefail

# Resolve to the directory containing this script (same dir as readme.md)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Move into the "development" directory where JSON files are written
cd "${SCRIPT_DIR}/development"

# Expect DEV_MONGO_URI_WITH_DB to be set in the environment
if [[ -z "${DEV_MONGO_URI_WITH_DB:-}" ]]; then
  echo "ERROR: DEV_MONGO_URI_WITH_DB environment variable is not set."
  echo "Example:"
  echo '  export DEV_MONGO_URI_WITH_DB="mongodb+srv://user:pass@cluster/dbname"'
  exit 1
fi

URI="${DEV_MONGO_URI_WITH_DB}"

echo "Using URI: ${URI}"
echo "Exporting collections to $(pwd)…"

mongoexport --uri="${URI}" --collection=balancesheetconfigs --out=balancesheetconfigs.json --jsonArray
mongoexport --uri="${URI}" --collection=baseData        --out=baseData.json        --jsonArray
mongoexport --uri="${URI}" --collection=bizperfconfigs           --out=bizperfconfigs.json           --jsonArray
mongoexport --uri="${URI}" --collection=cashflowconfigs --out=cashflowconfigs.json --jsonArray
mongoexport --uri="${URI}" --collection=events          --out=events.json          --jsonArray
mongoexport --uri="${URI}" --collection=globalInputs    --out=globalInputs.json    --jsonArray
mongoexport --uri="${URI}" --collection=paramList       --out=paramList.json       --jsonArray
mongoexport --uri="${URI}" --collection=pnlconfigs           --out=pnlconfigs.json           --jsonArray
mongoexport --uri="${URI}" --collection=products        --out=products.json        --jsonArray
mongoexport --uri="${URI}" --collection=segments        --out=segments.json        --jsonArray
mongoexport --uri="${URI}" --collection=simulationTypes --out=simulationTypes.json --jsonArray
mongoexport --uri="${URI}" --collection=users           --out=users.json           --jsonArray --query='{ "role": "admin" }'

echo "Done."
