import type { Projection, State256State } from "./types.js";

export function routeProjection<A, B>(from: Projection<A>, to: Projection<B>, input: A): B {
  const state: State256State = from.mux(input);
  return to.demux(state);
}
