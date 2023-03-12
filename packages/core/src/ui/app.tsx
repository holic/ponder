import { Box, Newline, render as inkRender, Text } from "ink";
import React from "react";

import { Contract } from "@/config/contracts";
import { PonderOptions } from "@/config/options";

import { BackfillBar } from "./BackfillBar";
import { HandlersBar } from "./HandlersBar";

export type UiState = {
  isSilent: boolean;
  port: number;

  stats: Record<
    string,
    {
      cacheRate: number;

      logStartTimestamp: number;
      logTotal: number;
      logCurrent: number;
      logAvgDuration: number;
      logAvgBlockCount: number;

      blockStartTimestamp: number;
      blockTotal: number;
      blockCurrent: number;
      blockAvgDuration: number;

      eta: number;
    }
  >;

  isBackfillComplete: boolean;
  backfillDuration: string;

  handlerError: boolean;
  handlersCurrent: number;
  handlersTotal: number;
  handlersHandledTotal: number;
  handlersToTimestamp: number;

  networks: string[];
};

export const getUiState = (options: Partial<PonderOptions>): UiState => {
  return {
    isSilent: options.SILENT ?? false,
    port: options.PORT ?? 0,

    stats: {},

    isBackfillComplete: false,
    backfillDuration: "",

    handlerError: false,
    handlersCurrent: 0,
    handlersTotal: 0,
    handlersHandledTotal: 0,
    handlersToTimestamp: 0,

    networks: [],
  };
};

export const hydrateUi = ({
  ui,
  contracts,
}: {
  ui: UiState;
  contracts: Contract[];
}) => {
  contracts
    .filter((contract) => contract.isIndexed)
    .forEach((contract) => {
      ui.stats[contract.name] = {
        cacheRate: 0,
        logStartTimestamp: 0,
        logTotal: 0,
        logCurrent: 0,
        logAvgDuration: 0,
        logAvgBlockCount: 0,
        blockStartTimestamp: 0,
        blockTotal: 0,
        blockCurrent: 0,
        blockAvgDuration: 0,
        eta: 0,
      };
    });
};

const App = (ui: UiState) => {
  const {
    isSilent,
    port,
    stats,
    isBackfillComplete,
    backfillDuration,
    handlersCurrent,
    handlerError,
    networks,
  } = ui;

  if (isSilent) return null;

  if (handlerError) {
    return (
      <Box flexDirection="column">
        <Text> </Text>
        <Text color="cyan">
          Resolve the error and save your changes to reload the server.
        </Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {/* Newline above interface */}
      <Text> </Text>
      <Box flexDirection="row">
        <Text bold={true}>Backfill </Text>
        {isBackfillComplete ? (
          <Text color="greenBright">
            (done in {backfillDuration})<Newline />
          </Text>
        ) : (
          <Text color="yellowBright">(in progress)</Text>
        )}
      </Box>
      {!isBackfillComplete && (
        <Box flexDirection="column">
          {Object.entries(stats).map(([contract, stat]) => (
            <BackfillBar key={contract} contract={contract} stat={stat} />
          ))}
          <Text> </Text>
        </Box>
      )}

      <HandlersBar ui={ui} />

      {networks.length > 0 && (
        <Box flexDirection="column">
          <Text bold={true}>Networks</Text>
          {networks.map((network) => (
            <Box flexDirection="row" key={network}>
              <Text>
                {network.slice(0, 1).toUpperCase() + network.slice(1)} (live)
              </Text>
            </Box>
          ))}
          <Text> </Text>
        </Box>
      )}

      {handlersCurrent > 0 && (
        <Box flexDirection="column">
          <Text bold={true}>GraphQL </Text>
          <Box flexDirection="row">
            <Text>Server live at http://localhost:{port}/graphql</Text>
          </Box>
        </Box>
      )}
    </Box>
  );
};

const {
  rerender,
  unmount: inkUnmount,
  clear,
} = inkRender(<App {...getUiState({ SILENT: true })} />);

export const render = (ui: UiState) => {
  rerender(<App {...ui} />);
};

export const unmount = () => {
  clear();
  inkUnmount();
};
