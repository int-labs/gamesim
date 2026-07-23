// Node 21+ removed `Buffer.SlowBuffer`, which the (unmaintained, transitive)
// `buffer-equal-constant-time` dependency of `jsonwebtoken` -> `jwa` -> `jws`
// reads unconditionally at module load time, crashing on `require("jsonwebtoken")`
// under a current Node. Aliasing it back to `Buffer` is what that package's
// own code has always assumed SlowBuffer to behave like for this purpose.
const bufferModule = require("buffer");
if (!bufferModule.SlowBuffer) {
  bufferModule.SlowBuffer = bufferModule.Buffer;
}
