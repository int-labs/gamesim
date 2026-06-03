# Seed Data Management

## Overview

**Seed data is used ONLY for preview/testing environments and fresh development starts. Production does NOT use seed data.**

- **Base seed data** (`base/`): Production exports - minimal working real data (committed to repo)
- **Development enhancements** (`development/`): Temporary patches/new items during feature development

## Directory Structure

```
seed-data/
├── base/              # Production exports (committed to repo)
│   ├── simulationTypes.json
│   ├── products.json
│   └── ...
├── development/       # Temporary development enhancements (feature branches)
│   ├── simulationTypes.json  # Development data for simulation types
│   └── ...
├── merge-config.json  # Merge strategy configuration
└── readme.md
```

## Quick Start

### 1. Export Production Data to Base (One-time setup)

**Note**: This exports FROM production TO seed data files. It does NOT add data to production.

Export production data to create base seed files (for use in preview/testing/dev):

```bash
cd server/scripts/seed-data/base

# Export each collection from production
mongoexport --uri="PROD_MONGO_URI_WITH_DB" --collection=simulationTypes --out=simulationTypes.json --jsonArray
mongoexport --uri="PROD_MONGO_URI_WITH_DB" --collection=products --out=products.json --jsonArray
mongoexport --uri="PROD_MONGO_URI_WITH_DB" --collection=segments --out=segments.json --jsonArray
mongoexport --uri="PROD_MONGO_URI_WITH_DB" --collection=globalInputs --out=globalInputs.json --jsonArray
mongoexport --uri="PROD_MONGO_URI_WITH_DB" --collection=events --out=events.json --jsonArray
mongoexport --uri="PROD_MONGO_URI_WITH_DB" --collection=baseData --out=baseData.json --jsonArray
mongoexport --uri="PROD_MONGO_URI_WITH_DB" --collection=paramList --out=paramList.json --jsonArray

# Special case: filter only admin users
mongoexport --uri="PROD_MONGO_URI_WITH_DB" --collection=users --out=users.json --jsonArray --query='{ "role": "admin" }'
```

### 2. During Feature Development

When developing a feature that adds/modifies seed data:

#### A. Adding new entities (e.g., new simulation type)

Create `development/simulationTypes.json` with the new entities:

```json
[
  {
    "_id": {"$oid": "new_simulation_type_id"},
    "name": "fmcg",
    "description": "FMCG simulation type",
    "yearRange": {"startYear": -2, "endYear": 5, "baseYear": 0},
    ...
  }
]
```

**Note**: With `append` strategy, these will be added to base data. With `replace` strategy, this will replace all base data.

#### B. Testing

During development/preview, seed script automatically merges base + development:

```bash
npm run seed-db
```

This will merge:

- Base data from `base/` directory
- Development data from `development/` directory (same filename, according to strategy: `append` or `replace`)

### 3. Merging Feature (When PR is ready)

When your feature is ready to merge:

1. **Merge development enhancements into base files**:

   ```bash
   npm run merge-seed-data
   ```

   This will:

   - Merge development data/new items into base files according to strategy
   - Write updated base files
   - Remove development files (cleanup)

2. **Review the changes**:

   ```bash
   git diff server/scripts/seed-data/base/
   ```

3. **Commit** the updated base files:
   ```bash
   git add server/scripts/seed-data/base/
   git commit -m "Merge development seed data: add new simulation types"
   ```

## Merge Strategies

Configure merge behavior in `merge-config.json`. Only two simple strategies are supported:

- **`append`** (default): Append development data to base data. Both base and development items are included.
- **`replace`**: Completely replace base data with development data. If development data exists, only it is used; otherwise base data is used.

### Example Configuration

```json
{
  "collections": {
    "simulationTypes": {
      "strategy": "append"
    },
    "products": {
      "strategy": "append"
    },
    "users": {
      "strategy": "replace"
    }
  }
}
```

**Note**: To update existing entities, you need to include the complete entity in development data (for `replace` strategy) or add it as a new item (for `append` strategy). Partial updates are not supported.

## File Naming Conventions

### In `development/` directory:

- **`collectionName.json`**: Development data for the collection
  - If strategy is `append`: Added to base data (new items are appended)
  - If strategy is `replace`: Replaces base data entirely
  - Example: `simulationTypes.json` contains development simulation types

## Common Workflows

### Example 1: Adding new simulation type (FMCG)

1. **Create dev file**: `development/simulationTypes.json` with new simulation type
2. **Ensure strategy is `append`** in `merge-config.json` (default)
3. **Test**: Run `npm run seed-db` - verifies new type is added to base data
4. **Merge feature**: Run `npm run merge-seed-data` - merges into `base/simulationTypes.json`
5. **Commit**: Commit updated `base/simulationTypes.json`

### Example 2: Updating base seed data from production

When production data has been updated and you want to refresh the base seed data:

1. **Re-export from production**:

   ```bash
   cd server/scripts/seed-data/base
   mongoexport --uri="PROD_MONGO_URI" --collection=simulationTypes --out=simulationTypes.json --jsonArray
   ```

2. **Review changes**:

   ```bash
   git diff server/scripts/seed-data/base/simulationTypes.json
   ```

3. **Commit** updated base file

## Production Data Management

**Important**: Production data management is completely separate from seed data.

### Adding New Data to Production

Production data must be added **manually**. There are two ways:

#### Option 1: Using Admin UI (Recommended)

1. Log into production admin panel
2. Use the admin UI to create new entities (simulation types, products, segments, etc.)
3. This is the safest method as it goes through validation and proper APIs

#### Option 2: Using mongoimport (for bulk imports)

If you need to add multiple new entities based on seed data:

1. **Export new entities from seed data** (after testing in dev/preview):

   ```bash
   # From seed data that contains new entities
   # Extract only the new entities you want to add
   ```

2. **Import to production** (ONLY new data, not updates):

   ```bash
   mongoimport --uri="PROD_MONGO_URI_WITH_DB" --collection=simulationTypes --file=new-simulation-types.json --jsonArray --mode=insert
   ```

   **Important**: Use `--mode=insert` to ONLY add new documents. This will fail if documents with the same `_id` already exist, preventing accidental updates.

### Updating Existing Production Data

**Production data CANNOT be updated via seed data or mongoimport.**

To update existing production data:

- Use the Admin UI to make changes
- Or manually update via MongoDB if absolutely necessary (with caution)

### Why Separate Production Management?

- **Safety**: Prevents accidental data loss or corruption
- **Validation**: Admin UI ensures data integrity and business rules
- **Audit**: Manual updates via UI provide better audit trails
- **Control**: Production data should be managed carefully, not through automated scripts

## Important Notes

### Seed Data (Preview/Testing/Dev)

- ✅ **Base seed data** (`base/`) is committed to the repository
- ✅ **Development enhancements** (`development/`) are temporary and should be removed after merge
- ✅ **Seed script** automatically merges base + development during seeding
- ✅ **Merge script** merges development into base when feature is complete
- ❌ **Do NOT** commit development files - they should be removed after merge

### Production Data

- ❌ **Production** does NOT use seed data - it has its own real data
- ❌ **Production** does NOT automatically receive seed data - it must be added manually
- ✅ **Production** data can be added via Admin UI or mongoimport (insert only)
- ❌ **Production** data CANNOT be updated via seed data or bulk imports
- ✅ **Production** updates must be done manually via Admin UI

### Promoting a SimulationType to Production

When a new `SimulationType` has been developed locally or in a staging environment and its code is merged to Production, you must migrate the actual MongoDB configuration documents to the Production database.

To securely copy a completely configured `SimulationType` without affecting any existing unrelated production data, use the `sync-sim-type` script:

1. **Get the unique ID**: Open your local Database or Admin UI and copy the `_id` of the completely configured `SimulationType`.
2. **Set Environment Variables**:
   ```bash
   export SOURCE_MONGO_URI="mongodb://localhost:27017/stratagem"
   export TARGET_MONGO_URI="<YOUR_PROD_MONGO_URI>"
   ```
3. **Execute the Sync**:
   ```bash
   cd server
   npm run sync-sim -- <simulation_type_id>
   ```

**Safety Guarantees**:

- This script operates in **Strict Append Mode**: It uses `insertMany` exclusively and will forcibly abort if a SimulationType with that `_id` already exists in the target DB. It is structurally impossible to accidentally overwrite or corrupt existing simulations.
- This script maintains exact document parity by cloning standard MongoDB ObjectIds without regeneration, meaning all relationships between Products, Segments, and Global Inputs are flawlessly preserved.

## Troubleshooting

### Seed script says "No data to seed"

- Check that base files exist in `base/` directory
- Ensure files are valid JSON arrays

### Merge conflicts

- Review `merge-config.json` to ensure merge strategy is correct (`append` or `replace`)
- For `replace` strategy: development data completely replaces base data
- For `append` strategy: development data is added to base data

### Development files not being removed after merge

- Manually remove files from `development/` directory after merge
- Check that merge script completed successfully
