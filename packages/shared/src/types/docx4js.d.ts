declare module 'docx4js' {
  interface DocxDocument {
    render(callback: (type: string, props: any, children: any[]) => any): void;
    parse(handler: any): void;
    save(path: string): Promise<void>;
    officeDocument: {
      content: any;
    };
  }

  interface LoadOptions {
    data?: Uint8Array | Buffer;
  }

  function load(input: string | Buffer | Uint8Array, options?: LoadOptions): Promise<DocxDocument>;
  function create(): Promise<DocxDocument>;

  export default {
    load,
    create
  };
}
