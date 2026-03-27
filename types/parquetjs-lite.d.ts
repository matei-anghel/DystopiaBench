declare module "parquetjs-lite" {
  export class ParquetSchema {
    constructor(schema: Record<string, unknown>)
  }

  export class ParquetWriter {
    static openFile(schema: ParquetSchema, path: string): Promise<ParquetWriter>
    appendRow(row: Record<string, unknown>): Promise<void>
    close(): Promise<void>
  }
}
