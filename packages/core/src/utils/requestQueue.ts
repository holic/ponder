import type { Common } from "@/common/common.js";
import type { Network } from "@/config/networks.js";
import { type Queue, createQueue } from "@ponder/common";
import {
  type GetLogsRetryHelperParameters,
  getLogsRetryHelper,
} from "@ponder/utils";
import {
  type EIP1193Parameters,
  HttpRequestError,
  InvalidRequestRpcError,
  JsonRpcVersionUnsupportedError,
  MethodNotFoundRpcError,
  MethodNotSupportedRpcError,
  ParseRpcError,
  type PublicRpcSchema,
  type RpcError,
  isHex,
} from "viem";
import type { DebugRpcSchema } from "./debug.js";
import { startClock } from "./timer.js";
import { wait } from "./wait.js";

type Schema = [...PublicRpcSchema, ...DebugRpcSchema];

type RequestReturnType<method extends EIP1193Parameters<Schema>["method"]> =
  Extract<Schema[number], { Method: method }>["ReturnType"];

export type RequestQueue = Omit<
  Queue<
    RequestReturnType<EIP1193Parameters<Schema>["method"]>,
    EIP1193Parameters<Schema>
  >,
  "add"
> & {
  request: <TParameters extends EIP1193Parameters<Schema>>(
    parameters: TParameters,
  ) => Promise<RequestReturnType<TParameters["method"]>>;
};

const RETRY_COUNT = 9;
const BASE_DURATION = 125;

/**
 * Creates a queue built to manage rpc requests.
 */
export const createRequestQueue = ({
  network,
  common,
}: {
  network: Network;
  common: Common;
}): RequestQueue => {
  // @ts-ignore
  const fetchRequest = async (request: EIP1193Parameters<PublicRpcSchema>) => {
    for (let i = 0; i <= RETRY_COUNT; i++) {
      try {
        const stopClock = startClock();
        common.logger.trace({
          service: "rpc",
          msg: `Sent ${request.method} request (params=${JSON.stringify(request.params)})`,
        });
        const response = await network.transport.request(request);
        common.logger.trace({
          service: "rpc",
          msg: `Received ${request.method} response (duration=${stopClock()}, params=${JSON.stringify(request.params)})`,
        });
        common.metrics.ponder_rpc_request_duration.observe(
          { method: request.method, network: network.name },
          stopClock(),
        );

        return response;
      } catch (_error) {
        const error = _error as Error;

        if (
          request.method === "eth_getLogs" &&
          isHex(request.params[0].fromBlock) &&
          isHex(request.params[0].toBlock)
        ) {
          const getLogsErrorResponse = getLogsRetryHelper({
            params: request.params as GetLogsRetryHelperParameters["params"],
            error: error as RpcError,
          });

          if (getLogsErrorResponse.shouldRetry === true) throw error;
        }

        if (shouldRetry(error) === false) {
          common.logger.warn({
            service: "rpc",
            msg: `Failed ${request.method} request`,
          });
          throw error;
        }

        if (i === RETRY_COUNT) {
          common.logger.warn({
            service: "rpc",
            msg: `Failed ${request.method} request after ${i + 1} attempts`,
            error,
          });
          throw error;
        }

        const duration = BASE_DURATION * 2 ** i;
        common.logger.debug({
          service: "rpc",
          msg: `Failed ${request.method} request, retrying after ${duration} milliseconds`,
          error,
        });
        await wait(duration);
      }
    }
  };

  const requestQueue: Queue<
    unknown,
    {
      request: EIP1193Parameters<PublicRpcSchema>;
      stopClockLag: () => number;
    }
  > = createQueue({
    frequency: network.maxRequestsPerSecond,
    concurrency: Math.ceil(network.maxRequestsPerSecond / 4),
    initialStart: true,
    browser: false,
    worker: async (task: {
      request: EIP1193Parameters<PublicRpcSchema>;
      stopClockLag: () => number;
    }) => {
      common.metrics.ponder_rpc_request_lag.observe(
        { method: task.request.method, network: network.name },
        task.stopClockLag(),
      );

      return await fetchRequest(task.request);
    },
  });

  return {
    ...requestQueue,
    request: <TParameters extends EIP1193Parameters<PublicRpcSchema>>(
      params: TParameters,
    ) => {
      const stopClockLag = startClock();

      return requestQueue.add({ request: params, stopClockLag });
    },
  } as RequestQueue;
};

/**
 * @link https://github.com/wevm/viem/blob/main/src/utils/buildRequest.ts#L192
 */
function shouldRetry(error: Error) {
  if ("code" in error && typeof error.code === "number") {
    // Invalid JSON
    if (error.code === ParseRpcError.code) return false;
    // JSON is not a valid request object
    if (error.code === InvalidRequestRpcError.code) return false;
    // Method does not exist
    if (error.code === MethodNotFoundRpcError.code) return false;
    // Method is not implemented
    if (error.code === MethodNotSupportedRpcError.code) return false;
    // Version of JSON-RPC protocol is not supported
    if (error.code === JsonRpcVersionUnsupportedError.code) return false;
  }
  if (error instanceof HttpRequestError && error.status) {
    // Method Not Allowed
    if (error.status === 405) return false;
    // Not Found
    if (error.status === 404) return false;
    // Not Implemented
    if (error.status === 501) return false;
    // HTTP Version Not Supported
    if (error.status === 505) return false;
  }
  return true;
}
