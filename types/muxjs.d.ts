declare module "mux.js" {
  type MuxSegment = {
    initSegment?: Uint8Array;
    data: Uint8Array;
  };

  const muxjs: {
    mp4: {
      Transmuxer: new () => {
        on: (event: "data", handler: (segment: MuxSegment) => void) => void;
        push: (chunk: Uint8Array) => void;
        flush: () => void;
      };
    };
  };

  export default muxjs;
}
