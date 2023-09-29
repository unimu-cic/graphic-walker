let inited = false;

import * as duckdb from "@duckdb/duckdb-wasm";
import initWasm, { parser_dsl_with_table } from "@kanaries-temp/gw-dsl-parser";
import { nanoid } from "nanoid";

let db: duckdb.AsyncDuckDB;

export async function init() {
  if (inited) return;
  const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();

  // Select a bundle based on browser checks
  const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);

  const worker_url = URL.createObjectURL(
    new Blob([`importScripts("${bundle.mainWorker!}");`], {
      type: "text/javascript",
    })
  );

  // Instantiate the asynchronus version of DuckDB-Wasm
  const worker = new Worker(worker_url);
  const logger = new duckdb.ConsoleLogger();
  db = new duckdb.AsyncDuckDB(logger, worker);
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
  URL.revokeObjectURL(worker_url);
  await initWasm();
  inited = true;
}

export async function getComutation(data: Record<string, number>[]) {
  const tableName = nanoid();
  const fileName = `${tableName}.json`;
  const conn = await db.connect();
  await db.registerFileText(fileName, JSON.stringify(data));
  await conn.insertJSONFromPath(fileName, { name: tableName });
  return {
    close: () => conn.close(),
    computatuion: async (query: any) => {
        const sql = parser_dsl_with_table(tableName, JSON.stringify(query));
        return conn.query(sql).then(x => x.toArray().map(r => r.toJSON()));
      }
  }
}
