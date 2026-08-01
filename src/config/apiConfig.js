// TFE-103 — env-based API base URL. CRA only exposes REACT_APP_*-prefixed vars to the
// client bundle; falls back to the local dev backend port (terra-api's docker-compose.dev.yml).
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8081';

export default API_BASE_URL;