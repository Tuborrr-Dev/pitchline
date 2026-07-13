import axios from "axios";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_PITCHLINE_API_BASE_URL ?? "https://pitchline.onrender.com";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    Accept: "application/json",
  },
});

export function getApiBaseUrl() {
  return API_BASE_URL;
}
