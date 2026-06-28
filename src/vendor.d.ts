declare module "qrcode-terminal" {
  const qrterm: {
    generate(url: string, opts?: { small?: boolean }): void;
    setErrorLevel(level: string): void;
  };
  export default qrterm;
}

declare module "duckduckgo-images-api" {
  export function image_search(params: {
    query: string;
    moderate?: boolean;
    iterations?: number;
    retries?: number;
  }): Promise<Array<{ image?: string; thumbnail?: string; url?: string; title?: string }>>;
  export function image_search_generator(params: {
    query: string;
    moderate?: boolean;
    retries?: number;
  }): AsyncGenerator<Array<{ image?: string }>, void, unknown>;
}
