/**
 * Import an ESM-only package from this CommonJS build.
 *
 * The `new Function` wrapper is load-bearing: TypeScript downlevels a literal
 * `import()` to `require()` under `module: commonjs`, which throws
 * ERR_REQUIRE_ESM for packages that ship `"type": "module"` (random-words,
 * @dicebear/core, @dicebear/collection). Hiding it from the compiler keeps it a
 * real dynamic import at runtime.
 */
const dynamicImport = new Function("specifier", "return import(specifier)") as (
  specifier: string
) => Promise<any>;

export async function importEsm<T = any>(specifier: string): Promise<T> {
  const mod = await dynamicImport(specifier);
  return (mod?.default ?? mod) as T;
}

/** Same, but keeps the namespace (for packages with many named exports). */
export async function importEsmNamespace<T = any>(specifier: string): Promise<T> {
  return (await dynamicImport(specifier)) as T;
}
