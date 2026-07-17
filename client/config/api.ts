import axios from "axios";

function requiredPublicEnv(name: string, value: string | undefined) {
  const trimmedValue = value?.trim();
  if (!trimmedValue) {
    throw new Error(`${name} is not configured.`);
  }
  return trimmedValue;
}

export const API_BASE_URL = requiredPublicEnv(
  "NEXT_PUBLIC_PITCHLINE_API_BASE_URL",
  process.env.NEXT_PUBLIC_PITCHLINE_API_BASE_URL,
);

export const ANNOTATION_API_BASE_URL = requiredPublicEnv(
  "NEXT_PUBLIC_ANNOTATION_API_BASE_URL",
  process.env.NEXT_PUBLIC_ANNOTATION_API_BASE_URL,
).replace(/\/$/, "");

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    Accept: "application/json",
  },
});

export function getApiBaseUrl() {
  return API_BASE_URL;
}
