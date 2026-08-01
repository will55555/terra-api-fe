// TFE-103 — env-based API base URL, empty by default so requests are relative to the
// current origin. In dev, CRA's "proxy" field (package.json) forwards those relative
// /api/* calls to the local backend without a CORS-triggering cross-origin request. In
// prod, the app is served same-origin by terra-api itself, so relative paths work
// identically there too. Only set REACT_APP_API_BASE_URL to override toward a different
// (e.g. remote/staging) backend.
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || '';

export default API_BASE_URL;