// -- third-party imports
import {
  type UseQueryResult,
  type QueryClient,
  useQuery,
} from '@tanstack/react-query';

import {
  type AxiosResponse,
  type AxiosError,
} from 'axios';

// -- local imports
import {
  type WhiteboardIdType,
} from '@/types/WebSocketProtocol';

import {
  type Whiteboard,
  type ErrorResponse,
  axiosResponseIsError,
} from '@/types/APIProtocol';

import api from '@/api/axios';

const getWhiteboardQueryKey = (whiteboardId: WhiteboardIdType) => {
  return ['whiteboard', whiteboardId];
};// -- end getWhiteboardQueryKey

export const useWhiteboardQuery = (
  wid: WhiteboardIdType
): UseQueryResult<Whiteboard, AxiosError<ErrorResponse>> => {
  return useQuery<Whiteboard, AxiosError<ErrorResponse>>({
    queryKey: getWhiteboardQueryKey(wid),
    queryFn: async () => {
      const res : AxiosResponse<Whiteboard> = await api.get(`/whiteboards/id/${wid.toString()}`);

      if (axiosResponseIsError(res)) {
        throw res;
      } else {
        return res.data;
      }
    },
    retry: (failureCount, error) => {
      if (failureCount >= 3) {
        return false;
      } else {
        switch (error.status) {
          case 403:
          case 404:
            // -- We can be sure that the whiteboard either doesn't exist or we
            // don't have permission to access it.
            return false;
          default:
            return true;
        }// -- end switch error.
      }
    },
  });
};// -- end useWhiteboardQuery

export const invalidateWhiteboardQuery = async (
  queryClient: QueryClient,
  wid: WhiteboardIdType
): Promise<void> => {
  return queryClient.invalidateQueries({
    queryKey: getWhiteboardQueryKey(wid),
  });
};// -- end invalidateWhiteboardQuery
