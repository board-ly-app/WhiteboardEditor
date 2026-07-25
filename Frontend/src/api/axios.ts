import axios from 'axios';

import {
  LS_KEY_SESSION_TOKEN,
  HEADER_NAME_SESSION_TOKEN,
} from '@/app.config';

const api = axios.create({
  baseURL: `${window.location.origin}/api/v1`,
  headers: {
    "Content-Type": "application/json",
  },
  transformRequest: [
    (data, headers) => {
      const sessionToken : string | null = localStorage.getItem(LS_KEY_SESSION_TOKEN);

      if (sessionToken) {
        headers[HEADER_NAME_SESSION_TOKEN] = sessionToken;
      }

      return JSON.stringify(data);
    },
  ],
});

export default api;
