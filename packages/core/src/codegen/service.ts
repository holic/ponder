import Emittery from "emittery";
import { GraphQLSchema, printSchema } from "graphql";
import { writeFileSync } from "node:fs";
import path from "node:path";

import { Source } from "@/config/sources";
import type { Common } from "@/Ponder";
import { Schema } from "@/schema/types";
import { ensureDirExists } from "@/utils/exists";

import { buildEntityTypes } from "./entity";
import { buildEventTypes } from "./event";
import { formatPrettier } from "./prettier";

export class CodegenService extends Emittery {
  private common: Common;
  private sources: Source[];

  constructor({ common, sources }: { common: Common; sources: Source[] }) {
    super();
    this.common = common;
    this.sources = sources;
  }

  generateAppFile({ schema }: { schema?: Schema } = {}) {
    const raw = `
      /* Autogenerated file. Do not edit manually. */
  
      import { PonderApp } from "@ponder/core";
      import type { Block, Log, Transaction, Model, ReadOnlyContract } from "@ponder/core";
      import type { AbiParameterToPrimitiveType } from "abitype";
      import type { BlockTag, Hash } from "viem";

      /* ENTITY TYPES */

      ${buildEntityTypes(schema ?? { tables: {}, enums: {} })}
  
      /* CONTRACT TYPES */

      /* CONTEXT TYPES */

      export type Context = {
    
        entities: {
          ${Object.keys(schema?.tables ?? {})
            .map((tableName) => `${tableName}: Model<${tableName}>;`)
            .join("")}
        },
      }

  
      /* INDEXING FUNCTION TYPES */
    
      ${buildEventTypes({
        sources: this.sources,
      })}

      export const ponder = new PonderApp<AppType>();
    `;

    const final = formatPrettier(raw);

    const filePath = path.join(this.common.options.generatedDir, "index.ts");
    ensureDirExists(filePath);
    writeFileSync(filePath, final, "utf8");

    this.common.logger.debug({
      service: "codegen",
      msg: `Wrote new file at generated/index.ts`,
    });
  }

  generateGraphqlSchemaFile({
    graphqlSchema,
  }: {
    graphqlSchema: GraphQLSchema;
  }) {
    const final = formatPrettier(printSchema(graphqlSchema), {
      parser: "graphql",
    });

    const filePath = path.join(
      this.common.options.generatedDir,
      "schema.graphql"
    );
    ensureDirExists(filePath);
    writeFileSync(filePath, final, "utf8");

    this.common.logger.debug({
      service: "codegen",
      msg: `Wrote new file at generated/schema.graphql`,
    });
  }
}
