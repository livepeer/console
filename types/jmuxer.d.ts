declare module "jmuxer" {
  export default class JMuxer {
    constructor(options: Record<string, unknown>);
    feed(payload: {
      video?: Uint8Array;
      audio?: Uint8Array;
      duration?: number;
    }): void;
    destroy(): void;
    reset(): void;
  }
}
